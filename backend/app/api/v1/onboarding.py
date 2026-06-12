"""Onboarding routes.

Accepts the one-time onboarding payload, saves it to the SQLite database,
and returns an estimated annual carbon footprint.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.db import get_db_connection
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
    """Estimate user footprint and save profile preferences to SQLite."""

    if payload.commute not in COMMUTE_MUL:
        raise HTTPException(status_code=422, detail=f"Unknown commute: {payload.commute}")
    if payload.housing not in HOUSING_MUL:
        raise HTTPException(status_code=422, detail=f"Unknown housing: {payload.housing}")
    if payload.diet not in DIET_KG:
        raise HTTPException(status_code=422, detail=f"Unknown diet: {payload.diet}")

    # 1. Look up regional factor
    gf = _lookup_grid_factor(payload.city)

    # 2. Map high-level questions to numeric sliders
    km_per_week = 200.0 if payload.commute == "drive" else (
        120.0 if payload.commute == "two_wheeler" else (
            50.0 if payload.commute == "transit" else 0.0
        )
    )
    kwh_per_month = 350.0 if payload.housing == "house" else (
        200.0 if payload.housing == "apartment" else 100.0
    )
    diet_mapped = "mixed" if payload.diet == "flexitarian" else payload.diet
    flights = 2
    new_items = 5

    # 3. Calculate baseline
    transport = round(15000 * gf.transport_km * COMMUTE_MUL[payload.commute])
    energy = round(200 * HOUSING_MUL[payload.housing] * 12 * gf.grid_kwh)
    diet = DIET_KG[payload.diet]
    shopping = round(5 * 12 * 6.5)
    total = transport + energy + diet + shopping

    # 4. Save to Database
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Clear existing profile (simplifies local testing/re-onboarding)
        cursor.execute("DELETE FROM profile")
        cursor.execute(
            """
            INSERT INTO profile (name, city, km_driven_per_week, flights_per_year, kwh_per_month, diet, new_items_per_month)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (payload.name, payload.city, km_per_week, flights, kwh_per_month, diet_mapped, new_items)
        )
        # Reset all checklist items to incomplete for a new onboarding
        cursor.execute("UPDATE actions SET completed = 0")
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        conn.close()

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
