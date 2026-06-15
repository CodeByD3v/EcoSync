"""Real-time location and neighborhood carbon context service.

Uses browser geolocation (lat/lng sent from frontend), India Post PIN code API,
and OpenWeatherMap for local environmental data. Provides neighborhood-level
carbon context without any simulation.
"""

from __future__ import annotations

import logging
import json
from urllib.parse import urlencode
import urllib.request
from dataclasses import dataclass

from fastapi import HTTPException

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class LocationContext:
    city: str = ""
    state: str = ""
    country: str = "IN"
    lat: float = 0.0
    lng: float = 0.0
    zip_code: str = ""
    air_quality_index: int | None = None
    temperature_c: float | None = None
    humidity: int | None = None
    weather_desc: str = ""
    # Neighborhood carbon context
    local_grid_intensity: float | None = None
    neighborhood_avg_kg: float = 2000.0
    green_energy_pct: float | None = None
    sources: dict | None = None
    connector_status: dict | None = None


def _is_configured(value: str | None) -> bool:
    return bool(value and value.strip())


def _read_json(url: str, headers: dict | None = None, timeout: float = 5) -> dict | list:
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def connector_status() -> dict:
    """Return connector readiness without exposing secrets."""
    settings = get_settings()
    return {
        "browser_geolocation": {
            "configured": True,
            "required_env": [],
            "provider": "Browser Geolocation API",
        },
        "reverse_geocoding": {
            "configured": True,
            "required_env": ["GOOGLE_MAPS_API_KEY"],
            "provider": "Google Maps Geocoding when configured, OpenStreetMap Nominatim fallback",
        },
        "pin_code": {
            "configured": True,
            "required_env": [],
            "provider": "India Post public PIN API",
        },
        "weather_air_quality": {
            "configured": _is_configured(settings.openweather_api_key),
            "required_env": ["OPENWEATHER_API_KEY"],
            "provider": "OpenWeatherMap Current Weather + Air Pollution APIs",
        },
        "grid_carbon": {
            "configured": _is_configured(settings.electricity_maps_api_key),
            "required_env": ["ELECTRICITY_MAPS_API_KEY"],
            "provider": "Electricity Maps carbon intensity and power breakdown APIs",
        },
        "google_fit": {
            "configured": _is_configured(settings.google_fit_client_id)
            and _is_configured(settings.google_fit_client_secret),
            "required_env": ["GOOGLE_FIT_CLIENT_ID", "GOOGLE_FIT_CLIENT_SECRET"],
            "provider": "Google Fit REST API via OAuth",
        },
        "plaid": {
            "configured": _is_configured(settings.plaid_client_id)
            and _is_configured(settings.plaid_secret),
            "required_env": ["PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV"],
            "provider": "Plaid Transactions API",
        },
        "utility": {
            "configured": _is_configured(settings.utility_api_base_url)
            and _is_configured(settings.utility_api_key),
            "required_env": ["UTILITY_API_BASE_URL", "UTILITY_API_KEY"],
            "provider": "Configured utility meter API",
        },
    }


def _reverse_geocode_google(lat: float, lng: float) -> dict:
    settings = get_settings()
    if not _is_configured(settings.google_maps_api_key):
        return {}

    params = urlencode({"latlng": f"{lat},{lng}", "key": settings.google_maps_api_key})
    url = f"https://maps.googleapis.com/maps/api/geocode/json?{params}"
    try:
        data = _read_json(url, timeout=settings.connector_timeout_seconds)
        if not isinstance(data, dict) or data.get("status") != "OK":
            return {}
        results = data.get("results") or []
        if not results:
            return {}

        components = results[0].get("address_components") or []

        def find_component(*types: str) -> str:
            for item in components:
                item_types = set(item.get("types") or [])
                if item_types.intersection(types):
                    return item.get("long_name", "")
            return ""

        return {
            "city": find_component("locality", "administrative_area_level_2"),
            "state": find_component("administrative_area_level_1"),
            "country": find_component("country") or "IN",
            "zip_code": find_component("postal_code"),
            "source": "google_maps",
        }
    except Exception as exc:
        logger.warning("Google reverse geocode failed for (%s, %s): %s", lat, lng, exc)
        return {}


def reverse_geocode(lat: float, lng: float) -> dict:
    """Reverse geocode lat/lng using Google Maps when configured, else OSM."""
    google_result = _reverse_geocode_google(lat, lng)
    if google_result:
        return google_result

    url = (
        f"https://nominatim.openstreetmap.org/reverse?"
        f"lat={lat}&lon={lng}&format=json&addressdetails=1&accept-language=en"
    )
    try:
        data = _read_json(url, headers={"User-Agent": "EcoSync/1.0"})
        address = data.get("address", {})
        city = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("county")
            or ""
        )
        state = address.get("state", "")
        country = address.get("country_code", "in").upper()
        postcode = address.get("postcode", "")
        return {
            "city": city,
            "state": state,
            "country": country,
            "zip_code": postcode,
            "source": "openstreetmap_nominatim",
        }
    except Exception as exc:
        logger.warning("Reverse geocode failed for (%s, %s): %s", lat, lng, exc)
        return {}


