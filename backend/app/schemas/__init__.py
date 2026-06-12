"""Pydantic schemas for the EcoSync API."""

from app.schemas.actions import (
    ActionItem,
    CompleteActionRequest,
    CompleteActionResponse,
)
from app.schemas.footprint import (
    CategoryBreakdown,
    DailyFootprint,
    TrendPoint,
    DietType,
    FootprintRequest,
)
from app.schemas.insights import Insight
from app.schemas.onboarding import OnboardingRequest, OnboardingResponse

__all__ = [
    "ActionItem",
    "CompleteActionRequest",
    "CompleteActionResponse",
    "CategoryBreakdown",
    "DailyFootprint",
    "TrendPoint",
    "DietType",
    "FootprintRequest",
    "Insight",
    "OnboardingRequest",
    "OnboardingResponse",
]
