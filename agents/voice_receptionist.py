"""Voice receptionist agent — ElevenLabs config and session helpers."""

from __future__ import annotations

import os
from typing import Any

import httpx

# From your ElevenLabs dashboard / talk-to URL
AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID")
BRANCH_ID = os.getenv("ELEVENLABS_BRANCH_ID")

AGENT_NAME = "Voice Receptionist"
DESCRIPTION = (
    "Front-desk voice assistant that greets callers, answers common questions, "
    "and routes or schedules follow-ups."
)

# Set False only for local prototyping with a public agent (auth disabled in dashboard).
REQUIRES_AUTH = os.getenv("ELEVENLABS_REQUIRES_AUTH", "true").lower() in ("1", "true", "yes")

ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1"

# Client tool names must match exactly what you configure in the ElevenLabs agent UI.
CLIENT_TOOLS: list[dict[str, Any]] = [
    {
        "name": "displayMessage",
        "description": "Show a short message in the user's UI (e.g. confirmation or alert).",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "Message to display in the UI.",
                },
            },
            "required": ["text"],
        },
    },
]


def agent_config() -> dict[str, Any]:
    """Public agent metadata for the frontend (no secrets)."""
    return {
        "agent_id": AGENT_ID,
        "branch_id": BRANCH_ID,
        "name": AGENT_NAME,
        "description": DESCRIPTION,
        "requires_auth": REQUIRES_AUTH,
        "client_tools": [t["name"] for t in CLIENT_TOOLS],
    }


def _session_params(*, agent_id: str | None = None, branch_id: str | None = None) -> dict[str, str]:
    params: dict[str, str] = {"agent_id": agent_id or AGENT_ID or ""}
    bid = branch_id if branch_id is not None else BRANCH_ID
    if bid:
        params["branch_id"] = bid
    return params


async def get_conversation_token(
    api_key: str,
    *,
    agent_id: str | None = None,
    branch_id: str | None = None,
) -> str:
    """WebRTC conversation token for voice sessions (private agents)."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{ELEVENLABS_API_BASE}/convai/conversation/token",
            params=_session_params(agent_id=agent_id, branch_id=branch_id),
            headers={"xi-api-key": api_key},
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        token = data.get("token")
        if not token:
            raise ValueError("ElevenLabs response missing token")
        return token


async def get_agent_voice_status(
    api_key: str,
    *,
    agent_id: str | None = None,
) -> dict[str, Any]:
    """Read whether the agent is locked to text-only (chat) mode."""
    aid = agent_id or AGENT_ID
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{ELEVENLABS_API_BASE}/convai/agents/{aid}",
            headers={"xi-api-key": api_key},
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        conversation = (data.get("conversation_config") or {}).get("conversation") or {}
        text_only = bool(conversation.get("text_only"))
        return {
            "agent_id": aid,
            "text_only": text_only,
            "voice_enabled": not text_only,
        }


async def ensure_voice_mode(
    api_key: str,
    *,
    agent_id: str | None = None,
) -> dict[str, Any]:
    """Turn off agent-level text_only so the widget can use voice."""
    aid = agent_id or AGENT_ID
    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{ELEVENLABS_API_BASE}/convai/agents/{aid}",
            headers={"xi-api-key": api_key},
            json={
                "conversation_config": {
                    "conversation": {"text_only": False},
                },
            },
            timeout=30.0,
        )
        response.raise_for_status()
    status = await get_agent_voice_status(api_key, agent_id=aid)
    return {
        **status,
        "updated": True,
        "message": "Agent set to voice-capable (text_only=false).",
    }


async def get_signed_url(
    api_key: str,
    *,
    agent_id: str | None = None,
    branch_id: str | None = None,
) -> str:
    """Signed WebSocket URL for chat or WebSocket voice (private agents)."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{ELEVENLABS_API_BASE}/convai/conversation/get-signed-url",
            params=_session_params(agent_id=agent_id, branch_id=branch_id),
            headers={"xi-api-key": api_key},
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        signed_url = data.get("signed_url")
        if not signed_url:
            raise ValueError("ElevenLabs response missing signed_url")
        return signed_url
