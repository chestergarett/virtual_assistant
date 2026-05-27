import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


@lru_cache
def get_settings() -> "Settings":
    return Settings()


class Settings:
    elevenlabs_api_key: str
    elevenlabs_webhook_secret: str
    cors_origins: list[str]
    host: str
    port: int
    supabase_url: str
    supabase_service_role_key: str
    notify_email_to: str
    notify_email_from: str
    resend_api_key: str
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str

    def __init__(self) -> None:
        self.elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY", "")
        self.elevenlabs_webhook_secret = os.getenv("ELEVENLABS_WEBHOOK_SECRET", "")
        origins = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        )
        self.cors_origins = [o.strip() for o in origins.split(",") if o.strip()]
        self.host = os.getenv("BACKEND_HOST", "0.0.0.0")
        self.port = int(os.getenv("BACKEND_PORT", "8000"))
        self.supabase_url = os.getenv("SUPABASE_URL", "")
        self.supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.notify_email_to = os.getenv("NOTIFY_EMAIL_TO", "")
        self.notify_email_from = os.getenv("NOTIFY_EMAIL_FROM", "")
        self.resend_api_key = os.getenv("RESEND_API_KEY", "")
        self.smtp_host = os.getenv("SMTP_HOST", "")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
