from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Protocol

SYSTEM_PROMPT = (
    "You are Nexa, the assistant inside the Nexel Chat workspace. "
    "Be helpful, natural, practical, and conversational. "
    "Do not invent a different name, product identity, or hidden capabilities. "
    "Do not keep reintroducing yourself or repeating your name unless the user asks who you are. "
    "For greetings, casual chat, and simple questions, respond like a normal helpful assistant instead of giving a canned introduction. "
    "Keep greetings and identity answers short unless the user clearly wants more. "
    "Do not say 'again', 'nice to chat with you again', or similar returning-conversation phrasing unless it is genuinely helpful and clearly grounded in the current exchange. "
    "For social questions like 'how are you', reply warmly and briefly in a human, conversational way. "
    "Do not say you are 'just a computer program' unless the user is explicitly asking about consciousness, emotions, or identity limits. "
    "When the user shares something sad or personal, respond with clear empathy, warmth, and emotional presence. "
    "It is okay to sound supportive and gently therapeutic when the moment calls for it, as long as you stay grounded and sincere. "
    "If the user changes the subject, follow the new subject cleanly without forcing the earlier emotional topic back in. "
    "You can help with conversation, explanations, brainstorming, writing, summarization, planning, and coding. "
    "Do not list capabilities unless the user asks. "
    "Prefer short direct answers over long bullet lists unless the user explicitly wants a list. "
    "Avoid ending every reply with another question unless a question is actually useful. "
    "When the user makes a direct request that is clear enough to fulfill, do the task immediately instead of asking unnecessary clarifying questions. "
    "For creative writing requests such as stories, poems, scripts, letters, and scenes, write the piece right away unless the user explicitly asks to brainstorm first. "
    "Do not output speaker labels like 'User:' or 'Assistant:' unless the user explicitly asks for a transcript format. "
    "When the user asks for code, provide complete ready-to-use code when possible. "
    "When the user asks for non-coding help, do not force the conversation back to coding. "
    "Ask a clarifying question only when it is truly needed to give a good answer. "
    "If the user asks a general question, answer it directly without asking them to select a file first. "
    "Use code or editor context only when it is actually relevant. "
    "Only mention missing file context when the task truly requires seeing code."
)

SMART_HINT_WORDS = (
    "analyze",
    "architecture",
    "brainstorm",
    "build",
    "compare",
    "critique",
    "debug",
    "design",
    "explain",
    "feature",
    "fix",
    "implement",
    "improve",
    "plan",
    "product",
    "reason",
    "refactor",
    "review",
    "strategy",
    "story",
    "tradeoff",
    "write code",
    "poem",
    "script",
    "letter",
    "essay",
)


class LLM(Protocol):
    def complete(
        self,
        prompt: str,
        max_tokens: int = 512,
        temperature: float = 0.2,
        mode: str | None = None,
    ) -> str:
        ...


@dataclass
class LlamaCppBackend:
    model_path: str
    n_ctx: int
    n_threads: int
    n_gpu_layers: int

    def __post_init__(self) -> None:
        from llama_cpp import Llama

        self._llm = Llama(
            model_path=self.model_path,
            n_ctx=self.n_ctx,
            n_threads=self.n_threads,
            n_gpu_layers=self.n_gpu_layers,
            chat_format="llama-3",
            verbose=False,
        )

    def complete(
        self,
        prompt: str,
        max_tokens: int = 512,
        temperature: float = 0.2,
        mode: str | None = None,
    ) -> str:
        result = self._llm.create_chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return result["choices"][0]["message"]["content"].strip()


@dataclass
class TransformersBackend:
    model_id: str
    device_map: str

    def __post_init__(self) -> None:
        from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

        tokenizer = AutoTokenizer.from_pretrained(self.model_id)
        model = AutoModelForCausalLM.from_pretrained(self.model_id, device_map=self.device_map)

        self._pipe = pipeline("text-generation", model=model, tokenizer=tokenizer)

    def complete(
        self,
        prompt: str,
        max_tokens: int = 512,
        temperature: float = 0.2,
        mode: str | None = None,
    ) -> str:
        full_prompt = f"{SYSTEM_PROMPT}\n\n{prompt}"
        out = self._pipe(
            full_prompt,
            max_new_tokens=max_tokens,
            temperature=temperature,
            do_sample=temperature > 0,
        )
        text = out[0]["generated_text"]
        return text[len(full_prompt) :].strip() if text.startswith(full_prompt) else text.strip()


class RoutedBackend:
    def __init__(
        self,
        fast_factory: Callable[[], LLM],
        smart_factory: Callable[[], LLM],
        default_mode: str = "auto",
    ) -> None:
        self.fast_factory = fast_factory
        self.smart_factory = smart_factory
        self.default_mode = default_mode
        self._fast_backend: LLM | None = None
        self._smart_backend: LLM | None = None

    def _resolve_mode(self, prompt: str, requested_mode: str | None) -> str:
        mode = (requested_mode or self.default_mode or "auto").strip().lower()
        if mode in {"fast", "smart"}:
            return mode
        return self._infer_mode(prompt)

    def _infer_mode(self, prompt: str) -> str:
        prompt_lower = prompt.lower()
        if len(prompt) > 900:
            return "smart"
        if any(word in prompt_lower for word in SMART_HINT_WORDS):
            return "smart"
        if prompt.count("\n") > 12:
            return "smart"
        return "fast"

    def _get_backend(self, mode: str) -> LLM:
        if mode == "smart":
            if self._smart_backend is None:
                self._smart_backend = self.smart_factory()
            return self._smart_backend

        if self._fast_backend is None:
            self._fast_backend = self.fast_factory()
        return self._fast_backend

    def prewarm(self, mode: str = "fast") -> None:
        resolved = "smart" if mode == "smart" else "fast"
        self._get_backend(resolved)

    def complete(
        self,
        prompt: str,
        max_tokens: int = 512,
        temperature: float = 0.2,
        mode: str | None = None,
    ) -> str:
        resolved_mode = self._resolve_mode(prompt, mode)
        backend = self._get_backend(resolved_mode)
        return backend.complete(prompt, max_tokens=max_tokens, temperature=temperature, mode=resolved_mode)


def _build_single_backend(settings, backend_name: str) -> LLM:
    if backend_name == "transformers":
        return TransformersBackend(model_id=settings.hf_model_id, device_map=settings.hf_device_map)
    if backend_name == "llama_cpp":
        return LlamaCppBackend(
            model_path=settings.llama_cpp_model_path,
            n_ctx=settings.llama_cpp_n_ctx,
            n_threads=settings.llama_cpp_n_threads,
            n_gpu_layers=settings.llama_cpp_n_gpu_layers,
        )
    raise ValueError(f"Unsupported backend: {backend_name}")


def build_backend(settings) -> LLM:
    if settings.llm_backend == "dual":
        return RoutedBackend(
            fast_factory=lambda: _build_single_backend(settings, settings.fast_backend),
            smart_factory=lambda: _build_single_backend(settings, settings.smart_backend),
            default_mode=settings.llm_mode,
        )

    if settings.llm_backend == "transformers":
        return _build_single_backend(settings, "transformers")

    return _build_single_backend(settings, "llama_cpp")
