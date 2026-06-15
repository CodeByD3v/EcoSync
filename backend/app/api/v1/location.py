"""Real-time location context routes."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.location_service import (
    connector_status,
    get_location_context,
    resolve_india_pin_code,
)

router = APIRouter(prefix="/location", tags=["location"])


class LocationRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class PinCodeRequest(BaseModel):
    zip_code: str = Field(..., pattern=r"^[1-9][0-9]{5}$")


@router.get("/connectors")
def location_connectors() -> dict:
    """Return the live connector requirements and readiness status."""
    return {"connectors": connector_status()}


@router.post("/pincode")
def resolve_pincode(payload: PinCodeRequest) -> dict:
    """Resolve an Indian PIN code to a real India Post location."""
    return resolve_india_pin_code(payload.zip_code)


@router.post("/context")
def location_context(payload: LocationRequest) -> dict:
    """Return real-time environmental context for the user's coordinates.

    Aggregates reverse geocoding, weather, air quality, grid carbon intensity,
    and neighborhood carbon averages — all from live APIs, no simulation.
    """
    try:
        ctx = get_location_context(payload.lat, payload.lng)
        return asdict(ctx)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/maps-config")
def maps_config() -> dict:
    """Return whether Google Maps frontend key is available for embedded maps."""
    from app.core.config import get_settings
    settings = get_settings()
    key = settings.google_maps_api_key
    has_key = bool(key and key.strip())
    return {
        "maps_enabled": has_key,
        "provider": "google_maps" if has_key else "none",
    }


class NeighborhoodRequest(BaseModel):
    lat: float | None = Field(None, ge=-90, le=90)
    lng: float | None = Field(None, ge=-180, le=180)
    zip_code: str | None = Field(None, pattern=r"^[1-9][0-9]{5}$")


@router.post("/neighborhood")
def neighborhood_comparison(payload: NeighborhoodRequest) -> dict:
    """Return neighborhood carbon benchmarks for a location.

    Accepts either lat/lng or an Indian PIN code. Returns the resolved
    city, its average annual carbon footprint, the national average,
    nearby city benchmarks, and current grid intensity.
    """
    from app.services.footprint_service import _static_lookup, lookup_grid_factor, EF
    from app.services.location_service import (
        reverse_geocode,
        resolve_india_pin_code,
        fetch_grid_intensity_for_coords,
        fetch_power_breakdown_for_coords,
    )

    city = ""
    state = ""
    zip_code = ""
    lat = payload.lat
    lng = payload.lng

    # Resolve location from PIN code or coordinates
    if payload.zip_code:
        try:
            pin_data = resolve_india_pin_code(payload.zip_code)
            city = pin_data.get("city", "")
            state = pin_data.get("state", "")
            zip_code = payload.zip_code
            if pin_data.get("lat") and pin_data.get("lng"):
                lat = pin_data["lat"]
                lng = pin_data["lng"]
        except HTTPException:
            raise
    elif lat is not None and lng is not None:
        geo = reverse_geocode(lat, lng)
        city = geo.get("city", "")
        state = geo.get("state", "")
        zip_code = geo.get("zip_code", "")
    else:
        raise HTTPException(
            status_code=422,
            detail="Provide either lat/lng coordinates or a valid Indian PIN code.",
        )

    # Get regional factors
    regional = _static_lookup(city)
    grid_factors = lookup_grid_factor(city)
    national_avg = EF["india_avg_annual"]

    # Get real-time grid data if coordinates available
    grid_live = {}
    power_live = {}
    if lat is not None and lng is not None:
        grid_live = fetch_grid_intensity_for_coords(lat, lng)
        power_live = fetch_power_breakdown_for_coords(lat, lng)

    # Nearby city benchmarks
    benchmark_cities = [
        {"city": "Mumbai", "avg_kg": 1900, "grid_kwh": 0.86},
        {"city": "Delhi", "avg_kg": 2100, "grid_kwh": 0.90},
        {"city": "Bengaluru", "avg_kg": 1850, "grid_kwh": 0.78},
        {"city": "Chennai", "avg_kg": 1750, "grid_kwh": 0.72},
        {"city": "Kolkata", "avg_kg": 2000, "grid_kwh": 0.88},
    ]

    return {
        "city": city,
        "state": state,
        "zip_code": zip_code,
        "lat": lat,
        "lng": lng,
        "neighborhood_avg_kg": regional.avg_annual_kg,
        "national_avg_kg": national_avg,
        "grid_intensity_kwh": grid_live.get("local_grid_intensity") or grid_factors.grid_kwh,
        "green_energy_pct": power_live.get("green_energy_pct"),
        "grid_source": grid_live.get("grid_source", "regional_table"),
        "benchmark_cities": benchmark_cities,
    }
