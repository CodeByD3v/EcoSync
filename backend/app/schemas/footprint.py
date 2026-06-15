"""Schemas for the daily footprint and calculation endpoints."""

from __future__ import annotations

from enum import Enum
from typing import List
from pydantic import BaseModel, Field


class DietType(str, Enum):
    meat_heavy  = "meat_heavy"
    mixed       = "mixed"
    vegetarian  = "vegetarian"
    vegan       = "vegan"


class TrendPoint(BaseModel):
    label: str
    value: float


class CategoryBreakdown(BaseModel):
    name:       str
    percentage: float
    kg:         float
    color:      str


class DailyFootprint(BaseModel):
    """The user's footprint for a single day plus the monthly trend.

    is_calculated is True only when the numbers were derived from a real
    onboarding submission.  It is False when the profile row is the startup
    seed (is_onboarded = 0 in SQLite), which means the frontend should hide
    panels like the Translation Engine that would otherwise show meaningless
    placeholder values.
    """

    user_name:     str
    date:          str
    total_kg:      float
    yesterday_kg:  float
    delta_kg:      float = Field(..., description="Negative = improvement vs previous month.")
    unit:          str   = "kg CO2e"
    breakdown:     List[CategoryBreakdown]
    trend:         List[TrendPoint]
    #  NEW 
    is_calculated: bool  = Field(
        False,
        description=(
            "True when total_kg was computed from a real user onboarding. "
            "False when using the startup seed profile."
        ),
    )


class FootprintRequest(BaseModel):
    """All inputs needed to calculate an annual carbon footprint."""

    km_driven_per_week:  float    = Field(100.0, ge=0,  le=2000)
    flights_per_year:    int      = Field(2,     ge=0,  le=50)
    kwh_per_month:       float    = Field(200.0, ge=0,  le=2000)
    diet:                DietType = Field(DietType.mixed)
    new_items_per_month: int      = Field(5,     ge=0,  le=100)
    country:             str      = Field("IN")

    class Config:
        json_schema_extra = {
            "example": {
                "km_driven_per_week": 100,
                "flights_per_year": 2,
                "kwh_per_month": 200,
                "diet": "mixed",
                "new_items_per_month": 5,
                "country": "IN",
            }
        }
