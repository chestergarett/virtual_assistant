#!/usr/bin/env bash
# Deploy FastAPI backend to Google Cloud Run; env vars from project .env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=lib/load-env.sh
source "$ROOT/scripts/lib/load-env.sh"
load_project_env "$ROOT"

ENV_ONLY=false
if [[ "${1:-}" == "--env-only" ]]; then
  ENV_ONLY=true
fi

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID in .env}"
: "${GCP_REGION:=us-west1}"
: "${CLOUD_RUN_SERVICE_BACKEND:=virtual-assistant-api}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

BACKEND_ENV_KEYS="ELEVENLABS_API_KEY,ELEVENLABS_AGENT_ID,ELEVENLABS_BRANCH_ID,ELEVENLABS_REQUIRES_AUTH,ELEVENLABS_WEBHOOK_SECRET,SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,NOTIFY_EMAIL_TO,NOTIFY_EMAIL_FROM,RESEND_API_KEY,SMTP_HOST,SMTP_PORT,SMTP_USER,SMTP_PASSWORD,CORS_ORIGINS"

ENV_YAML="$(mktemp)"
trap 'rm -f "$ENV_YAML"' EXIT

python3 "$ROOT/scripts/lib/env-to-cloudrun-yaml.py" "$ROOT/.env" "$BACKEND_ENV_KEYS" >"$ENV_YAML"

if [[ ! -s "$ENV_YAML" ]]; then
  echo "No backend env vars found in .env (check required keys)." >&2
  exit 1
fi

gcloud config set project "$GCP_PROJECT_ID" >/dev/null

echo "==> Enabling required APIs (idempotent)..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  --project="$GCP_PROJECT_ID" >/dev/null

if [[ "$ENV_ONLY" == true ]]; then
  echo "==> Updating env vars only on $CLOUD_RUN_SERVICE_BACKEND..."
  gcloud run services update "$CLOUD_RUN_SERVICE_BACKEND" \
    --project="$GCP_PROJECT_ID" \
    --region="$GCP_REGION" \
    --env-vars-file="$ENV_YAML"
else
  echo "==> Building and deploying backend to Cloud Run..."
  gcloud run deploy "$CLOUD_RUN_SERVICE_BACKEND" \
    --project="$GCP_PROJECT_ID" \
    --region="$GCP_REGION" \
    --source="$ROOT" \
    --env-vars-file="$ENV_YAML" \
    --allow-unauthenticated \
    --port=8080 \
    --memory=512Mi \
    --timeout=120 \
    --max-instances=3 \
    --min-instances=0
fi

BACKEND_URL="$(
  gcloud run services describe "$CLOUD_RUN_SERVICE_BACKEND" \
    --project="$GCP_PROJECT_ID" \
    --region="$GCP_REGION" \
    --format='value(status.url)'
)"

echo ""
echo "Backend deployed: $BACKEND_URL"
echo "Webhook URL for ElevenAgents:"
echo "  ${BACKEND_URL}/webhooks/elevenlabs"
echo ""

# Keep VITE_API_BASE in .env in sync for the frontend deploy script
python3 - <<PY
from pathlib import Path
import re

env_path = Path("$ROOT/.env")
text = env_path.read_text()
url = "$BACKEND_URL"
if re.search(r"^VITE_API_BASE=", text, re.M):
    text = re.sub(r"^VITE_API_BASE=.*$", f"VITE_API_BASE={url}", text, flags=re.M)
else:
    text = text.rstrip() + f"\nVITE_API_BASE={url}\n"
if re.search(r"^BACKEND_URL=", text, re.M):
    text = re.sub(r"^BACKEND_URL=.*$", f"BACKEND_URL={url}", text, flags=re.M)
else:
    text = text.rstrip() + f"\nBACKEND_URL={url}\n"
env_path.write_text(text)
print(f"Updated .env: VITE_API_BASE and BACKEND_URL={url}")
PY

echo ""
echo "Next steps:"
echo "  1. Deploy frontend:  ./scripts/deploy-frontend.sh"
echo "  2. Set CORS_ORIGINS in .env to your frontend URL (no trailing slash)"
echo "  3. ./scripts/deploy-backend.sh --env-only"
echo "  4. Update ElevenAgents webhook URL (see above)"
