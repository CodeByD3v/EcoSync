"""Insights domain logic."""

from __future__ import annotations

from functools import lru_cache
from typing import List

from app.data import mock_data
from app.schemas import Insight


class InsightsService:
    """Serves context-aware nudges and smart swaps."""

    def list_insights(self) -> List[Insight]:
        return mock_data.INSIGHTS


@lru_cache
def get_insights_service() -> InsightsService:
    """FastAPI dependency provider (cached as a singleton)."""

    return InsightsService()
