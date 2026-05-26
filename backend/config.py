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
    cors_origins: list[str]
    host: str
    port: int

    def __init__(self) -> None:
        self.elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY", "")
        origins = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        )
        self.cors_origins = [o.strip() for o in origins.split(",") if o.strip()]
        self.host = os.getenv("BACKEND_HOST", "0.0.0.0")
        self.port = int(os.getenv("BACKEND_PORT", "8000"))
