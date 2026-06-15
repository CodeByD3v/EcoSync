"""Footprint domain logic backed by SQLite."""

from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime
from functools import lru_cache

import google.generativeai as genai

from app.core import db_session
from app.core.config import get_settings
from app.schemas import DailyFootprint, CategoryBreakdown, TrendPoint
from app.schemas.onboarding import GridFactors

logger = logging.getLogger(__name__)

#  Emission factors 
# Sources: EPA, IPCC AR6, India Central Electricity Authority (CEA 2023)
EF = {
    "car_per_km":        0.21,
    "flight_per_trip":   255.0,
    "electricity_per_kwh": 0.82,
    "shopping_per_item": 6.5,
    "diet": {
        "meat_heavy":  2500.0,
        "mixed":       1500.0,
        "flexitarian": 1500.0,
        "vegetarian":   700.0,
        "vegan":        300.0,
    },
    "india_avg_annual": 2000.0,
}

#  Regional grid factors 
_REGIONS = [
    (("mumbai", "pune", "maharashtra"), GridFactors(grid_kwh=0.86, transport_km=0.19, avg_annual_kg=1900)),
    (("delhi", "noida", "gurgaon"),     GridFactors(grid_kwh=0.90, transport_km=0.22, avg_annual_kg=2100)),
    (("bengaluru", "hyderabad"),        GridFactors(grid_kwh=0.78, transport_km=0.18, avg_annual_kg=1850)),
    (("chennai", "kochi", "kerala"),    GridFactors(grid_kwh=0.72, transport_km=0.17, avg_annual_kg=1750)),
    (("kolkata",),                      GridFactors(grid_kwh=0.88, transport_km=0.20, avg_annual_kg=2000)),
]
_INDIA_FALLBACK  = GridFactors(grid_kwh=0.82, transport_km=0.21, avg_annual_kg=2000)
_GLOBAL_FALLBACK = GridFactors(grid_kwh=0.49, transport_km=0.17, avg_annual_kg=4700)

CATEGORY_METADATA = {
    "transport": {"name": "Transport",   "color": "#D85A30"},
    "flights":   {"name": "Flights",     "color": "#993C1D"},
    "energy":    {"name": "Home Energy", "color": "#185FA5"},
    "diet":      {"name": "Diet",        "color": "#3B6D11"},
    "shopping":  {"name": "Shopping",    "color": "#534AB7"},
}

_genai_configured = False


#  Grid factor helpers 

def _static_lookup(city: str) -> GridFactors:
    if not city:
        return _GLOBAL_FALLBACK
    needle = city.strip().lower()
    if not needle:
        return _GLOBAL_FALLBACK
    for keys, f in _REGIONS:
        if any(key in needle for key in keys):
            return f
    if any(k in needle for k in ("india", "bharat")):
        return _INDIA_FALLBACK
    return _GLOBAL_FALLBACK


@lru_cache(maxsize=128)
def _fetch_city_factors_from_gemini(city: str, current_hour: int) -> GridFactors:
    global _genai_configured
    settings = get_settings()
    api_key = settings.gemini_api_key

    if not api_key or not city:
        return _static_lookup(city)

    if not _genai_configured:
        genai.configure(api_key=api_key)
        _genai_configured = True

    prompt = f"""
    You are an environmental data API. Provide the estimated carbon footprint data for the city of "{city}".
    It is currently hour {current_hour} (24-hour format). Consider peak/off-peak solar and fossil load for this time.
    Output EXACTLY a valid JSON object with these exact keys:
    - "grid_kwh"       — current grid emission factor in kg CO2e per kWh
    - "transport_km"   — petrol car emission factor in kg CO2e per km
    - "avg_annual_kg"  — average annual carbon footprint per capita in kg CO2e
    Example: {{"grid_kwh": 0.82, "transport_km": 0.21, "avg_annual_kg": 2000}}
    """
    try:
        model = genai.GenerativeModel(settings.llm_model or "gemini-1.5-flash")
        response = model.generate_content(
            prompt,
            request_options={"timeout": settings.connector_timeout_seconds},
        )
        raw = response.text.strip()
        if raw.startswith("```json"):
            raw = raw[7:-3].strip()
        elif raw.startswith("```"):
            raw = raw[3:-3].strip()
        data = json.loads(raw)
        return GridFactors(
            grid_kwh=float(data.get("grid_kwh", 0.82)),
            transport_km=float(data.get("transport_km", 0.21)),
            avg_annual_kg=int(data.get("avg_annual_kg", 2000)),
        )
    except Exception as exc:
        logger.error("Failed to fetch city factors from Gemini for %s: %s", city, exc)
        return _static_lookup(city)


