#!/usr/bin/env bash
# Run backend with project .venv (includes elevenlabs + supabase for webhooks).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d .venv ]]; then
  echo "Create venv first: python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt"
  exit 1
fi

exec "$ROOT/.venv/bin/uvicorn" backend.main:app --reload --port 8000
