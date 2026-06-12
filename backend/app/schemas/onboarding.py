"""Schemas for the one-time onboarding flow."""

from __future__ import annotations

from pydantic import BaseModel


class GridFactors(BaseModel):
    """Regional electricity, transport, and average-footprint factors."""

    grid_kwh: float
    transport_km: float
    avg_annual_kg: int


class Permissions(BaseModel):
    """Optional automation connections the user can enable."""

    location: bool = False
    transactions: bool = False
    utility: bool = False


class OnboardingRequest(BaseModel):
    """Payload submitted when a user completes onboarding."""

    name: str
    city: str
    zip_code: str = ""
    diet: str  # meat_heavy | flexitarian | vegetarian | vegan
    commute: str  # drive | transit | two_wheeler | walk
    housing: str  # house | apartment | shared
    permissions: Permissions


class OnboardingResponse(BaseModel):
    """Result of onboarding, including the estimated annual footprint."""

    status: str
    name: str
    city: str
    zip_code: str = ""
    grid_factors: GridFactors
    estimated_annual_kg: int
    message: str
