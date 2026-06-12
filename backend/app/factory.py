"""Application factory: assembles the FastAPI app from its modules."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health
from app.api.v1 import api_router
from app.core import Settings, get_settings, init_db
from app.web import mount_spa


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    # Initialize the SQLite database
    init_db()

    app = FastAPI(
        title=settings.app_name,
        description="Carbon Footprint Awareness Platform API",
        version=settings.version,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routes: meta (health/info), versioned API, then the SPA catch-all last so
    # it never shadows an API path.
    app.include_router(health.router)
    app.include_router(api_router, prefix=settings.api_prefix)
    mount_spa(app, settings)

    return app
