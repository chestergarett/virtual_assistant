"""FastAPI backend — ElevenLabs session tokens and agent config."""

from __future__ import annotations

import sys
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from agents.voice_receptionist import (  # noqa: E402
    REQUIRES_AUTH,
    agent_config,
    ensure_voice_mode,
    get_agent_auth_settings,
    get_agent_voice_status,
    get_conversation_token,
    get_signed_url,
)
from backend.config import get_settings  # noqa: E402

app = FastAPI(
    title="Virtual Assistant API",
    description="Backend for Chester's ElevenLabs voice receptionist",
    version="0.1.0",
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/agent/config")
async def read_agent_config() -> dict:
    """Public agent metadata; syncs requires_auth with the ElevenLabs dashboard when possible."""
    cfg = agent_config()
    if not settings.elevenlabs_api_key:
        cfg["auth_note"] = (
            "Set ELEVENLABS_API_KEY on the server to issue signed URLs / conversation tokens."
        )
        return cfg

    try:
        auth = await get_agent_auth_settings(settings.elevenlabs_api_key)
        dashboard_auth = auth["enable_auth"]
        cfg["requires_auth"] = dashboard_auth
        cfg["dashboard_auth_enabled"] = dashboard_auth
        cfg["allowlist_hostnames"] = auth["allowlist_hostnames"]
        if dashboard_auth != REQUIRES_AUTH:
            cfg["auth_config_mismatch"] = (
                f".env ELEVENLABS_REQUIRES_AUTH={REQUIRES_AUTH} but dashboard enable_auth={dashboard_auth}. "
                "Using dashboard value."
            )
        if dashboard_auth:
            cfg["auth_note"] = (
                "Private agent: the frontend requests short-lived credentials from this backend "
                "(never expose ELEVENLABS_API_KEY in the browser)."
            )
        elif auth["allowlist_hostnames"]:
            cfg["auth_note"] = (
                "Allowlist-only agent: ensure your app origin is on the dashboard allowlist."
            )
    except httpx.HTTPStatusError as exc:
        cfg["auth_note"] = f"Could not read dashboard auth settings ({exc.response.status_code})."
    except Exception as exc:
        cfg["auth_note"] = f"Could not read dashboard auth settings: {exc}"

    return cfg


@app.get("/api/conversation-token")
async def conversation_token() -> dict[str, str]:
    """Issue a WebRTC token for voice conversations (keeps API key server-side)."""
    if not settings.elevenlabs_api_key:
        raise HTTPException(
            status_code=500,
            detail="ELEVENLABS_API_KEY is not set on the server.",
        )
    try:
        token = await get_conversation_token(settings.elevenlabs_api_key)
        return {"token": token}
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=exc.response.text,
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/signed-url")
async def signed_url() -> dict[str, str]:
    """Issue a signed WebSocket URL (text-only or WebSocket voice)."""
    if not settings.elevenlabs_api_key:
        raise HTTPException(
            status_code=500,
            detail="ELEVENLABS_API_KEY is not set on the server.",
        )
    try:
        url = await get_signed_url(settings.elevenlabs_api_key)
        return {"signed_url": url}
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=exc.response.text,
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
