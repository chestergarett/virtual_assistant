# virtual_assistant

Chester's personal virtual assistant — ElevenLabs voice receptionist with **custom React SDK UI**, **official embed widget**, and a FastAPI backend.

## Project structure

```
virtual_assistant/
├── agents/voice_receptionist.py
├── backend/main.py
└── frontend/
    ├── src/components/VoiceReceptionist.tsx   # Custom SDK — call & chat
    └── src/components/ElevenLabsWidget.tsx    # Official embed widget
```

## UI modes (all on one page)

| Tab | What it uses |
|-----|----------------|
| **Custom call** | [@elevenlabs/react](https://elevenlabs.io/docs/eleven-agents/libraries/react) — voice / WebRTC |
| **Custom chat** | [@elevenlabs/react](https://elevenlabs.io/docs/eleven-agents/libraries/react) — text / WebSocket |
| **Official widget** | [Embed widget](https://elevenlabs.io/docs/eleven-agents/customization/widget) |

## Agent authentication (private agent)

When **Authentication** is enabled in the [ElevenLabs agent Security tab](https://elevenlabs.io/docs/eleven-agents/customization/authentication), the API key must stay on the server. This app already wires that up:

| UI mode | Credential | Backend endpoint |
|---------|------------|------------------|
| **Custom call** | WebRTC conversation token | `GET /api/conversation-token` |
| **Custom chat** | Signed WebSocket URL | `GET /api/signed-url` |
| **Official widget** | Signed URL (fetched on each call) | `GET /api/signed-url` |

**Checklist after enabling auth in the dashboard:**

1. Set `ELEVENLABS_API_KEY` in `.env` (never in the frontend).
2. Set `ELEVENLABS_REQUIRES_AUTH=true` in `.env` (the backend also reads `enable_auth` from the dashboard when the API key is set).
3. Run the FastAPI backend on port 8000 so the Vite proxy can reach `/api/*`.
4. Click **Start call** or **Start chat** — the browser only receives short-lived tokens/URLs.

Signed URLs expire after **15 minutes**; start a new session to get a fresh one. Do not use signed URLs and allowlists on the same agent ([docs](https://elevenlabs.io/docs/eleven-agents/customization/authentication)).

## Setup

1. `cp .env.example .env` and set `ELEVENLABS_API_KEY`

2. **Backend** (project root) — use the project venv so webhook deps (`elevenlabs`, `supabase`) are available:

   ```bash
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   uvicorn backend.main:app --reload --port 8000
   ```

   Or without activating: `.venv/bin/uvicorn backend.main:app --reload --port 8000`

3. **Frontend**:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Open http://localhost:5173 and pick a tab.

## ElevenLabs dashboard

- **Advanced** → turn **off** “Text only” for voice.
- **Widget → Interface** → **Voice + text** (or Voice only) for the official widget tab.

## API endpoints

| Endpoint | Used by |
|----------|---------|
| `GET /api/agent/config` | All modes |
| `GET /api/conversation-token` | Custom call (SDK) |
| `GET /api/signed-url` | Custom chat (SDK) + widget (private auth) |
| `POST /webhooks/elevenlabs` | ElevenLabs post-call webhook (Supabase + email) |

## After-call: Supabase + email

When a recruiter finishes a call, ElevenLabs runs **data collection** on the transcript and sends a **post-call webhook**. This backend saves the lead and emails you.

### 1. ElevenLabs — data collection fields

In your agent → **Analysis** → **Data collection**, identifiers must match exactly:

| Identifier | Type | Description |
|------------|------|-------------|
| `recruiter_name` | string | Full name of the recruiter or caller |
| `recruiter_email` | string | Work email in user@domain.com format |
| `recruiting_company` | string | Company or agency name |
| `role_discussed` | string | Role or opportunity discussed on the call |
| `interest_level` | string | Recruiter interest level (e.g. high / medium / low) |

Call date is stored automatically from ElevenLabs metadata (`called_at`), not as a data-collection field.

### 2. ElevenAgents — enable post-call webhook

Use the **ElevenAgents** post-call webhook settings — **not** the general ElevenLabs API webhooks page (`Settings → Webhooks`). Those are for other products (e.g. speech-to-text) and will not send `post_call_transcription` events for agent calls.

**Docs:** [Post-call webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks)

1. Open [ElevenAgents → Settings](https://elevenlabs.io/app/agents/settings) (workspace post-call webhook settings).
2. Add your webhook URL — must include the path:
   ```text
   https://YOUR_PUBLIC_HOST/webhooks/elevenlabs
   ```
   Local dev: run `ngrok http 8000`, then use e.g. `https://abc123.ngrok-free.app/webhooks/elevenlabs` (not just the ngrok root URL).
3. Enable **`post_call_transcription`** only (skip `post_call_audio` unless you need full MP3 — payloads are very large).
4. Copy the **HMAC webhook secret** → `ELEVENLABS_WEBHOOK_SECRET` in `.env`.
5. Restart uvicorn after changing `.env`.

**After a call:** ElevenLabs analyzes the transcript first; the webhook usually arrives **30 seconds to 2 minutes** after you end the call. Your endpoint must return **HTTP 200** quickly (this app responds immediately and processes Supabase/email in the background).

**Verify:** Watch uvicorn for `ElevenLabs webhook received` or open the ngrok inspector at http://127.0.0.1:4040 and look for `POST /webhooks/elevenlabs` → 200.

**Check config:** `GET http://127.0.0.1:8000/api/integrations/status`

### 3. Supabase — table

In Supabase → **SQL Editor**, run `supabase/migrations/001_recruiter_calls.sql`.

Set in `.env`:

- `SUPABASE_URL` — Project Settings → API → Project URL
- `SUPABASE_SERVICE_ROLE_KEY` — **service_role** secret only (server only, never in frontend)

  Do **not** use the `anon` / `publishable` key here. If inserts fail with `row-level security policy`, you have the wrong key. Run `supabase/migrations/003_fix_rls_service_role.sql` after fixing the key.

### 4. Email

**Option A — Resend (simplest)**

1. Create an account at [resend.com](https://resend.com).
2. `RESEND_API_KEY`, `NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM` in `.env`.

**Option B — SMTP**

Set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` (and leave `RESEND_API_KEY` empty).

### 5. Install deps and test

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

End a test call in the UI; check Supabase **Table Editor → recruiter_calls** and your inbox.

## Deploy (Google Cloud Run)

See **[DEPLOY.md](./DEPLOY.md)** for the full ordered checklist (backend → frontend → CORS → ElevenAgents webhook).

```bash
./scripts/deploy-backend.sh    # API + copies .env → Cloud Run
./scripts/deploy-frontend.sh   # UI (uses VITE_API_BASE from .env)
# Set CORS_ORIGINS to FRONTEND_URL, then:
./scripts/deploy-backend.sh --env-only
```

## Docs

- [React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react)
- [Widget customization](https://elevenlabs.io/docs/eleven-agents/customization/widget)
- [Agent authentication](https://elevenlabs.io/docs/eleven-agents/customization/authentication)
- [Post-call webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks) (Supabase + email)
- [Data collection](https://elevenlabs.io/docs/eleven-agents/customization/agent-analysis/data-collection)
