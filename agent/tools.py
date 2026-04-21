from __future__ import annotations

from pathlib import Path


class ToolResult(str):
    pass


class AgentTools:
    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root.resolve()

    def _resolve_safe(self, path_str: str) -> Path:
        path = (self.project_root / path_str).resolve()
        if self.project_root not in path.parents and path != self.project_root:
            raise ValueError("Path escapes project root")
        return path

    def read_file(self, path_str: str) -> ToolResult:
        path = self._resolve_safe(path_str)
        if not path.exists() or not path.is_file():
            return ToolResult(f"File not found: {path_str}")
        return ToolResult(path.read_text(encoding="utf-8"))

    def write_file(self, path_str: str, content: str) -> ToolResult:
        path = self._resolve_safe(path_str)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return ToolResult(f"Wrote {len(content)} chars to {path_str}")

    def append_file(self, path_str: str, content: str) -> ToolResult:
        path = self._resolve_safe(path_str)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(content)
        return ToolResult(f"Appended {len(content)} chars to {path_str}")
