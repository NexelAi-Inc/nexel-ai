from __future__ import annotations

from pathlib import Path

from .chat_history import ChatHistoryStore
from .config import load_settings
from .llm_backends import build_backend
from .memory import MemoryStore
from .prompting import build_creative_writing_prompt, build_general_chat_prompt, is_creative_writing_request
from .tools import AgentTools

HELP = """
Commands:
  /help                         Show this help
  /read <path>                  Read file relative to project root
  /write <path> <text>          Overwrite file with text
  /append <path> <text>         Append text to file
  /remember <text>              Store a memory note
  /recall <query>               Search memory notes
  /mode <auto|fast|smart>       Set chat mode
  /clearchat                    Clear remembered chat history
  /exit                         Quit

Everything else is sent to Nexa.
""".strip()



def _parse_two_part(payload: str) -> tuple[str, str]:
    parts = payload.strip().split(" ", 1)
    if len(parts) < 2:
        raise ValueError("Expected: <path> <text>")
    return parts[0], parts[1]



def run() -> None:
    settings = load_settings()
    project_root = Path.cwd()

    llm = build_backend(settings)
    memory = MemoryStore(settings.memory_dir)
    history = ChatHistoryStore(settings.memory_dir)
    session_id = "cli-default"
    tools = AgentTools(project_root)
    active_mode = settings.llm_mode

    print(f"Nexa is ready in {active_mode} mode. Type /help for commands.")

    while True:
        try:
            raw = input("\n>> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            break

        if not raw:
            continue

        if raw == "/exit":
            print("Bye.")
            break

        if raw == "/help":
            print(HELP)
            continue

        if raw.startswith("/read "):
            _, path = raw.split(" ", 1)
            print(tools.read_file(path))
            continue

        if raw.startswith("/write "):
            _, payload = raw.split(" ", 1)
            try:
                path, text = _parse_two_part(payload)
                print(tools.write_file(path, text))
            except ValueError as e:
                print(f"Error: {e}")
            continue

        if raw.startswith("/append "):
            _, payload = raw.split(" ", 1)
            try:
                path, text = _parse_two_part(payload)
                print(tools.append_file(path, text))
            except ValueError as e:
                print(f"Error: {e}")
            continue

        if raw.startswith("/remember "):
            _, text = raw.split(" ", 1)
            idx = memory.add(text, kind="note")
            print(f"Saved memory #{idx}")
            continue

        if raw.startswith("/recall "):
            _, query = raw.split(" ", 1)
            hits = memory.search(query, kind="note")
            if not hits:
                print("No memory hits.")
            else:
                print("Memory hits:")
                for item in hits:
                    print(f"- {item}")
            continue

        if raw.startswith("/mode "):
            _, mode = raw.split(" ", 1)
            mode = mode.strip().lower()
            if mode not in {"auto", "fast", "smart"}:
                print("Mode must be auto, fast, or smart.")
            else:
                active_mode = mode
                print(f"Mode set to {active_mode}.")
            continue

        if raw == "/clearchat":
            history.clear(session_id)
            print("Chat history cleared.")
            continue

        recent_turns = history.recent(session_id, limit=16)
        creative_request = is_creative_writing_request(raw, recent_turns)
        context_hits = memory.search(raw, n_results=3, kind="note")
        context = "\n".join(f"- {h}" for h in context_hits) if context_hits else "(none)"
        recent_turns = recent_turns if creative_request else recent_turns[-10:]
        prompt = (
            build_creative_writing_prompt(
                user_request=raw,
                relevant_memory=context,
                recent_turns=recent_turns,
            )
            if creative_request
            else build_general_chat_prompt(
                user_request=raw,
                relevant_memory=context,
                recent_turns=recent_turns,
            )
        )

        try:
            max_tokens = settings.max_tokens
            temperature = settings.temperature
            mode = active_mode
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
            history.append(session_id, "user", raw)
            history.append(session_id, "assistant", response)
            print(response)
        except Exception as e:  # noqa: BLE001
            print(f"Model error: {e}")


if __name__ == "__main__":
    run()
