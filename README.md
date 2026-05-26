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
