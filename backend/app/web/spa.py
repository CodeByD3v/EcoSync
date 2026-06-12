"""Serve the compiled React single-page app from the FastAPI process.

When the built frontend is present (production Docker image), the whole
platform runs as one Cloud Run service and the SPA's relative ``/api`` calls
are same-origin. In local dev the static dir is absent and Vite serves the UI.
"""

from __future__ import annotations

from typing import Dict

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core import Settings


def mount_spa(app: FastAPI, settings: Settings) -> None:
    if not settings.serve_frontend:
        # Dev mode: expose API metadata at root instead of the SPA.
        @app.get("/", include_in_schema=False)
        def root() -> Dict[str, str]:
            return {"service": settings.app_name, "docs": "/docs"}

        return

    static_dir = settings.static_dir
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str) -> FileResponse:
        """Serve a static file, falling back to index.html for client routes."""

        candidate = static_dir / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(static_dir / "index.html")
