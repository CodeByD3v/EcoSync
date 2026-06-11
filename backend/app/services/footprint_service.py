"""Footprint domain logic."""

from __future__ import annotations

from datetime import date
from functools import lru_cache

from app.data import mock_data
from app.schemas import DailyFootprint


class FootprintService:
    """Computes the daily footprint payload from the underlying data source."""

    def get_daily(self) -> DailyFootprint:
        total_kg = round(sum(c.kg for c in mock_data.BREAKDOWN), 1)
        return DailyFootprint(
            user_name=mock_data.USER_NAME,
            date=date.today().isoformat(),
            total_kg=total_kg,
            yesterday_kg=mock_data.YESTERDAY_KG,
            delta_kg=round(total_kg - mock_data.YESTERDAY_KG, 1),
            breakdown=mock_data.BREAKDOWN,
            trend=mock_data.TREND,
        )


@lru_cache
def get_footprint_service() -> FootprintService:
    """FastAPI dependency provider (cached as a singleton)."""

    return FootprintService()
