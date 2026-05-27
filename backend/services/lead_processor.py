"""Parse ElevenLabs post-call webhooks, save leads to Supabase, send email."""

from __future__ import annotations

import base64
import json
import logging
import smtplib
from datetime import UTC, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import httpx

from backend.config import get_settings

logger = logging.getLogger(__name__)


def _jwt_role(api_key: str) -> str | None:
    """Decode JWT role claim (no verification — config check only)."""
    try:
        payload = api_key.split(".")[1]
        pad = "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload + pad))
        return data.get("role")
    except Exception:
        return None


def _collection_value(results: dict[str, Any], key: str) -> str | None:
    item = results.get(key)
    if item is None:
        return None
    if isinstance(item, dict):
        raw = item.get("value")
    else:
        raw = item
    if raw is None:
        return None
    text = str(raw).strip()
    return text or None


def _called_at_from_metadata(metadata: dict[str, Any]) -> str | None:
    start = metadata.get("start_time_unix_secs")
    if start is None:
        return None
    try:
        return datetime.fromtimestamp(int(start), tz=UTC).isoformat()
    except (TypeError, ValueError, OSError):
        return None


def parse_post_call_transcription(event: dict[str, Any]) -> dict[str, Any] | None:
    """Build a recruiter_calls row from a post_call_transcription webhook."""
    if event.get("type") != "post_call_transcription":
        return None

    data = event.get("data") or {}
    conversation_id = data.get("conversation_id")
    if not conversation_id:
        logger.warning("post_call_transcription missing conversation_id")
        return None

    analysis = data.get("analysis") or {}
    collection = analysis.get("data_collection_results") or {}
    metadata = data.get("metadata") or {}

    row: dict[str, Any] = {
        "conversation_id": conversation_id,
        "agent_id": data.get("agent_id"),
        "called_at": _called_at_from_metadata(metadata),
        "recruiter_name": _collection_value(collection, "recruiter_name"),
        "recruiter_email": _collection_value(collection, "recruiter_email"),
        "recruiting_company": _collection_value(collection, "recruiting_company"),
        "role_discussed": _collection_value(collection, "role_discussed"),
        "interest_level": _collection_value(collection, "interest_level"),
        "transcript_summary": analysis.get("transcript_summary"),
        "call_duration_secs": metadata.get("call_duration_secs"),
        "call_successful": analysis.get("call_successful"),
        "data_collection": collection,
    }
    return row


def save_recruiter_call(row: dict[str, Any]) -> None:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning("Supabase not configured; skipping database insert")
        return

    role = _jwt_role(settings.supabase_service_role_key)
    if role and role != "service_role":
        raise ValueError(
            f"SUPABASE_SERVICE_ROLE_KEY has JWT role '{role}', not 'service_role'. "
            "In Supabase → Project Settings → API, copy the service_role secret "
            "(not anon / publishable). See supabase/migrations/003_fix_rls_service_role.sql"
        )

    from supabase import create_client
    from postgrest.exceptions import APIError

    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    try:
        client.table("recruiter_calls").upsert(row, on_conflict="conversation_id").execute()
    except APIError as exc:
        if exc.code == "42501":
            raise ValueError(
                "Supabase rejected insert (row-level security). Use the service_role API key "
                "in SUPABASE_SERVICE_ROLE_KEY, not the anon/publishable key."
            ) from exc
        raise
    logger.info("Saved recruiter call %s to Supabase", row["conversation_id"])


