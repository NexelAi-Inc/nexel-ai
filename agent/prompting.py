from __future__ import annotations

import re

CREATIVE_HINTS = (
    "story",
    "short story",
    "write me a story",
    "poem",
    "scene",
    "novel",
    "chapter",
    "fairy tale",
    "script",
    "screenplay",
    "monologue",
    "dialogue",
    "letter",
)

CONTINUATION_HINTS = (
    "continue",
    "go on",
    "keep going",
    "more",
    "next chapter",
    "continue the story",
    "continue it",
    "finish it",
)


def _trim_block(text: str, max_chars: int = 1200) -> str:
    text = text.strip()
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars].rstrip()}..."


def format_recent_turns(turns: list[dict[str, str]]) -> str:
    if not turns:
        return "(none)"

    lines: list[str] = []
    for turn in turns:
        role = turn.get("role", "unknown").strip().capitalize() or "Unknown"
        content = _trim_block(turn.get("content", ""))
        if content:
            lines.append(f"<turn role=\"{role.lower()}\">{content}</turn>")
    return "\n".join(lines) if lines else "(none)"


def build_general_chat_prompt(
    *,
    user_request: str,
    relevant_memory: str,
    recent_turns: list[dict[str, str]],
    signed_in_user: str | None = None,
    file_context: str | None = None,
    editor_context: str | None = None,
) -> str:
    blocks = [
        (
            "You are Nexa, the assistant inside the Nexel Chat workspace. "
            "Maintain continuity with the recent conversation when it is relevant. "
            "Answer naturally, stay on task, and use file or editor context only when it helps. "
            "The recent conversation is reference context only, not a transcript you should continue with speaker labels. "
            "Relevant memory contains only explicitly saved notes, so use it only when it is directly useful to the current request. "
            "If the user asks about their own name, preferences, or other personal facts and relevant memory contains the answer, answer directly and confidently from that memory. "
            "If signed-in user information is provided, treat it as trustworthy current context about who is speaking. "
            "Use the user's name naturally when it helps, but do not force it into every reply."
        ),
        f"Signed-in user:\n{signed_in_user or '(unknown)'}",
        f"Relevant memory:\n{relevant_memory or '(none)'}",
        f"Recent conversation:\n{format_recent_turns(recent_turns)}",
    ]

    if file_context is not None:
        blocks.append(f"Current file:\n{file_context}")
    if editor_context is not None:
        blocks.append(f"Editor context:\n{editor_context}")

    blocks.append(f"Current user request:\n{user_request}")
    return "\n\n".join(blocks)


def _looks_like_story_continuation(user_request: str, recent_turns: list[dict[str, str]]) -> bool:
    lowered = user_request.strip().lower()
    if lowered not in CONTINUATION_HINTS and not any(lowered.startswith(hint) for hint in CONTINUATION_HINTS):
        return False

    for turn in reversed(recent_turns):
        content = turn.get("content", "").strip().lower()
        if not content:
            continue
        if turn.get("role") == "user" and any(hint in content for hint in CREATIVE_HINTS):
            return True
        if turn.get("role") == "assistant" and len(content) > 500:
            return True
    return False


def is_creative_writing_request(user_request: str, recent_turns: list[dict[str, str]] | None = None) -> bool:
    lowered = user_request.strip().lower()
    if any(hint in lowered for hint in CREATIVE_HINTS):
        return True
    if recent_turns and _looks_like_story_continuation(lowered, recent_turns):
        return True
    return False


def build_creative_writing_prompt(
    *,
    user_request: str,
    recent_turns: list[dict[str, str]],
    relevant_memory: str = "(none)",
    signed_in_user: str | None = None,
) -> str:
    blocks = [
        (
            "You are Nexa, the creative-writing assistant inside Nexel Chat. "
            "Write vividly, coherently, and with emotional clarity. "
            "When the user asks for a story, poem, scene, or script, produce the piece directly instead of asking follow-up questions unless the request is truly unusable. "
            "Do not add preamble, explanation, or apology before the writing unless the user explicitly asks for commentary. "
            "If the user provides a title, use it. "
            "Prefer complete, satisfying pieces over outlines. "
            "Treat the current conversation as the story canon when it contains earlier story content, planning, names, world details, tone, or direction. "
            "If the user is continuing the same story, do not restart the story, do not repeat the opening, and do not contradict established names, plot points, or direction unless the user explicitly asks for a rewrite or reset. "
            "If the user reuses the same story title or refers to the same characters, assume they want continuity with the current conversation unless they clearly say otherwise. "
            "Extend the story forward in a natural way and keep the established direction synchronized. "
            "For continuation requests like 'continue' or 'go on', resume from the latest moment in the story instead of summarizing or restating what already happened."
        ),
        f"Signed-in user:\n{signed_in_user or '(unknown)'}",
        f"Relevant memory:\n{relevant_memory or '(none)'}",
        f"Recent conversation:\n{format_recent_turns(recent_turns)}",
        f"Creative writing request:\n{user_request}",
    ]
    return "\n\n".join(blocks)


def conversation_exchange_text(user_text: str, assistant_text: str) -> str:
    return (
        "Conversation memory\n"
        f"User: {_trim_block(user_text, max_chars=1000)}\n"
        f"Assistant: {_trim_block(assistant_text, max_chars=1000)}"
    )


PERSONAL_MEMORY_PATTERNS = (
    re.compile(r"\bmy\s+(?:name|anme)\s+is\s+([A-Za-z][A-Za-z0-9'_-]{1,31})\b", re.IGNORECASE),
    re.compile(r"\bcall\s+me\s+([A-Za-z][A-Za-z0-9'_-]{1,31})\b", re.IGNORECASE),
    re.compile(r"\bi\s+am\s+([A-Za-z][A-Za-z0-9'_-]{1,31})\b", re.IGNORECASE),
    re.compile(r"\bi'm\s+([A-Za-z][A-Za-z0-9'_-]{1,31})\b", re.IGNORECASE),
)


def extract_personal_memory(user_text: str) -> list[str]:
    text = user_text.strip()
    memories: list[str] = []

    for pattern in PERSONAL_MEMORY_PATTERNS:
        match = pattern.search(text)
        if match:
            name = match.group(1).strip()
            if len(name) >= 2:
                memories.append(f"The user's name is {name}.")
            break

    return memories
