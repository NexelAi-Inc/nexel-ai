from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass
class Settings:
    llm_backend: str
    llm_mode: str
    fast_backend: str
    smart_backend: str
    llama_cpp_model_path: str
    llama_cpp_n_ctx: int
    llama_cpp_n_threads: int
    llama_cpp_n_gpu_layers: int
    hf_model_id: str
    hf_device_map: str
    max_tokens: int
    temperature: float
    memory_dir: str
    cors_origins: list[str]



def load_settings() -> Settings:
    load_dotenv()

    return Settings(
        llm_backend=os.getenv("LLM_BACKEND", "dual").strip().lower(),
        llm_mode=os.getenv("LLM_MODE", "auto").strip().lower(),
        fast_backend=os.getenv("FAST_BACKEND", "transformers").strip().lower(),
        smart_backend=os.getenv("SMART_BACKEND", "llama_cpp").strip().lower(),
        llama_cpp_model_path=os.getenv("LLAMA_CPP_MODEL_PATH", "./models/model.gguf"),
        llama_cpp_n_ctx=int(os.getenv("LLAMA_CPP_N_CTX", "4096")),
        llama_cpp_n_threads=int(os.getenv("LLAMA_CPP_N_THREADS", "8")),
        llama_cpp_n_gpu_layers=int(os.getenv("LLAMA_CPP_N_GPU_LAYERS", "0")),
        hf_model_id=os.getenv("HF_MODEL_ID", "meta-llama/Meta-Llama-3-8B-Instruct"),
        hf_device_map=os.getenv("HF_DEVICE_MAP", "auto"),
        max_tokens=int(os.getenv("MAX_TOKENS", "512")),
        temperature=float(os.getenv("TEMPERATURE", "0.2")),
        memory_dir=os.getenv("MEMORY_DIR", "./data/chroma"),
        cors_origins=[
            origin.strip()
            for origin in os.getenv("CORS_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000,http://127.0.0.1:5173,http://localhost:5173").split(",")
            if origin.strip()
        ],
    )
