"""EcoSync API entrypoint.

The application is assembled in :mod:`app.factory`. This module just exposes the
ASGI ``app`` for ``uvicorn main:app`` and supports ``python main.py`` for local
runs.
"""

from __future__ import annotations

import os

import uvicorn

from app import create_app

app = create_app()


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=bool(os.getenv("ECOSYNC_RELOAD")),
    )
