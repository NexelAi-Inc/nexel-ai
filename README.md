# Nexel Ai

Nexel Ai is the public website and account entry point. Nexel Chat is the protected AI workspace for signed-in users.

## What you get

- `transformers` backend with CUDA support for Hugging Face models
- Optional `llama-cpp-python` backend for quantized GGUF models
- Public `Nexel Ai` website and protected `Nexel Chat` workspace
- React + Vite frontend under `web/`
- Netlify-ready static frontend build
- Simple tool-enabled REPL loop
- Lightweight memory via ChromaDB

## 1) Requirements

- Python 3.10 or 3.11
- Windows PowerShell
- 16GB RAM minimum, 32GB recommended
- NVIDIA GPU optional (helps a lot)

## 2) Setup

```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Then edit `.env`.

### CUDA setup

The working GPU path in this repo is the `transformers` backend. With the
current setup, CUDA is enabled when:

```powershell
LLM_BACKEND=transformers
HF_MODEL_ID=Qwen/Qwen2.5-Coder-1.5B-Instruct
HF_DEVICE_MAP=auto
```

You can verify that PyTorch sees your GPU with:

```powershell
.\venv\Scripts\python.exe .\scripts\verify_cuda.py
```

### Optional CUDA setup for `llama_cpp`

If you want local GPU acceleration with NVIDIA CUDA, install a CUDA-enabled
build of `llama-cpp-python` instead of a CPU-only wheel. The repo is now
configured to request GPU offload by default with:

```powershell
LLAMA_CPP_N_GPU_LAYERS=-1
```

If your current install is CPU-only, reinstall `llama-cpp-python` with CUDA
support in an environment that has a working Python interpreter, Visual Studio
Build Tools, CMake, and the NVIDIA CUDA toolkit available:

```powershell
$env:CMAKE_ARGS="-DGGML_CUDA=on"
$env:FORCE_CMAKE="1"
pip install --upgrade --force-reinstall --no-cache-dir llama-cpp-python
```

If startup fails after enabling GPU offload, set `LLAMA_CPP_N_GPU_LAYERS` to a
smaller positive number such as `20`, `35`, or `40` to fit your VRAM.

### Optional local GGUF path (quantized)

1. Download a compatible GGUF model into `models/`
2. Set `LLAMA_CPP_MODEL_PATH` in `.env`
3. Set `LLM_BACKEND=llama_cpp`

### Optional HF path

- Set `LLM_BACKEND=transformers`
- Set `HF_MODEL_ID` (default points to Llama 3 8B Instruct)
- Ensure you accepted model license on Hugging Face

## 3) Run (Web App)

```powershell
.\venv\Scripts\python.exe .\launcher.py
```

That starts the local web server and opens Nexel Ai in your browser. It serves the built React app from `web/dist`.

Shortcut:

```powershell
.\run_web.ps1
```

`run_web.ps1` is the recommended entry point. It installs frontend dependencies if needed, builds the Vite app, and then launches the Python server.

### Frontend development

The web UI now lives in `web/` as a React + Vite app.

Install frontend dependencies:

```powershell
cd web
npm install
```

Run the frontend dev server:

```powershell
npm run dev
```

Build the frontend for the integrated Python app:

```powershell
npm run build
```

If you launch the Python server without a built frontend, the root route returns a clear error telling you to build `web/dist` first.

### Netlify deployment

Deploy the repository to Netlify as the frontend site. The root [netlify.toml](netlify.toml) is already configured:

- Build command: `cd web && npm install && npm run build`
- Publish directory: `web/dist`

If you prefer setting `web/` as the Netlify base directory, the included [web/netlify.toml](web/netlify.toml) also works.

Set these environment variables in Netlify:

```text
VITE_API_BASE_URL=https://your-api-host.example.com
VITE_FIREBASE_DATABASE_URL=https://nexel-ai-default-rtdb.firebaseio.com
```

`VITE_API_BASE_URL` must point to the hosted API for Nexel Chat. If it is blank, the frontend uses same-origin requests, which is useful for local development through `launcher.py` but not enough for a static Netlify deployment unless the API is proxied.

On the API host, add the Netlify domain to `CORS_ORIGINS` in `.env`, for example:

```text
CORS_ORIGINS=http://127.0.0.1:8000,http://localhost:5173,https://your-netlify-site.netlify.app
```

Optional terminal mode:

```powershell
.\venv\Scripts\python.exe .\launcher.py --cli
```

Optional API-only mode:

```powershell
.\run_api.ps1
```

## 4) VS Code Extension Mode (Cursor-like)

Backend API:

```powershell
.\run_api.ps1
```

Extension build/install:

```powershell
cd nexa-vscode
npm install
npm run build
npm run package
code --install-extension .\nexa-vscode-0.1.2.vsix
```

Commands in VS Code command palette:

- `Nexa: Ask AI`
- `Nexa: Edit Selection`
- `Nexa: Explain Current File`

## 5) Commands inside REPL

- `/help` show commands
- `/read <path>` read file
- `/write <path> <text>` write/overwrite file content
- `/append <path> <text>` append text
- `/remember <text>` store memory note
- `/recall <query>` search memory
- `/exit` quit

## Notes

- This starter avoids dangerous shell execution by default.
- Expand tools incrementally after you trust behavior.
- Desktop Tk and Windows installer files were removed in favor of the web app flow.
