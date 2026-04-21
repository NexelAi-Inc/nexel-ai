from __future__ import annotations

import json
import re
from pathlib import Path


class ChatHistoryStore:
    def __init__(self, persist_directory: str) -> None:
        self.root = Path(persist_directory)
        self.root.mkdir(parents=True, exist_ok=True)
        self.sessions_dir = self.root / "chat_sessions"
        self.sessions_dir.mkdir(parents=True, exist_ok=True)

    def _safe_name(self, value: str) -> str:
        return re.sub(r"[^a-zA-Z0-9._-]+", "_", value).strip("._") or "default"

    def _user_sessions_dir(self, user_id: str | None = None) -> Path:
        if not user_id:
            return self.sessions_dir
        user_dir = self.sessions_dir / self._safe_name(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir

    def _session_path(self, session_id: str, user_id: str | None = None) -> Path:
        safe_name = self._safe_name(session_id)
        return self._user_sessions_dir(user_id) / f"{safe_name}.json"

    def load(self, session_id: str, user_id: str | None = None) -> list[dict[str, str]]:
        path = self._session_path(session_id, user_id)
        if not path.exists():
            return []
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []
        if not isinstance(data, list):
            return []
        return [
            {"role": str(item.get("role", "unknown")), "content": str(item.get("content", ""))}
            for item in data
            if isinstance(item, dict) and item.get("content")
        ]

    def append(self, session_id: str, role: str, content: str, user_id: str | None = None) -> None:
        turns = self.load(session_id, user_id)
        turns.append({"role": role, "content": content})
        self._write(session_id, turns, user_id)

    def recent(self, session_id: str, limit: int = 10, user_id: str | None = None) -> list[dict[str, str]]:
        turns = self.load(session_id, user_id)
        if limit <= 0:
            return turns
        return turns[-limit:]

    def list_sessions(self, limit: int = 50, user_id: str | None = None) -> list[dict[str, str]]:
        sessions: list[dict[str, str]] = []
        sessions_dir = self._user_sessions_dir(user_id)
        for path in sorted(
            sessions_dir.glob("*.json"),
            key=lambda item: item.stat().st_mtime if item.exists() else 0,
            reverse=True,
        ):
            session_id = path.stem
            turns = self.load(session_id, user_id)
            if not turns:
                continue

            preview = ""
            for turn in turns:
                if turn.get("role") == "user" and turn.get("content"):
                    preview = turn["content"].strip()
                    break
            if not preview:
                preview = turns[-1].get("content", "").strip()

            sessions.append(
                {
                    "id": session_id,
                    "preview": preview[:80],
                    "updated_at": str(int(path.stat().st_mtime)),
                }
            )
            if len(sessions) >= limit:
                break
        return sessions

    def clear(self, session_id: str, user_id: str | None = None) -> None:
        path = self._session_path(session_id, user_id)
        if path.exists():
            path.unlink()

    def _write(self, session_id: str, turns: list[dict[str, str]], user_id: str | None = None) -> None:
        path = self._session_path(session_id, user_id)
        path.write_text(json.dumps(turns, indent=2), encoding="utf-8")
