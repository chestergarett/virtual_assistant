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

2. **Backend** (project root):

   ```bash
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   uvicorn backend.main:app --reload --port 8000
   ```

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

## Docs

- [React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react)
- [Widget customization](https://elevenlabs.io/docs/eleven-agents/customization/widget)
- [Agent authentication](https://elevenlabs.io/docs/eleven-agents/customization/authentication)
