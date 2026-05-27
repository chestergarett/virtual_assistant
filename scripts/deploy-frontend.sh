#!/usr/bin/env bash
# Deploy Vite frontend to Google Cloud Run; VITE_API_BASE from .env (set by deploy-backend.sh)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=lib/load-env.sh
source "$ROOT/scripts/lib/load-env.sh"
load_project_env "$ROOT"

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID in .env}"
: "${GCP_REGION:=us-west1}"
: "${CLOUD_RUN_SERVICE_FRONTEND:=virtual-assistant-web}"
: "${VITE_API_BASE:?Run ./scripts/deploy-backend.sh first to set VITE_API_BASE}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

gcloud config set project "$GCP_PROJECT_ID" >/dev/null

echo "==> Building frontend with VITE_API_BASE=$VITE_API_BASE"
echo "==> Deploying to Cloud Run service: $CLOUD_RUN_SERVICE_FRONTEND"

gcloud run deploy "$CLOUD_RUN_SERVICE_FRONTEND" \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" \
  --source="$ROOT/frontend" \
  --set-build-env-vars="VITE_API_BASE=${VITE_API_BASE}" \
  --allow-unauthenticated \
  --port=8080 \
  --memory=256Mi \
  --max-instances=3 \
  --min-instances=0

FRONTEND_URL="$(
  gcloud run services describe "$CLOUD_RUN_SERVICE_FRONTEND" \
    --project="$GCP_PROJECT_ID" \
    --region="$GCP_REGION" \
    --format='value(status.url)'
)"

python3 - <<PY
from pathlib import Path
import re

env_path = Path("$ROOT/.env")
text = env_path.read_text()
url = "$FRONTEND_URL"
if re.search(r"^FRONTEND_URL=", text, re.M):
    text = re.sub(r"^FRONTEND_URL=.*$", f"FRONTEND_URL={url}", text, flags=re.M)
else:
    text = text.rstrip() + f"\nFRONTEND_URL={url}\n"
env_path.write_text(text)
print(f"Updated .env: FRONTEND_URL={url}")
PY

echo ""
echo "Frontend deployed: $FRONTEND_URL"
echo ""
echo "Next steps:"
echo "  1. In .env set:"
echo "       CORS_ORIGINS=${FRONTEND_URL}"
echo "     (comma-separate multiple origins if needed)"
echo "  2. Apply CORS to backend:"
echo "       ./scripts/deploy-backend.sh --env-only"
echo "  3. ElevenAgents → Settings → post-call webhook:"
echo "       ${VITE_API_BASE}/webhooks/elevenlabs"
echo "  4. Open the app: ${FRONTEND_URL}"