def _geocode_pin_with_google(zip_code: str, country: str = "IN") -> dict:
    settings = get_settings()
    if not _is_configured(settings.google_maps_api_key):
        return {}

    params = urlencode(
        {
            "address": f"{zip_code}, {country}",
            "components": f"postal_code:{zip_code}|country:{country}",
            "key": settings.google_maps_api_key,
        }
    )
    url = f"https://maps.googleapis.com/maps/api/geocode/json?{params}"
    try:
        data = _read_json(url, timeout=settings.connector_timeout_seconds)
        if not isinstance(data, dict) or data.get("status") != "OK":
            return {}
        results = data.get("results") or []
        if not results:
            return {}
        location = results[0].get("geometry", {}).get("location", {})
        return {
            "lat": location.get("lat"),
            "lng": location.get("lng"),
            "formatted_address": results[0].get("formatted_address", ""),
            "source": "google_maps",
        }
    except Exception as exc:
        logger.warning("Google PIN geocode failed for %s: %s", zip_code, exc)
        return {}


def resolve_india_pin_code(zip_code: str) -> dict:
    """Resolve an Indian PIN code through India Post and optional Google Maps."""
    url = f"https://api.postalpincode.in/pincode/{zip_code}"
    try:
        data = _read_json(url, timeout=get_settings().connector_timeout_seconds)
    except Exception as exc:
        logger.warning("India Post PIN lookup failed for %s: %s", zip_code, exc)
        raise HTTPException(
            status_code=503,
            detail="PIN code lookup is temporarily unavailable. Please try again.",
        ) from exc

    result = data[0] if isinstance(data, list) and data else {}
    post_offices = result.get("PostOffice") or []
    if result.get("Status") != "Success" or not post_offices:
        raise HTTPException(
            status_code=422,
            detail="Invalid Indian PIN code. No matching India Post records found.",
        )

    office = post_offices[0]
    district = (office.get("District") or office.get("Name") or "").strip()
    state = (office.get("State") or "").strip()
    country = (office.get("Country") or "India").strip()
    if not district:
        raise HTTPException(
            status_code=422,
            detail="Invalid Indian PIN code. India Post did not return a usable district.",
        )

    google = _geocode_pin_with_google(zip_code)
    return {
        "city": district,
        "district": district,
        "state": state,
        "country": country,
        "zip_code": zip_code,
        "lat": google.get("lat"),
        "lng": google.get("lng"),
        "formatted_address": google.get("formatted_address"),
        "source": "india_post",
        "geo_source": google.get("source"),
    }


def fetch_weather_data(lat: float, lng: float) -> dict:
    """Fetch current weather and air quality from OpenWeatherMap."""
    settings = get_settings()
    api_key = settings.openweather_api_key
    if not _is_configured(api_key):
        return {"weather_configured": False}

    result = {}

    # Current weather
    try:
        url = (
            f"https://api.openweathermap.org/data/2.5/weather?"
            f"lat={lat}&lon={lng}&appid={api_key}&units=metric"
        )
        data = _read_json(url, timeout=settings.connector_timeout_seconds)
        main = data.get("main", {})
        weather = data.get("weather", [{}])[0]
        result["temperature_c"] = main.get("temp")
        result["humidity"] = main.get("humidity")
        result["weather_desc"] = weather.get("description", "")
    except Exception as exc:
        logger.warning("Weather fetch failed: %s", exc)

    # Air quality
    try:
        url = (
            f"https://api.openweathermap.org/data/2.5/air_pollution?"
            f"lat={lat}&lon={lng}&appid={api_key}"
        )
        data = _read_json(url, timeout=settings.connector_timeout_seconds)
        aqi_list = data.get("list", [])
        if aqi_list:
            result["air_quality_index"] = aqi_list[0].get("main", {}).get("aqi")
    except Exception as exc:
        logger.warning("Air quality fetch failed: %s", exc)

    return result


