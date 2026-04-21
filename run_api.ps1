$ErrorActionPreference = "Stop"

$python = ".\venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    throw "Virtualenv Python not found at $python"
}

& $python -m uvicorn agent.api:app --host 127.0.0.1 --port 8000 --reload
