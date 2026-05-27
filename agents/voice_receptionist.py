"""Voice receptionist agent — ElevenLabs config and session helpers."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

# Load .env before reading IDs (main.py may import this module before backend.config).
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# From your ElevenLabs dashboard / talk-to URL
AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID")
BRANCH_ID = os.getenv("ELEVENLABS_BRANCH_ID")

AGENT_NAME = "Chester AI"
DESCRIPTION = (
    "Chester Garett Calingacion is an AI Engineer based in Los Angeles, building document AI, LLM "
    "applications, generative media workflows, and automation with Python, AWS Bedrock, SageMaker, "
    "Vertex AI, LangChain, CrewAI, and n8n. "
    "He previously worked at JPMorgan Chase, Bluefletch, and Ernst & Young on process improvement, "
    "data engineering, analytics, and ETL using SQL, Alteryx, Tableau, Power BI, and BigQuery. "
    "He holds Databricks GenAI, AWS Machine Learning Specialty, and Azure AI certifications, "
    "along with a B.S. in Accountancy from Silliman University and CPA credentials."
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


async def get_agent_auth_settings(
    api_key: str,
    *,
    agent_id: str | None = None,
) -> dict[str, Any]:
    """Read agent authentication settings from the ElevenLabs dashboard."""
    aid = agent_id or AGENT_ID
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{ELEVENLABS_API_BASE}/convai/agents/{aid}",
            headers={"xi-api-key": api_key},
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        auth = (data.get("platform_settings") or {}).get("auth") or {}
        allowlist = [
            item.get("hostname")
            for item in (auth.get("allowlist") or [])
            if isinstance(item, dict) and item.get("hostname")
        ]
        return {
            "agent_id": aid,
            "enable_auth": bool(auth.get("enable_auth")),
            "allowlist_hostnames": allowlist,
        }


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
