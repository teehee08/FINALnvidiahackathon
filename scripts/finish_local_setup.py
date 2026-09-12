"""Wait for downloads, start the local model, and check real resume generation."""
import json
import subprocess
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "data/local-model"
IMAGE = "nvcr.io/nvidia/vllm@sha256:9204569b17ee4c0eff75194b8e6e458479c8aee18953b5ab9cf359fcdac659e2"
LOG = ROOT / "data/local-setup.log"


def note(message):
    line = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()) + " " + message
    print(line, flush=True)
    with LOG.open("a") as stream:
        stream.write(line + "\n")


def docker(command):
    return subprocess.run(["sg", "docker", "-c", command], cwd=ROOT,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)


def model_ready():
    index = MODEL / "model.safetensors.index.json"
    if not index.exists() or not (MODEL / "tokenizer.json").exists():
        return False
    try:
        shards = set(json.loads(index.read_text())["weight_map"].values())
        return bool(shards) and all((MODEL / shard).is_file() for shard in shards)
    except (ValueError, KeyError):
        return False


note("Waiting for NVIDIA runtime and Qwen model downloads.")
deadline = time.monotonic() + 43200
while time.monotonic() < deadline:
    if model_ready() and docker("docker image inspect " + IMAGE).returncode == 0:
        break
    time.sleep(30)
else:
    raise RuntimeError("Downloads did not finish within 12 hours. Resume them and rerun this script.")

note("Downloads complete. Starting the GPU inference service.")
started = docker("bash /home/dell/tailored/scripts/start_local_model.sh")
if started.returncode:
    note(started.stdout)
    raise RuntimeError("Could not start the model container.")
note(started.stdout.strip())
deadline = time.monotonic() + 1800
while time.monotonic() < deadline:
    try:
        response = httpx.get("http://127.0.0.1:8000/v1/models", timeout=5)
        if response.status_code == 200 and response.json().get("data"):
            break
    except (httpx.HTTPError, ValueError):
        pass
    time.sleep(10)
else:
    note(docker("docker logs --tail 60 amelia-local-inference").stdout)
    raise RuntimeError("Model did not become ready within 30 minutes.")
note("Local inference endpoint is ready at http://127.0.0.1:8000/v1.")
with LOG.open("a") as stream:
    checked = subprocess.run(
        [str(ROOT / ".venv/bin/python"), "-m", "scripts.check_local_generation"],
        cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT,
    )
if checked.returncode:
    note("Generation check failed. See this log for the error; inference remains running.")
else:
    note("READY: resume PDF generation and follow-up refinement both passed.")
