from __future__ import annotations

import argparse
import os
import sys
import threading
import webbrowser
from pathlib import Path

import uvicorn

from agent.main import run


def _ensure_cuda_runtime_path() -> None:
    if os.name != "nt":
        return

    candidates: list[Path] = []

    cuda_path = os.environ.get("CUDA_PATH")
    if cuda_path:
        cuda_root = Path(cuda_path)
        candidates.extend([cuda_root / "bin", cuda_root / "bin" / "x64"])

    common_roots = (
        Path(r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA"),
        Path(r"C:\Program Files\NVIDIA\CUDAToolkit"),
    )

    for root in common_roots:
        if not root.exists():
            continue
        for version_dir in sorted((p for p in root.iterdir() if p.is_dir()), reverse=True):
            candidates.extend([version_dir / "bin", version_dir / "bin" / "x64"])
            break

    seen: set[str] = set()
    valid_dirs: list[str] = []
    for candidate in candidates:
        candidate_str = str(candidate)
        if candidate.exists() and candidate_str not in seen:
            seen.add(candidate_str)
            valid_dirs.append(candidate_str)
            add_dll_directory = getattr(os, "add_dll_directory", None)
            if add_dll_directory is not None:
                add_dll_directory(candidate_str)

    if valid_dirs:
        os.environ["PATH"] = os.pathsep.join(valid_dirs + [os.environ.get("PATH", "")])


def _normalize_working_directory() -> None:
    if not getattr(sys, "frozen", False):
        return

    exe_dir = Path(sys.executable).resolve().parent
    candidates = [Path.cwd(), exe_dir, exe_dir.parent]
    for base in candidates:
        if (base / ".env").exists() or (base / "models").exists():
            os.chdir(base)
            break


def _open_browser_later(url: str) -> None:
    timer = threading.Timer(1.0, lambda: webbrowser.open(url))
    timer.daemon = True
    timer.start()


def main() -> None:
    parser = argparse.ArgumentParser(description="Launch Nexa in web or CLI mode.")
    parser.add_argument("--cli", action="store_true", help="Run terminal mode instead of the web app.")
    parser.add_argument("--host", default="127.0.0.1", help="Web host to bind.")
    parser.add_argument("--port", type=int, default=8000, help="Web port to bind.")
    parser.add_argument("--no-browser", action="store_true", help="Do not auto-open the browser.")
    args = parser.parse_args()

    _normalize_working_directory()
    _ensure_cuda_runtime_path()

    if args.cli:
        run()
        return

    url = f"http://{args.host}:{args.port}"
    if not args.no_browser:
        _open_browser_later(url)

    uvicorn.run("agent.api:app", host=args.host, port=args.port, reload=False)


if __name__ == "__main__":
    main()
