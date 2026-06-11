"""Footprint routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.schemas import DailyFootprint
from app.services import FootprintService, get_footprint_service

router = APIRouter(prefix="/footprint", tags=["footprint"])


@router.get("/daily", response_model=DailyFootprint)
def get_daily_footprint(
    service: FootprintService = Depends(get_footprint_service),
) -> DailyFootprint:
    """Return the user's footprint for today, including the weekly trend."""

    return service.get_daily()