def _format_called_at(row: dict[str, Any]) -> str:
    called_at = row.get("called_at")
    if not called_at:
        return "—"
    try:
        dt = datetime.fromisoformat(str(called_at).replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M UTC")
    except ValueError:
        return str(called_at)


def _build_email_bodies(row: dict[str, Any]) -> tuple[str, str, str]:
    name = row.get("recruiter_name") or "—"
    email = row.get("recruiter_email") or "—"
    company = row.get("recruiting_company") or "—"
    role = row.get("role_discussed") or "—"
    interest = row.get("interest_level") or "—"
    call_date = _format_called_at(row)
    summary = row.get("transcript_summary") or "No summary available."
    duration = row.get("call_duration_secs")
    duration_line = f"{duration}s" if duration is not None else "—"
    conv_id = row.get("conversation_id", "—")

    subject = f"New recruiter call — {name} ({company})"
    text = f"""New recruiter conversation captured.

Call date: {call_date}
Name: {name}
Email: {email}
Company: {company}
Role discussed: {role}
Interest level: {interest}
Duration: {duration_line}
Conversation ID: {conv_id}

Summary:
{summary}

View full record in Supabase table recruiter_calls.
"""
    html = f"""<h2>New recruiter conversation</h2>
<ul>
  <li><strong>Call date:</strong> {call_date}</li>
  <li><strong>Name:</strong> {name}</li>
  <li><strong>Email:</strong> {email}</li>
  <li><strong>Company:</strong> {company}</li>
  <li><strong>Role discussed:</strong> {role}</li>
  <li><strong>Interest level:</strong> {interest}</li>
  <li><strong>Duration:</strong> {duration_line}</li>
  <li><strong>Conversation ID:</strong> {conv_id}</li>
</ul>
<p><strong>Summary</strong></p>
<p>{summary}</p>
"""
    return subject, text, html


def send_recruiter_notification(row: dict[str, Any]) -> None:
    settings = get_settings()
    if not settings.notify_email_to:
        logger.warning("NOTIFY_EMAIL_TO not set; skipping email")
        return

    subject, text, html = _build_email_bodies(row)

    if settings.resend_api_key:
        _send_via_resend(
            api_key=settings.resend_api_key,
            from_email=settings.notify_email_from,
            to_email=settings.notify_email_to,
            subject=subject,
            text=text,
            html=html,
        )
        return

    if settings.smtp_host and settings.smtp_user and settings.smtp_password:
        _send_via_smtp(
            host=settings.smtp_host,
            port=settings.smtp_port,
            user=settings.smtp_user,
            password=settings.smtp_password,
            from_email=settings.notify_email_from or settings.smtp_user,
            to_email=settings.notify_email_to,
            subject=subject,
            text=text,
            html=html,
        )
        return

    logger.warning("No email provider configured (set RESEND_API_KEY or SMTP_* )")


def _send_via_resend(
    *,
    api_key: str,
    from_email: str,
    to_email: str,
    subject: str,
    text: str,
    html: str,
) -> None:
    if not from_email:
        raise ValueError("NOTIFY_EMAIL_FROM is required when using Resend")

    response = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "text": text,
            "html": html,
        },
        timeout=30.0,
    )
    response.raise_for_status()
    logger.info("Notification email sent via Resend to %s", to_email)


def _send_via_smtp(
    *,
    host: str,
    port: int,
    user: str,
    password: str,
    from_email: str,
    to_email: str,
    subject: str,
    text: str,
    html: str,
) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(from_email, [to_email], msg.as_string())
    except smtplib.SMTPAuthenticationError as exc:
        raise ValueError(
            "Gmail SMTP login failed (535). Use a Google App Password, not your normal "
            "Gmail password: https://myaccount.google.com/apppasswords — "
            "set SMTP_PASSWORD to the 16-character app password (no spaces). "
            "SMTP_USER must match NOTIFY_EMAIL_FROM."
        ) from exc

    logger.info("Notification email sent via SMTP to %s", to_email)


def process_post_call_transcription(event: dict[str, Any]) -> None:
    """Persist lead and notify Chester. Safe to call from a background task."""
    row = parse_post_call_transcription(event)
    if not row:
        logger.warning("post_call_transcription could not be parsed; nothing saved")
        return

    conv_id = row.get("conversation_id")
    logger.info("Processing post-call lead for conversation_id=%s", conv_id)

    try:
        save_recruiter_call(row)
        logger.info("Supabase save completed for %s", conv_id)
    except Exception:
        logger.exception("Failed to save recruiter call %s", conv_id)

    try:
        send_recruiter_notification(row)
        logger.info("Email notification completed for %s", conv_id)
    except Exception:
        logger.exception("Failed to send notification for %s", conv_id)
