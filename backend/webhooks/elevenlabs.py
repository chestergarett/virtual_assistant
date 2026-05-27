"""ElevenLabs post-call webhook receiver."""

from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import JSONResponse

from backend.config import get_settings
from backend.services.lead_processor import process_post_call_transcription

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _verify_event(raw_body: bytes, signature: str | None) -> dict:
    settings = get_settings()
    if not settings.elevenlabs_webhook_secret:
        raise HTTPException(
            status_code=500,
            detail="ELEVENLABS_WEBHOOK_SECRET is not set on the server.",
        )
    if not signature:
        raise HTTPException(status_code=400, detail="Missing elevenlabs-signature header")

    try:
        from elevenlabs import ElevenLabs
    except ModuleNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Python package 'elevenlabs' is not installed in this environment. "
                "Stop uvicorn and run: source .venv/bin/activate && pip install -r backend/requirements.txt "
                "Or: ./scripts/dev-server.sh"
            ),
        ) from exc

    client = ElevenLabs(api_key=settings.elevenlabs_api_key or "webhook-only")
    try:
        return client.webhooks.construct_event(
            raw_body.decode("utf-8"),
            signature,
            settings.elevenlabs_webhook_secret,
        )
    except Exception as exc:
        logger.warning("Webhook signature verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid webhook signature") from exc


@router.post("/elevenlabs")
async def elevenlabs_webhook(request: Request, background_tasks: BackgroundTasks) -> JSONResponse:
    """
    Receives post_call_transcription after each call.
    Returns 200 immediately; Supabase + email run in the background.
    """
    raw_body = await request.body()
    signature = request.headers.get("elevenlabs-signature") or request.headers.get(
        "ElevenLabs-Signature"
    )
    event = _verify_event(raw_body, signature)
    event_type = event.get("type")
    conv_id = (event.get("data") or {}).get("conversation_id", "?")
    logger.info("ElevenLabs webhook received: type=%s conversation_id=%s", event_type, conv_id)

    if event_type == "post_call_transcription":
        background_tasks.add_task(process_post_call_transcription, event)
        logger.info("Queued post-call processing for %s", conv_id)
    else:
        logger.info("Ignored ElevenLabs webhook type: %s", event_type)

    return JSONResponse({"status": "received"})
