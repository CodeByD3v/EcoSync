"""Onboarding routes.

Accepts the one-time onboarding payload and returns an estimated annual carbon
footprint. The grid-factor lookup and calculation intentionally mirror the
frontend (``frontend/src/lib/gridFactors.js`` and ``Onboarding.jsx``) so the
estimate shown during onboarding matches the server-side result.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas import OnboardingRequest, OnboardingResponse
from app.schemas.onboarding import GridFactors

router = APIRouter(prefix="/onboard", tags=["onboarding"])

_REGIONS = [
    (("mumbai", "pune", "maharashtra"), GridFactors(grid_kwh=0.86, transport_km=0.19, avg_annual_kg=1900)),
    (("delhi", "noida", "gurgaon"), GridFactors(grid_kwh=0.90, transport_km=0.22, avg_annual_kg=2100)),
    (("bengaluru", "hyderabad"), GridFactors(grid_kwh=0.78, transport_km=0.18, avg_annual_kg=1850)),
    (("chennai", "kochi", "kerala"), GridFactors(grid_kwh=0.72, transport_km=0.17, avg_annual_kg=1750)),
    (("kolkata",), GridFactors(grid_kwh=0.88, transport_km=0.20, avg_annual_kg=2000)),
]
_INDIA_FALLBACK = GridFactors(grid_kwh=0.82, transport_km=0.21, avg_annual_kg=2000)

COMMUTE_MUL = {"drive": 1.0, "transit": 0.15, "two_wheeler": 0.35, "walk": 0.0}
HOUSING_MUL = {"house": 1.3, "apartment": 1.0, "shared": 0.7}
DIET_KG = {"meat_heavy": 2500, "flexitarian": 1500, "vegetarian": 700, "vegan": 300}


def _lookup_grid_factor(city: str) -> GridFactors:
    needle = city.strip().lower()
    for keys, factors in _REGIONS:
        if any(key in needle for key in keys):
            return factors
    return _INDIA_FALLBACK


@router.post("", response_model=OnboardingResponse)
def onboard(payload: OnboardingRequest) -> OnboardingResponse:
    """Estimate the user's annual footprint from their onboarding answers."""

    if payload.commute not in COMMUTE_MUL:
        raise HTTPException(status_code=422, detail=f"Unknown commute: {payload.commute}")
    if payload.housing not in HOUSING_MUL:
        raise HTTPException(status_code=422, detail=f"Unknown housing: {payload.housing}")
    if payload.diet not in DIET_KG:
        raise HTTPException(status_code=422, detail=f"Unknown diet: {payload.diet}")

    gf = _lookup_grid_factor(payload.city)

    transport = round(15000 * gf.transport_km * COMMUTE_MUL[payload.commute])
    energy = round(200 * HOUSING_MUL[payload.housing] * 12 * gf.grid_kwh)
    diet = DIET_KG[payload.diet]
    shopping = round(5 * 12 * 6.5)
    total = transport + energy + diet + shopping

    comparison = "above" if total > gf.avg_annual_kg else "below"
    message = (
        f"Your baseline is set, {payload.name}! Your estimated footprint is "
        f"{total / 1000:.1f}t CO₂/yr — {comparison} the {payload.city} average."
    )

    return OnboardingResponse(
        status="ok",
        name=payload.name,
        city=payload.city,
        grid_factors=gf,
        estimated_annual_kg=total,
        message=message,
    )
