from __future__ import annotations

import os
import shutil
import subprocess
import sys


def main() -> int:
    print(f"python: {sys.executable}")
    print(f"cuda_visible_devices: {os.getenv('CUDA_VISIBLE_DEVICES', '(not set)')}")

    try:
        import torch
    except Exception as exc:  # noqa: BLE001
        print(f"torch_import_error: {exc}")
        return 1

    print(f"torch: {torch.__version__}")
    print(f"torch_cuda_version: {torch.version.cuda}")
    print(f"cuda_available: {torch.cuda.is_available()}")
    print(f"device_count: {torch.cuda.device_count()}")

    if torch.cuda.is_available():
        print(f"device_0: {torch.cuda.get_device_name(0)}")

    nvcc_path = shutil.which("nvcc")
    print(f"nvcc: {nvcc_path or '(not found on PATH)'}")
    if nvcc_path:
        try:
            result = subprocess.run(
                [nvcc_path, "--version"],
                capture_output=True,
                text=True,
                check=False,
            )
            print(result.stdout.strip() or result.stderr.strip())
        except Exception as exc:  # noqa: BLE001
            print(f"nvcc_check_error: {exc}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