def fetch_grid_intensity_for_coords(lat: float, lng: float) -> dict:
    """Fetch real-time grid carbon intensity from Electricity Maps by coordinates."""
    settings = get_settings()
    api_key = settings.electricity_maps_api_key
    if not _is_configured(api_key):
        return {"grid_configured": False}

    try:
        url = f"https://api.electricitymaps.com/v3/carbon-intensity/latest?lat={lat}&lon={lng}"
        req = urllib.request.Request(url, headers={"auth-token": api_key})
        with urllib.request.urlopen(req, timeout=settings.connector_timeout_seconds) as response:
            data = json.loads(response.read().decode("utf-8"))
        g_co2 = data.get("carbonIntensity")
        if g_co2 is not None:
            return {
                "local_grid_intensity": round(g_co2 / 1000.0, 3),
                "grid_source": "electricity_maps",
            }
    except Exception as exc:
        logger.warning("Grid intensity fetch for coords failed: %s", exc)

    return {}


def fetch_power_breakdown_for_coords(lat: float, lng: float) -> dict:
    """Fetch power breakdown to determine green energy percentage."""
    settings = get_settings()
    api_key = settings.electricity_maps_api_key
    if not _is_configured(api_key):
        return {"grid_configured": False}

    try:
        url = f"https://api.electricitymaps.com/v3/power-breakdown/latest?lat={lat}&lon={lng}"
        req = urllib.request.Request(url, headers={"auth-token": api_key})
        with urllib.request.urlopen(req, timeout=settings.connector_timeout_seconds) as response:
            data = json.loads(response.read().decode("utf-8"))
        fossil = data.get("fossilFreePercentage")
        if fossil is not None:
            return {"green_energy_pct": round(fossil, 1)}
    except Exception as exc:
        logger.warning("Power breakdown fetch failed: %s", exc)

    return {}


def get_location_context(lat: float, lng: float) -> LocationContext:
    """Build a full location context from coordinates.

    Aggregates reverse geocoding, weather, air quality, and grid intensity
    into a single response object for the frontend.
    """
    geo = reverse_geocode(lat, lng)
    weather = fetch_weather_data(lat, lng)
    grid = fetch_grid_intensity_for_coords(lat, lng)
    power = fetch_power_breakdown_for_coords(lat, lng)

    # Estimate neighborhood average based on region
    from app.services.footprint_service import _static_lookup
    city = geo.get("city", "")
    regional = _static_lookup(city)
    neighborhood_avg = regional.avg_annual_kg

    return LocationContext(
        city=geo.get("city", ""),
        state=geo.get("state", ""),
        country=geo.get("country", "IN"),
        lat=lat,
        lng=lng,
        zip_code=geo.get("zip_code", ""),
        air_quality_index=weather.get("air_quality_index"),
        temperature_c=weather.get("temperature_c"),
        humidity=weather.get("humidity"),
        weather_desc=weather.get("weather_desc", ""),
        local_grid_intensity=grid.get("local_grid_intensity"),
        neighborhood_avg_kg=neighborhood_avg,
        green_energy_pct=power.get("green_energy_pct"),
        sources={
            "geocoding": geo.get("source"),
            "weather": "openweather" if "temperature_c" in weather else None,
            "air_quality": "openweather" if "air_quality_index" in weather else None,
            "grid": grid.get("grid_source"),
            "power_breakdown": "electricity_maps" if "green_energy_pct" in power else None,
            "neighborhood_average": "regional_factor_table",
        },
        connector_status=connector_status(),
    )


def get_neighborhood_ranking(city: str, user_footprint_kg: float) -> dict:
    """Compare a user's footprint against neighborhood and national benchmarks.

    Returns a ranking object with percentile estimation and actionable context.
    """
    from app.services.footprint_service import _static_lookup, EF

    regional = _static_lookup(city)
    national_avg = EF["india_avg_annual"]
    neighborhood_avg = regional.avg_annual_kg

    # Estimate percentile (simplified: linear interpolation)
    # Below neighborhood avg = good (lower percentile = better)
    if neighborhood_avg > 0:
        ratio = user_footprint_kg / neighborhood_avg
        if ratio <= 0.5:
            percentile = 10
        elif ratio <= 0.75:
            percentile = 25
        elif ratio <= 1.0:
            percentile = 50
        elif ratio <= 1.25:
            percentile = 75
        else:
            percentile = 90
    else:
        percentile = 50

    is_below_avg = user_footprint_kg < neighborhood_avg
    diff_pct = round(abs(user_footprint_kg - neighborhood_avg) / neighborhood_avg * 100) if neighborhood_avg > 0 else 0

    return {
        "user_kg": round(user_footprint_kg),
        "neighborhood_avg_kg": neighborhood_avg,
        "national_avg_kg": national_avg,
        "percentile": percentile,
        "is_below_average": is_below_avg,
        "diff_percent": diff_pct,
        "status": "eco_leader" if is_below_avg else "improvement_needed",
        "message": (
            f"You emit {diff_pct}% {'less' if is_below_avg else 'more'} "
            f"than the average in {city or 'your area'}."
        ),
    }
