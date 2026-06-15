"""Footprint routes."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.schemas import DailyFootprint, FootprintRequest
from app.services import FootprintService, get_footprint_service
from app.services.footprint_service import EF
from app.services.location_service import connector_status

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
    service.update_profile(payload.model_dump(mode='json'))
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



class MobilitySync(BaseModel):
    source: Literal["google_fit", "manual_connector", "other"] = "manual_connector"
    distance_km: float = Field(..., ge=0)
    period_days: float = Field(7, gt=0, le=366)


class UtilitySync(BaseModel):
    source: Literal["utility_api", "smart_meter", "manual_connector", "other"] = "manual_connector"
    kwh: float = Field(..., ge=0)
    period_days: float = Field(30, gt=0, le=366)


class TravelSync(BaseModel):
    source: Literal["plaid", "travel_provider", "manual_connector", "other"] = "manual_connector"
    flights: int = Field(..., ge=0, le=50)


class ShoppingSync(BaseModel):
    source: Literal["plaid", "manual_connector", "other"] = "manual_connector"
    new_items: int = Field(..., ge=0, le=100)


class ConnectorSyncRequest(BaseModel):
    """Real connector payload normalized by an authenticated integration."""

    mobility: MobilitySync | None = None
    utility: UtilitySync | None = None
    travel: TravelSync | None = None
    shopping: ShoppingSync | None = None


@router.get("/connectors")
def get_footprint_connectors() -> dict:
    """Return the automated footprint connector readiness status."""
    return {"connectors": connector_status(), "sync_endpoint": "/api/v1/footprint/sync"}


@router.post("/sync")
def sync_realtime_footprint(
    payload: ConnectorSyncRequest,
    service: FootprintService = Depends(get_footprint_service),
) -> dict:
    """Ingest real provider data and recalculate the footprint."""
    sync_data = payload.model_dump(mode="json", exclude_none=True)
    if not sync_data:
        raise HTTPException(status_code=422, detail="At least one connector payload is required.")

    result = service.apply_connector_sync(sync_data)
    return {"status": "ok", **result, "footprint": service.get_daily()}

