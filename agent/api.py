from __future__ import annotations

import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .chat_history import ChatHistoryStore
from .config import load_settings
from .llm_backends import build_backend
from .memory import MemoryStore
from .prompting import (
    build_creative_writing_prompt,
    build_general_chat_prompt,
    extract_personal_memory,
    is_creative_writing_request,
)

settings = load_settings()
llm = build_backend(settings)
memory = MemoryStore(settings.memory_dir)
history = ChatHistoryStore(settings.memory_dir)
app = FastAPI(title="Nexel Chat API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
web_dir = Path(__file__).resolve().parent.parent / "web"
dist_dir = web_dir / "dist"
assets_dir = dist_dir / "assets"
if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1)
    max_tokens: int | None = None
    temperature: float | None = None
    mode: str | None = None
    conversation_id: str | None = None
    user_id: str | None = None
    user_name: str | None = None


class EditRequest(BaseModel):
    instruction: str = Field(min_length=1)
    code: str = Field(min_length=1)


class ExplainRequest(BaseModel):
    file_path: str = Field(min_length=1)


class RememberRequest(BaseModel):
    text: str = Field(min_length=1)


def _looks_like_name_question(prompt: str) -> bool:
    prompt_lower = " ".join(prompt.lower().split())
    patterns = (
        "what is my name",
        "what's my name",
        "whats my name",
        "who am i",
        "whoami",
        "tell me my name",
        "say my name",
    )
    return any(pattern in prompt_lower for pattern in patterns)


def _direct_response(prompt: str, user_name: str | None) -> str | None:
    if user_name and _looks_like_name_question(prompt):
        return f"Your name is {user_name}."
    return None


@app.on_event("startup")
def prewarm_fast_backend() -> None:
    def _worker() -> None:
        try:
            prewarm = getattr(llm, "prewarm", None)
            if callable(prewarm):
                prewarm("fast")
        except Exception:
            pass

    threading.Thread(target=_worker, name="nexa-prewarm", daemon=True).start()


def _complete(prompt: str, max_tokens: int | None = None, temperature: float | None = None) -> str:
    return llm.complete(
        prompt,
        max_tokens=max_tokens if max_tokens is not None else settings.max_tokens,
        temperature=temperature if temperature is not None else settings.temperature,
    )


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    index_file = dist_dir / "index.html"
    if not index_file.exists():
        raise HTTPException(
            status_code=503,
            detail="Frontend build not found. Run 'cd web && npm install && npm run build'.",
        )
    return FileResponse(index_file)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/settings")
def get_settings() -> dict[str, str | int | float]:
    return {
        "default_mode": settings.llm_mode,
        "max_tokens": settings.max_tokens,
        "temperature": settings.temperature,
    }


@app.get("/conversations")
def list_conversations(user_id: str | None = Query(default=None)) -> dict[str, list[dict[str, str]]]:
    return {"conversations": history.list_sessions(user_id=user_id)}


@app.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: str,
    user_id: str | None = Query(default=None),
) -> dict[str, object]:
    return {"conversation_id": conversation_id, "turns": history.load(conversation_id, user_id=user_id)}


@app.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    user_id: str | None = Query(default=None),
) -> dict[str, str]:
    history.clear(conversation_id, user_id=user_id)
    return {"status": "cleared", "conversation_id": conversation_id}


@app.post("/generate")
def generate(req: GenerateRequest) -> dict[str, str]:
    try:
        conversation_id = req.conversation_id or "api-default"
        user_id = req.user_id or None
        user_name = (req.user_name or "").strip() or None
        direct = _direct_response(req.prompt, user_name)
        if direct is not None:
            if user_name:
                memory.add(
                    f"The signed-in user's name is {user_name}.",
                    kind="note",
                    conversation_id=conversation_id,
                    user_id=user_id,
                )
            history.append(conversation_id, "user", req.prompt, user_id=user_id)
            history.append(conversation_id, "assistant", direct, user_id=user_id)
            return {"response": direct, "conversation_id": conversation_id}
        recent_turns = history.recent(conversation_id, limit=16, user_id=user_id)
        creative_request = is_creative_writing_request(req.prompt, recent_turns)
        hits = memory.search(req.prompt, n_results=3, kind="note", user_id=user_id)
        mem_context = "\n".join(f"- {h}" for h in hits) if hits else "(none)"
        recent_turns = recent_turns[:]
        if not creative_request:
            recent_turns = recent_turns[-16:]
        prompt = (
            build_creative_writing_prompt(
                user_request=req.prompt,
                relevant_memory=mem_context,
                recent_turns=recent_turns,
                signed_in_user=user_name,
            )
            if creative_request
            else build_general_chat_prompt(
                user_request=req.prompt,
                relevant_memory=mem_context,
                recent_turns=recent_turns,
                signed_in_user=user_name,
            )
        )
        if user_name:
            memory.add(
                f"The signed-in user's name is {user_name}.",
                kind="note",
                conversation_id=conversation_id,
                user_id=user_id,
            )
        mode = req.mode or settings.llm_mode
        max_tokens = req.max_tokens if req.max_tokens is not None else settings.max_tokens
        temperature = req.temperature if req.temperature is not None else settings.temperature
        if creative_request:
            if mode == "auto":
                mode = "smart"
            max_tokens = max(max_tokens, 1400)
            temperature = max(temperature, 0.8)
        response = llm.complete(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            mode=mode,
        )
        for memory_text in extract_personal_memory(req.prompt):
            memory.add(memory_text, kind="note", conversation_id=conversation_id, user_id=user_id)
        history.append(conversation_id, "user", req.prompt, user_id=user_id)
        history.append(conversation_id, "assistant", response, user_id=user_id)
        return {"response": response, "conversation_id": conversation_id}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/edit")
def edit(req: EditRequest) -> dict[str, str]:
    try:
        prompt = (
            "You are editing source code in VS Code. Return only the updated code, no markdown.\n"
            f"Instruction:\n{req.instruction}\n\n"
            f"Original code:\n{req.code}"
        )
        return {"edited": _complete(prompt)}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/explain")
def explain(req: ExplainRequest) -> dict[str, str]:
    try:
        path = Path(req.file_path)
        if not path.exists() or not path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        text = path.read_text(encoding="utf-8")
        prompt = (
            "Explain the following code file for a developer. "
            "Summarize purpose, key functions, risks, and suggested improvements.\n\n"
            f"File: {path.name}\n"
            f"Code:\n{text[:12000]}"
        )
        return {"explanation": _complete(prompt)}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/remember")
def remember(req: RememberRequest) -> dict[str, str]:
    try:
        idx = memory.add(req.text, kind="note")
        return {"id": idx}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e
