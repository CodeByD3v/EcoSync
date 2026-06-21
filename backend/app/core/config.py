"""Application configuration.

Settings are read from the environment so the same image runs unchanged in
local dev, CI and on Cloud Run.
"""

from __future__ import annotations

import os
from functools import lru_cache
from dataclasses import dataclass, field
from pathlib import Path

# backend/ directory (three levels up from this file: app/core/config.py -> backend/).
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


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
        default_factory=lambda: os.getenv("LLM_MODEL", "gemini-2.0-flash-exp")
    )
    llm_temperature: float = field(
        default_factory=lambda: float(os.getenv("LLM_TEMPERATURE", "0.2"))
    )

    # Real-time external API connectors.
    electricity_maps_api_key: str | None = field(
        default_factory=lambda: os.getenv("ELECTRICITY_MAPS_API_KEY")
    )
    openweather_api_key: str | None = field(
        default_factory=lambda: os.getenv("OPENWEATHER_API_KEY")
    )
    google_maps_api_key: str | None = field(
        default_factory=lambda: os.getenv("GOOGLE_MAPS_API_KEY")
    )
    plaid_client_id: str | None = field(
        default_factory=lambda: os.getenv("PLAID_CLIENT_ID")
    )
    plaid_secret: str | None = field(
        default_factory=lambda: os.getenv("PLAID_SECRET")
    )
    plaid_env: str = field(
        default_factory=lambda: os.getenv("PLAID_ENV", "sandbox")
    )
    google_fit_client_id: str | None = field(
        default_factory=lambda: os.getenv("GOOGLE_FIT_CLIENT_ID")
    )
    google_fit_client_secret: str | None = field(
        default_factory=lambda: os.getenv("GOOGLE_FIT_CLIENT_SECRET")
    )
    utility_api_base_url: str | None = field(
        default_factory=lambda: os.getenv("UTILITY_API_BASE_URL")
    )
    utility_api_key: str | None = field(
        default_factory=lambda: os.getenv("UTILITY_API_KEY")
    )
    connector_timeout_seconds: float = field(
        default_factory=lambda: float(os.getenv("ECOSYNC_CONNECTOR_TIMEOUT_SECONDS", "5"))
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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings (reads env vars once on first call)."""
    return Settings()
