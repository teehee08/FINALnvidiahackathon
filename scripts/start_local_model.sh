#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
model_dir="$project_dir/data/local-model"
model_image="nvcr.io/nvidia/vllm@sha256:9204569b17ee4c0eff75194b8e6e458479c8aee18953b5ab9cf359fcdac659e2"
if [[ ! -f "$model_dir/model.safetensors.index.json" ]]; then
  echo "Model download is incomplete: $model_dir" >&2
  exit 1
fi
if docker container inspect amelia-local-inference >/dev/null 2>&1; then
  docker start amelia-local-inference
else
  docker run -d --name amelia-local-inference --restart unless-stopped \
    --device nvidia.com/gpu=all --ipc host \
    --ulimit memlock=-1 --ulimit stack=67108864 \
    -p 127.0.0.1:8000:8000 \
    -v "$model_dir:/model:ro" \
    --entrypoint /usr/local/bin/vllm "$model_image" \
    serve /model --served-model-name nvidia/Qwen3.6-35B-A3B-NVFP4 \
    --host 0.0.0.0 --port 8000 --max-model-len 32768 \
    --gpu-memory-utilization 0.4 --dtype auto --quantization modelopt \
    --kv-cache-dtype fp8 --attention-backend flashinfer --moe-backend marlin \
    --max-num-seqs 4 --max-num-batched-tokens 8192 --enable-chunked-prefill \
    --async-scheduling --enable-prefix-caching --reasoning-parser qwen3
fi
