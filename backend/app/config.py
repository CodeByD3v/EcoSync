"""Application configuration.

Settings are read from the environment so the same image runs unchanged in
local dev, CI and on Cloud Run.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# backend/ directory (two levels up from this file: app/config.py -> backend/).
BACKEND_DIR = Path(__file__).resolve().parent.parent


def _csv_env(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    """Immutable, environment-driven application settings."""

    app_name: str = "EcoSync API"
    version: str = "1.0.0"
    api_prefix: str = "/api/v1"

    # In production the frontend is served from the same origin, so the default
    # demo policy is permissive; tighten ECOSYNC_CORS_ORIGINS before going live.
    cors_origins: list[str] = field(
        default_factory=lambda: _csv_env("ECOSYNC_CORS_ORIGINS", "*")
    )

    # Directory holding the compiled React app (created by the Docker build).
    static_dir: Path = field(
        default_factory=lambda: Path(
            os.getenv("ECOSYNC_STATIC_DIR", BACKEND_DIR / "static")
        )
    )

    # Database Path configuration
    db_path: Path = field(
        default_factory=lambda: Path(
            os.getenv("ECOSYNC_DB_PATH", BACKEND_DIR / "ecosync.db")
        )
    )

    # LLM Settings
    gemini_api_key: str | None = field(
        default_factory=lambda: os.getenv("GEMINI_API_KEY")
    )
    llm_model: str = field(
        default_factory=lambda: os.getenv("LLM_MODEL", "gemini-1.5-flash")
    )
    llm_temperature: float = field(
        default_factory=lambda: float(os.getenv("LLM_TEMPERATURE", "0.2"))
    )

    # Server settings (used by main.py)
    port: int = field(
        default_factory=lambda: int(os.getenv("PORT", "8000"))
    )
    reload: bool = field(
        default_factory=lambda: os.getenv("ECOSYNC_RELOAD", "True").lower() in ("true", "1", "yes")
    )

    @property
    def serve_frontend(self) -> bool:
        return self.static_dir.is_dir()


def get_settings() -> Settings:
    return Settings()

