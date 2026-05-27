# Deploy to Google Cloud Run

Two services:

| Service | Script | URL env var |
|---------|--------|-------------|
| Backend (FastAPI) | `./scripts/deploy-backend.sh` | `BACKEND_URL` |
| Frontend (Vite + nginx) | `./scripts/deploy-frontend.sh` | `FRONTEND_URL` |

Env vars are read from the project root **`.env`** (never commit it).

---

## Prerequisites (one time)

1. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed (`gcloud` in PATH).

2. Log in and pick a project:

   ```bash
   gcloud auth login
   gcloud projects list
   ```

3. Copy env template and fill in secrets:

   ```bash
   cp .env.example .env
   ```

4. Add deploy settings to `.env`:

   ```env
   GCP_PROJECT_ID=your-gcp-project-id
   GCP_REGION=us-west1
   CLOUD_RUN_SERVICE_BACKEND=virtual-assistant-api
   CLOUD_RUN_SERVICE_FRONTEND=virtual-assistant-web
   ```

5. Ensure backend secrets are set in `.env` (ElevenLabs, Supabase **service_role**, email, etc.) — same as local dev.

6. Make scripts executable:

   ```bash
   chmod +x scripts/deploy-backend.sh scripts/deploy-frontend.sh scripts/dev-server.sh
   ```

---

## Deploy in order

### Step 1 — Deploy backend

```bash
./scripts/deploy-backend.sh
```

This will:

- Build and deploy the API to Cloud Run
- Copy allowed keys from `.env` into the service
- Print the backend URL and webhook URL
- Write `VITE_API_BASE` and `BACKEND_URL` into `.env` for the frontend build

Note the webhook URL:

```text
https://YOUR-BACKEND-xxx.run.app/webhooks/elevenlabs
```

### Step 2 — Deploy frontend

```bash
./scripts/deploy-frontend.sh
```

This builds the React app with `VITE_API_BASE` pointing at your Cloud Run backend and deploys nginx on Cloud Run.

It prints your **frontend URL** and saves `FRONTEND_URL` in `.env`.

### Step 3 — Fix CORS

The browser only allows your frontend origin to call the API. In `.env`:

```env
CORS_ORIGINS=https://your-frontend-service-xxxxx.run.app
```

Use the exact `FRONTEND_URL` (no trailing slash). Multiple origins: comma-separated.

Apply without rebuilding the image:

```bash
./scripts/deploy-backend.sh --env-only
```

### Step 4 — ElevenAgents post-call webhook

1. Open [ElevenAgents → Settings](https://elevenlabs.io/app/agents/settings) (**not** Settings → API Webhooks).

2. Set webhook URL to:

   ```text
   https://YOUR-BACKEND-xxx.run.app/webhooks/elevenlabs
   ```

3. Enable **post_call_transcription**.

4. Ensure `ELEVENLABS_WEBHOOK_SECRET` in `.env` matches the dashboard secret.

5. You can stop ngrok — production uses Cloud Run directly.

### Step 5 — Test

1. Open `FRONTEND_URL` in the browser.
2. Start a short call, end it, wait 1–2 minutes.
3. Check:
   - Cloud Run logs: `gcloud run services logs read virtual-assistant-api --region=us-west1`
   - Supabase → `recruiter_calls`
   - Your email inbox

---

## Redeploy after `.env` changes

| Change | Command |
|--------|---------|
| Backend secrets (API keys, SMTP, Supabase) | `./scripts/deploy-backend.sh --env-only` |
| Backend code | `./scripts/deploy-backend.sh` |
| Frontend only | `./scripts/deploy-frontend.sh` |
| CORS origins | Edit `CORS_ORIGINS` in `.env` → `./scripts/deploy-backend.sh --env-only` |

---

## Troubleshooting

**`PERMISSION_DENIED` on deploy (authenticated as your Gmail)**

Common causes:

1. **Cloud Build service account** — `gcloud run deploy --source` needs the Cloud Build SA to deploy images. As project Owner, run once:

   ```bash
   PROJECT_ID=chester-garett
   PN=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
   CB_SA="${PN}@cloudbuild.gserviceaccount.com"
   for ROLE in roles/run.admin roles/iam.serviceAccountUser roles/artifactregistry.writer roles/storage.admin; do
     gcloud projects add-iam-policy-binding $PROJECT_ID \
       --member="serviceAccount:${CB_SA}" --role="$ROLE" --quiet
   done
   ```

   Then retry `./scripts/deploy-backend.sh`.

2. **Fails at “Setting IAM Policy”** — `--allow-unauthenticated` adds `allUsers` as invoker. Some Google Workspace orgs block that via `iam.allowedPolicyMemberDomains`. Options:
   - Ask your org admin to allow public Cloud Run, or
   - Deploy without public access (not ideal for a public recruiter site).

3. **Billing** — Project must have billing enabled (Cloud Console → Billing).

**CORS error in browser**  
`CORS_ORIGINS` must match the frontend URL exactly (scheme + host, no trailing slash). Redeploy with `--env-only`.

**Webhook 401**  
`ELEVENLABS_WEBHOOK_SECRET` in Cloud Run does not match ElevenAgents settings.

**Supabase RLS error**  
Use **service_role** key in `SUPABASE_SERVICE_ROLE_KEY`, not anon.

**Email fails**  
Fix Gmail App Password / SMTP vars in `.env`, then `./scripts/deploy-backend.sh --env-only`.

**Frontend calls wrong API**  
Re-run `./scripts/deploy-backend.sh` then `./scripts/deploy-frontend.sh` so `VITE_API_BASE` is baked into the build.

---

## Cost notes

- Both services use `--min-instances=0` (scale to zero when idle).
- Typical personal traffic often stays within Cloud Run free tier.
