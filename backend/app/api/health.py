"""Health and service-metadata routes (not versioned)."""

from __future__ import annotations

from typing import Dict

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings

router = APIRouter(tags=["meta"])


@router.get("/health")
def health() -> Dict[str, str]:
    return {"status": "healthy"}


@router.get("/api")
def api_info(settings: Settings = Depends(get_settings)) -> Dict[str, str]:
    return {"service": settings.app_name, "version": settings.version, "docs": "/docs"}
