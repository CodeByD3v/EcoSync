"""Footprint routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.schemas import DailyFootprint, FootprintRequest
from app.services import FootprintService, get_footprint_service
from app.services.footprint_service import EF

router = APIRouter(prefix="/footprint", tags=["footprint"])


@router.get("/daily", response_model=DailyFootprint)
def get_daily_footprint(
    service: FootprintService = Depends(get_footprint_service),
) -> DailyFootprint:
    """Return the user's footprint for today, including the monthly trend."""
    return service.get_daily()


@router.post("/calculate", response_model=DailyFootprint)
def calculate_footprint(
    payload: FootprintRequest,
    service: FootprintService = Depends(get_footprint_service),
) -> DailyFootprint:
    """Update user profile parameters in database and return recalculated footprint."""
    # 1. Update SQLite with new lifestyle slider positions
    service.update_profile(payload.model_dump())
    # 2. Return recalculated profile state
    return service.get_daily()


@router.get("/profile", response_model=dict)
def get_user_profile(
    service: FootprintService = Depends(get_footprint_service),
) -> dict:
    """Return the raw user settings and parameter baselines for the calculator."""
    return service.get_profile()


@router.get("/emission-factors", tags=["reference"])
def get_emission_factors():
    """Return the emission factors used in calculations. Useful for transparency."""
    return {
        "factors": EF,
        "sources": [
            "EPA Emission Factors for Greenhouse Gas Inventories (2023)",
            "IPCC AR6 — Transportation Chapter",
            "India Central Electricity Authority Grid Emission Factor (2023)",
            "Carbon Independent — Food & Diet Calculator",
        ]
    }


@router.get("/demo/automated-tracking", tags=["demo"])
def demo_automated_tracking():
    """Simulates what Plaid + Google Fit integration would return."""
    return {
        "note": (
            "This endpoint simulates automated API integrations. In production, data is "
            "pulled from Plaid (financial transactions) and Google Fit (mobility detection) — "
            "no manual input required."
        ),
        "simulated_sources": {
            "plaid_transactions": {
                "petrol_stations_spend_inr": 3200,
                "flights_booked": 2,
                "grocery_stores_spend_inr": 8400,
                "fast_fashion_spend_inr": 1500,
            },
            "google_fit_mobility": {
                "avg_km_driven_per_week": 87,
                "cycling_km_this_month": 42,
                "walking_km_this_month": 18,
            },
            "smart_home": {
                "kwh_this_month": 214,
                "solar_generated_kwh": 0,
            }
        },
        "derived_inputs": {
            "km_driven_per_week": 87,
            "flights_per_year": 2,
            "kwh_per_month": 214,
            "diet": "mixed",
            "new_items_per_month": 4
        }
    }


class TelemetryTickRequest(BaseModel):
    event_type: str


@router.post("/telemetry-tick", response_model=DailyFootprint)
def telemetry_tick(
    payload: TelemetryTickRequest,
    service: FootprintService = Depends(get_footprint_service),
) -> DailyFootprint:
    """Processes a simulated background telemetry event and recalculates footprint."""
    service.process_telemetry_tick(payload.event_type)
    return service.get_daily()
