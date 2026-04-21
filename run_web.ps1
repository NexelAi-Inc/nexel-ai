$ErrorActionPreference = "Stop"

$python = ".\venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    throw "Virtualenv Python not found at $python"
}

$frontend = ".\web"
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "npm is required to build the React frontend."
}

Push-Location $frontend
try {
    if (-not (Test-Path ".\node_modules")) {
        & npm.cmd install
    }
    & npm.cmd run build
}
finally {
    Pop-Location
}

& $python .\launcher.py
