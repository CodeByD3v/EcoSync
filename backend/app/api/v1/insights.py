"""Insights routes."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends

from app.schemas import Insight
from app.services import InsightsService, get_insights_service

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("", response_model=List[Insight])
def get_insights(
    service: InsightsService = Depends(get_insights_service),
) -> List[Insight]:
    """Return context-aware nudges and smart swaps for the user."""

    return service.list_insights()
