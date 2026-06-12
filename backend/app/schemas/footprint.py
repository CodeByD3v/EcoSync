"""Schemas for the daily footprint and calculation endpoints."""

from __future__ import annotations

from enum import Enum
from typing import List
from pydantic import BaseModel, Field


class DietType(str, Enum):
    meat_heavy = "meat_heavy"
    mixed = "mixed"
    vegetarian = "vegetarian"
    vegan = "vegan"


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


class FootprintRequest(BaseModel):
    """All inputs needed to calculate an annual carbon footprint."""

    km_driven_per_week: float = Field(100.0, ge=0, le=2000, description="Average km driven by car per week")
    flights_per_year: int = Field(2, ge=0, le=50, description="Number of short-haul return flights per year")
    kwh_per_month: float = Field(200.0, ge=0, le=2000, description="Monthly household electricity consumption (kWh)")
    diet: DietType = Field(DietType.mixed, description="Primary diet type")
    new_items_per_month: int = Field(5, ge=0, le=100, description="New manufactured items purchased per month")
    country: str = Field("IN", description="ISO country code (used for grid mix, defaults to India)")

    class Config:
        json_schema_extra = {
            "example": {
                "km_driven_per_week": 100,
                "flights_per_year": 2,
                "kwh_per_month": 200,
                "diet": "mixed",
                "new_items_per_month": 5,
                "country": "IN"
            }
        }
