"""Onboarding routes.

Accepts the one-time onboarding payload, saves it to the SQLite database,
and returns an estimated annual carbon footprint.
"""

from __future__ import annotations

import json
import logging
import re
import urllib.request

from fastapi import APIRouter, HTTPException

from app.core import db_session
from app.schemas import OnboardingRequest, OnboardingResponse
from app.services.footprint_service import get_footprint_service

router = APIRouter(prefix="/onboard", tags=["onboarding"])
logger = logging.getLogger(__name__)

ALLOWED_COMMUTE = {"drive", "transit", "two_wheeler", "walk"}
ALLOWED_HOUSING = {"house", "apartment", "shared"}
ALLOWED_DIET = {"meat_heavy", "mixed", "flexitarian", "vegetarian", "vegan"}


def _resolve_india_pin_code(zip_code: str) -> dict | None:
    """Resolve an India Post PIN code to district/state details.

    Returns None only when the external API is unreachable, allowing onboarding
    to continue with the city typed by the user. Invalid API responses still
    produce a validation error.
    """
    url = f"https://api.postalpincode.in/pincode/{zip_code}"
    try:
        with urllib.request.urlopen(url, timeout=4) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        logger.warning("India Post PIN lookup failed for %s: %s", zip_code, exc)
        return None

    result = data[0] if isinstance(data, list) and data else {}
    post_offices = result.get("PostOffice") or []
    if result.get("Status") != "Success" or not post_offices:
        raise HTTPException(status_code=422, detail="Invalid Indian PIN code. No matching India Post records found.")

    office = post_offices[0]
    district = (office.get("District") or office.get("Name") or "").strip()
    state = (office.get("State") or "").strip()
    if not district:
        raise HTTPException(status_code=422, detail="Invalid Indian PIN code. India Post did not return a usable district.")

    return {"city": district, "state": state}


@router.post("", response_model=OnboardingResponse)
def onboard(payload: OnboardingRequest) -> OnboardingResponse:
    """Estimate user footprint and save profile preferences to SQLite."""

    if not re.match(r"^[1-9][0-9]{5}$", payload.zip_code):
        raise HTTPException(status_code=422, detail="Invalid Indian PIN code. Must be exactly 6 digits starting with 1-9.")
    resolved_location = _resolve_india_pin_code(payload.zip_code)
    resolved_city = resolved_location["city"] if resolved_location else payload.city.strip()
    if not resolved_city:
        raise HTTPException(status_code=422, detail="City is required when PIN code lookup is unavailable.")

    if payload.commute not in ALLOWED_COMMUTE:
        raise HTTPException(status_code=422, detail=f"Unknown commute: {payload.commute}")
    if payload.housing not in ALLOWED_HOUSING:
        raise HTTPException(status_code=422, detail=f"Unknown housing: {payload.housing}")
    if payload.diet not in ALLOWED_DIET:
        raise HTTPException(status_code=422, detail=f"Unknown diet: {payload.diet}")

    # 1. Map high-level questions to numeric sliders
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

    # 2. Calculate baseline using centralized service logic
    fp_service = get_footprint_service()
    calc_res = fp_service.calculate_co2_breakdown(
        city=resolved_city,
        km_driven_per_week=km_per_week,
        flights_per_year=flights,
        kwh_per_month=kwh_per_month,
        diet=diet_mapped,
        new_items_per_month=new_items,
    )
    total = calc_res["total_annual"]
    gf = calc_res["grid_factors"]

    # 3. Save to Database
    try:
        with db_session() as conn:
            cursor = conn.cursor()
            # Clear existing profile (simplifies local testing/re-onboarding)
            cursor.execute("DELETE FROM profile")
            cursor.execute(
                """
                INSERT INTO profile (name, city, zip_code, km_driven_per_week, flights_per_year, kwh_per_month, diet, new_items_per_month)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (payload.name, resolved_city, payload.zip_code, km_per_week, flights, kwh_per_month, diet_mapped, new_items)
            )
            # Reset all checklist items to incomplete for a new onboarding
            cursor.execute("UPDATE actions SET completed = 0")
            cursor.execute("UPDATE challenges SET progress = 0")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    comparison = "above" if total > gf.avg_annual_kg else "below"
    message = (
        f"Your baseline is set, {payload.name}! Your estimated footprint is "
        f"{total / 1000:.1f}t CO₂/yr — {comparison} the {resolved_city} average."
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
