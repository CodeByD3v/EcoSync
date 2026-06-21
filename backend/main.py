"""EcoSync API entrypoint.

The application is assembled in :mod:`app.factory`. This module just exposes the
ASGI ``app`` for ``uvicorn main:app`` and supports ``python main.py`` for local
runs.
"""

from __future__ import annotations

import os
from dotenv import load_dotenv

# Load environment variables before initializing the FastAPI application
load_dotenv()

import uvicorn

from app import create_app

import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = create_app()


if __name__ == "__main__":
    from app.core import get_settings
    settings = get_settings()
    logging.getLogger(__name__).info(
        "Starting EcoSync API on port %s (reload=%s)", settings.port, settings.reload
    )
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.reload,
    )