def lookup_grid_factor(city: str) -> GridFactors:
    current_hour = datetime.now().hour
    factors = _fetch_city_factors_from_gemini(city, current_hour)

    from app.services.grid_intensity_service import get_grid_intensity_service
    realtime_kwh = get_grid_intensity_service().get_realtime_intensity(city)

    grid_kwh = realtime_kwh if os.getenv("ELECTRICITY_MAPS_API_KEY") else factors.grid_kwh
    return GridFactors(
        grid_kwh=grid_kwh,
        transport_km=factors.transport_km,
        avg_annual_kg=factors.avg_annual_kg,
    )


#  FootprintService 

class FootprintService:

    def get_profile(self) -> dict:
        """Return the current profile row as a plain dict.

        Includes is_onboarded so callers can tell whether the data is real.
        """
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM profile LIMIT 1")
            row = cursor.fetchone()

        if row:
            d = dict(row)
            d.pop("id", None)
            if not d.get("zip_code"):
                d["zip_code"] = "560001" if d.get("city", "").lower() == "bengaluru" else "400001"
            # is_onboarded comes straight from the DB (0 or 1)
            d["is_onboarded"] = bool(d.get("is_onboarded", 0))
            d["grid_factors"] = lookup_grid_factor(d.get("city", ""))
            return d

        # No row at all — return a clearly-unset placeholder
        return {
            "name":                "",
            "city":                "",
            "zip_code":            "",
            "km_driven_per_week":  100.0,
            "flights_per_year":    2,
            "kwh_per_month":       200.0,
            "diet":                "mixed",
            "new_items_per_month": 5,
            "is_onboarded":        False,
            "grid_factors":        lookup_grid_factor(""),
        }

    def update_profile(self, data: dict) -> None:
        """Update slider values in the profile row.

        Does NOT touch is_onboarded — that is set exclusively by the onboarding
        endpoint so the flag cannot be accidentally cleared by calculator
        interactions.
        """
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, zip_code FROM profile LIMIT 1")
            row = cursor.fetchone()
            if row:
                zip_val = data.get("zip_code") or (row["zip_code"] if row["zip_code"] else "")
                cursor.execute(
                    """
                    UPDATE profile
                    SET km_driven_per_week  = ?,
                        flights_per_year    = ?,
                        kwh_per_month       = ?,
                        diet                = ?,
                        new_items_per_month = ?,
                        zip_code            = ?
                    WHERE id = ?
                    """,
                    (
                        data["km_driven_per_week"],
                        data["flights_per_year"],
                        data["kwh_per_month"],
                        data["diet"],
                        data["new_items_per_month"],
                        zip_val,
                        row["id"],
                    ),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO profile
                        (name, city, zip_code, km_driven_per_week, flights_per_year,
                         kwh_per_month, diet, new_items_per_month, is_onboarded)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
                    """,
                    (
                        data.get("name", ""),
                        data.get("city", ""),
                        data.get("zip_code", ""),
                        data.get("km_driven_per_week", 100.0),
                        data.get("flights_per_year", 2),
                        data.get("kwh_per_month", 200.0),
                        data.get("diet", "mixed"),
                        data.get("new_items_per_month", 5),
                    ),
                )

    def apply_connector_sync(self, data: dict) -> dict:
        """Apply real connector payloads to the stored profile.

        Payloads can come from Google Fit, Plaid, a utility provider, or any
        backend job that has already authenticated with those providers. Only
        provided fields are updated; omitted fields keep their current values.
        """
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM profile LIMIT 1")
            row = cursor.fetchone()
            if not row:
                return {"updated": []}

            km = float(row["km_driven_per_week"])
            flights = int(row["flights_per_year"])
            kwh = float(row["kwh_per_month"])
            new_items = int(row["new_items_per_month"])
            updated: list[str] = []

            mobility = data.get("mobility") or {}
            distance_km = mobility.get("distance_km")
            period_days = float(mobility.get("period_days") or 7)
            if distance_km is not None and period_days > 0:
                km = max(0.0, min(2000.0, float(distance_km) * 7.0 / period_days))
                updated.append("km_driven_per_week")

            utility = data.get("utility") or {}
            utility_kwh = utility.get("kwh")
            utility_days = float(utility.get("period_days") or 30)
            if utility_kwh is not None and utility_days > 0:
                kwh = max(0.0, min(2000.0, float(utility_kwh) * 30.0 / utility_days))
                updated.append("kwh_per_month")

            travel = data.get("travel") or {}
            if travel.get("flights") is not None:
                flights = max(0, min(50, int(travel["flights"])))
                updated.append("flights_per_year")

            shopping = data.get("shopping") or {}
            if shopping.get("new_items") is not None:
                new_items = max(0, min(100, int(shopping["new_items"])))
                updated.append("new_items_per_month")

            cursor.execute(
                """
                UPDATE profile
                SET km_driven_per_week  = ?,
                    flights_per_year    = ?,
                    kwh_per_month       = ?,
                    new_items_per_month = ?
                WHERE id = ?
                """,
                (km, flights, kwh, new_items, row["id"]),
            )

        return {"updated": updated}

    def calculate_co2_breakdown(
        self,
        city: str,
        km_driven_per_week: float,
        flights_per_year: int,
        kwh_per_month: float,
        diet: str,
        new_items_per_month: int,
    ) -> dict:
        gf          = lookup_grid_factor(city)
        car_kg      = round(km_driven_per_week  * 52 * gf.transport_km)
        flights_kg  = round(flights_per_year    * EF["flight_per_trip"])
        energy_kg   = round(kwh_per_month       * 12 * gf.grid_kwh)
        diet_kg     = EF["diet"].get(diet, 1500.0)
        shopping_kg = round(new_items_per_month * 12 * EF["shopping_per_item"])
        total       = car_kg + flights_kg + energy_kg + diet_kg + shopping_kg
        return {
            "car_kg":      car_kg,
            "flights_kg":  flights_kg,
            "energy_kg":   energy_kg,
            "diet_kg":     diet_kg,
            "shopping_kg": shopping_kg,
            "total_annual": total,
            "grid_factors": gf,
        }

    def get_daily(self) -> DailyFootprint:
        """Compute the annual footprint from the stored profile.

        is_calculated mirrors the DB column is_onboarded — True only when the
        profile was written by a real onboarding submission, False for the
        startup seed row.
        """
        p             = self.get_profile()
        city          = p.get("city", "")
        #  KEY CHANGE 
        is_calculated = p.get("is_onboarded", False)

        res         = self.calculate_co2_breakdown(
            city=city,
            km_driven_per_week=p["km_driven_per_week"],
            flights_per_year=p["flights_per_year"],
            kwh_per_month=p["kwh_per_month"],
            diet=p["diet"],
            new_items_per_month=p["new_items_per_month"],
        )

        total_annual = res["total_annual"]
        car_kg       = res["car_kg"]
        flights_kg   = res["flights_kg"]
        energy_kg    = res["energy_kg"]
        diet_kg      = res["diet_kg"]
        shopping_kg  = res["shopping_kg"]

        current_monthly_kg = round(total_annual / 12.0, 1)
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO history (month, total) VALUES ('Jun', ?)"
                " ON CONFLICT(month) DO UPDATE SET total = ?",
                (current_monthly_kg, current_monthly_kg),
            )
            cursor.execute("SELECT month, total FROM history ORDER BY rowid ASC")
            trend = [TrendPoint(label=r["month"], value=r["total"]) for r in cursor.fetchall()]

        breakdown = [
            CategoryBreakdown(
                name=CATEGORY_METADATA["energy"]["name"],
                percentage=round((energy_kg   / total_annual * 100) if total_annual else 0, 1),
                kg=energy_kg, color=CATEGORY_METADATA["energy"]["color"],
            ),
            CategoryBreakdown(
                name=CATEGORY_METADATA["transport"]["name"],
                percentage=round((car_kg      / total_annual * 100) if total_annual else 0, 1),
                kg=car_kg,    color=CATEGORY_METADATA["transport"]["color"],
            ),
            CategoryBreakdown(
                name=CATEGORY_METADATA["flights"]["name"],
                percentage=round((flights_kg  / total_annual * 100) if total_annual else 0, 1),
                kg=flights_kg, color=CATEGORY_METADATA["flights"]["color"],
            ),
            CategoryBreakdown(
                name=CATEGORY_METADATA["diet"]["name"],
                percentage=round((diet_kg     / total_annual * 100) if total_annual else 0, 1),
                kg=diet_kg,   color=CATEGORY_METADATA["diet"]["color"],
            ),
            CategoryBreakdown(
                name=CATEGORY_METADATA["shopping"]["name"],
                percentage=round((shopping_kg / total_annual * 100) if total_annual else 0, 1),
                kg=shopping_kg, color=CATEGORY_METADATA["shopping"]["color"],
            ),
        ]

        prev_month_kg  = (trend[-2].value * 12) if len(trend) >= 2 else total_annual
        yesterday_annual = prev_month_kg

        return DailyFootprint(
            user_name=p.get("name", ""),
            date=date.today().isoformat(),
            total_kg=total_annual,
            yesterday_kg=round(yesterday_annual, 1),
            delta_kg=round(total_annual - yesterday_annual, 1),
            unit="kg CO2e",
            breakdown=breakdown,
            trend=trend,
            #  KEY CHANGE 
            is_calculated=is_calculated,
        )


_service = FootprintService()


def get_footprint_service() -> FootprintService:
    return _service
