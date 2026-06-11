"""Schemas for the daily footprint endpoint."""

from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class TrendPoint(BaseModel):
    """A single point on the weekly CO2 trend line (kg of CO2e)."""

    label: str
    value: float


class CategoryBreakdown(BaseModel):
    """Percentage and absolute contribution of one footprint category."""

    name: str
    percentage: float
    kg: float
    color: str


class DailyFootprint(BaseModel):
    """The user's footprint for a single day plus the weekly trend."""

    user_name: str
    date: str
    total_kg: float
    yesterday_kg: float
    delta_kg: float = Field(
        ..., description="Change vs. yesterday. Negative means an improvement."
    )
    unit: str = "kg CO2e"
    breakdown: List[CategoryBreakdown]
    trend: List[TrendPoint]
