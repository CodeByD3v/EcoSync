"""Onboarding routes."""

from __future__ import annotations

import logging
import re

from fastapi import APIRouter, HTTPException

from app.core import db_session
from app.schemas import OnboardingRequest, OnboardingResponse
from app.services.footprint_service import get_footprint_service
from app.services.location_service import resolve_india_pin_code

router = APIRouter(prefix="/onboard", tags=["onboarding"])
logger = logging.getLogger(__name__)

ALLOWED_COMMUTE = {"drive", "transit", "two_wheeler", "walk"}
ALLOWED_HOUSING = {"house", "apartment", "shared"}
ALLOWED_DIET    = {"meat_heavy", "mixed", "flexitarian", "vegetarian", "vegan"}


@router.post("", response_model=OnboardingResponse)
def onboard(payload: OnboardingRequest) -> OnboardingResponse:
    """Validate, calculate and persist the user's real baseline profile."""

    if not re.match(r"^[1-9][0-9]{5}$", payload.zip_code):
        raise HTTPException(
            status_code=422,
            detail="Invalid Indian PIN code. Must be exactly 6 digits starting with 1-9.",
        )

    resolved_location = resolve_india_pin_code(payload.zip_code)
    resolved_city     = resolved_location["city"] if resolved_location else payload.city.strip()
    if not resolved_city:
        raise HTTPException(
            status_code=422,
            detail="City is required when PIN code lookup is unavailable.",
        )

    if payload.commute not in ALLOWED_COMMUTE:
        raise HTTPException(status_code=422, detail=f"Unknown commute: {payload.commute}")
    if payload.housing not in ALLOWED_HOUSING:
        raise HTTPException(status_code=422, detail=f"Unknown housing: {payload.housing}")
    if payload.diet not in ALLOWED_DIET:
        raise HTTPException(status_code=422, detail=f"Unknown diet: {payload.diet}")

    # Map lifestyle choices  numeric inputs
    km_per_week = (
        200.0 if payload.commute == "drive" else
        120.0 if payload.commute == "two_wheeler" else
         50.0 if payload.commute == "transit" else
          0.0
    )
    kwh_per_month = (
        350.0 if payload.housing == "house" else
        200.0 if payload.housing == "apartment" else
        100.0
    )
    diet_mapped = "mixed" if payload.diet == "flexitarian" else payload.diet
    flights     = 2
    new_items   = 5

    fp_service = get_footprint_service()
    calc_res   = fp_service.calculate_co2_breakdown(
        city=resolved_city,
        km_driven_per_week=km_per_week,
        flights_per_year=flights,
        kwh_per_month=kwh_per_month,
        diet=diet_mapped,
        new_items_per_month=new_items,
    )
    total = calc_res["total_annual"]
    gf    = calc_res["grid_factors"]

    try:
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM profile")
            cursor.execute(
                """
                INSERT INTO profile
                    (name, city, zip_code, km_driven_per_week, flights_per_year,
                     kwh_per_month, diet, new_items_per_month, is_onboarded)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                """,
                #  KEY CHANGE: is_onboarded = 1 
                (payload.name, resolved_city, payload.zip_code,
                 km_per_week, flights, kwh_per_month, diet_mapped, new_items),
            )
            cursor.execute("UPDATE actions    SET completed = 0")
            cursor.execute("UPDATE challenges SET progress  = 0")
            cursor.execute("DELETE FROM history WHERE month != 'Jun'")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc

    comparison = "above" if total > gf.avg_annual_kg else "below"
    message    = (
        f"Your baseline is set, {payload.name}! "
        f"Your estimated footprint is {total / 1000:.1f}t CO/yr — "
        f"{comparison} the {resolved_city} average."
    )

    return OnboardingResponse(
        status="ok",
        name=payload.name,
        city=resolved_city,
        zip_code=payload.zip_code,
        grid_factors=gf,
        estimated_annual_kg=total,
        message=message,
    )
