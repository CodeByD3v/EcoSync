"""Footprint domain logic backed by SQLite.

Loads user inputs, computes carbon footprint according to emissions factors (EF),
and dynamically updates history trends.
"""

from __future__ import annotations

from datetime import date
from app.core import db_session
from app.schemas import DailyFootprint, CategoryBreakdown, TrendPoint
from app.schemas.onboarding import GridFactors

# Emission factors (kg CO2e)
# Sources: EPA, IPCC AR6, India Central Electricity Authority (CEA)
EF = {
    "car_per_km": 0.21,           # Average petrol car, India
    "flight_per_trip": 255.0,     # Short-haul round trip average
    "electricity_per_kwh": 0.82,  # India grid mix (CEA 2023)
    "shopping_per_item": 6.5,     # Average manufactured goods
    "diet": {
        "meat_heavy": 2500.0,     # kg CO2e / year
        "mixed": 1500.0,
        "flexitarian": 1500.0,
        "vegetarian": 700.0,
        "vegan": 300.0,
    },
    "india_avg_annual": 2000.0,   # kg CO2e national average
}

_REGIONS = [
    (("mumbai", "pune", "maharashtra"), GridFactors(grid_kwh=0.86, transport_km=0.19, avg_annual_kg=1900)),
    (("delhi", "noida", "gurgaon"), GridFactors(grid_kwh=0.90, transport_km=0.22, avg_annual_kg=2100)),
    (("bengaluru", "hyderabad"), GridFactors(grid_kwh=0.78, transport_km=0.18, avg_annual_kg=1850)),
    (("chennai", "kochi", "kerala"), GridFactors(grid_kwh=0.72, transport_km=0.17, avg_annual_kg=1750)),
    (("kolkata",), GridFactors(grid_kwh=0.88, transport_km=0.20, avg_annual_kg=2000)),
]
_INDIA_FALLBACK = GridFactors(grid_kwh=0.82, transport_km=0.21, avg_annual_kg=2000)
_GLOBAL_FALLBACK = GridFactors(grid_kwh=0.49, transport_km=0.17, avg_annual_kg=4700)


import json
import logging
from datetime import datetime
from functools import lru_cache
import google.generativeai as genai
from app.core.config import get_settings

logger = logging.getLogger(__name__)
_genai_configured = False

def _static_lookup(city: str) -> GridFactors:
    factors = _INDIA_FALLBACK
    if not city:
        return _GLOBAL_FALLBACK
    needle = city.strip().lower()
    if not needle:
        return _GLOBAL_FALLBACK
    for keys, f in _REGIONS:
        if any(key in needle for key in keys):
            return f
    if any(k in needle for k in ["india", "bharat"]):
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
    We need:
    1. The CURRENT real-time grid emission factor in kg CO2e per kWh (adjust for time of day).
    2. The average transport emission factor for a petrol car in kg CO2e per km.
    3. The average annual carbon footprint per capita in kg CO2e.

    Output EXACTLY a valid JSON object with these exact keys:
    - "grid_kwh"
    - "transport_km"
    - "avg_annual_kg"
    
    Example:
    {{"grid_kwh": 0.82, "transport_km": 0.21, "avg_annual_kg": 2000}}
    """
    try:
        model = genai.GenerativeModel(settings.llm_model or "gemini-1.5-flash")
        response = model.generate_content(prompt)
        
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:-3].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:-3].strip()
            
        data = json.loads(raw_text)
        
        return GridFactors(
            grid_kwh=float(data.get("grid_kwh", 0.82)),
            transport_km=float(data.get("transport_km", 0.21)),
            avg_annual_kg=int(data.get("avg_annual_kg", 2000))
        )
    except Exception as e:
        logger.error(f"Failed to fetch city factors from Gemini for {city}: {e}")
        return _static_lookup(city)

def lookup_grid_factor(city: str) -> GridFactors:
    current_hour = datetime.now().hour
    factors = _fetch_city_factors_from_gemini(city, current_hour)

    # Check if Electricity Maps API is available and override the grid_kwh if so
    from app.services.grid_intensity_service import get_grid_intensity_service
    realtime_kwh = get_grid_intensity_service().get_realtime_intensity(city)
    
    # The grid_intensity_service falls back to heuristics, but we prefer Gemini's dynamic estimate 
    # over the simple static heuristic if Electricity Maps API key is missing.
    # We can inspect if the real-time kwh came from the API by checking if ELECTRICITY_MAPS_API_KEY is set.
    import os
    if os.getenv("ELECTRICITY_MAPS_API_KEY"):
        grid_kwh = realtime_kwh
    else:
        grid_kwh = factors.grid_kwh

    return GridFactors(
        grid_kwh=grid_kwh,
        transport_km=factors.transport_km,
        avg_annual_kg=factors.avg_annual_kg
    )


# Mapping of categories for response schemas
CATEGORY_METADATA = {
    "transport": {"name": "Transport", "color": "#D85A30"},
    "flights": {"name": "Flights", "color": "#993C1D"},
    "energy": {"name": "Home Energy", "color": "#185FA5"},
    "diet": {"name": "Diet", "color": "#3B6D11"},
    "shopping": {"name": "Shopping", "color": "#534AB7"},
}


class FootprintService:
    """Calculates carbon footprint using parameters stored in SQLite."""

    def get_profile(self) -> dict:
        """Fetch the current profile settings from SQLite."""
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM profile LIMIT 1")
            row = cursor.fetchone()
            if row:
                d = dict(row)
                d.pop("id", None)
                if "zip_code" not in d or not d["zip_code"]:
                    d["zip_code"] = "560001" if d.get("city", "").lower() == "bengaluru" else "400001"
                return d
            return {
                "name": "Arjun",
                "city": "Bengaluru",
                "zip_code": "560001",
                "km_driven_per_week": 100.0,
                "flights_per_year": 2,
                "kwh_per_month": 200.0,
                "diet": "mixed",
                "new_items_per_month": 5,
            }

    def update_profile(self, data: dict) -> None:
        """Update profile parameters in SQLite."""
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, zip_code FROM profile LIMIT 1")
            row = cursor.fetchone()
            if row:
                zip_val = data.get("zip_code", row["zip_code"] if "zip_code" in row.keys() else "")
                cursor.execute(
                    """
                    UPDATE profile
                    SET km_driven_per_week = ?,
                        flights_per_year = ?,
                        kwh_per_month = ?,
                        diet = ?,
                        new_items_per_month = ?,
                        zip_code = ?
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
                    INSERT INTO profile (name, city, zip_code, km_driven_per_week, flights_per_year, kwh_per_month, diet, new_items_per_month)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        data.get("name", "User"),
                        data.get("city", "India"),
                        data.get("zip_code", "560001"),
                        data.get("km_driven_per_week", 100.0),
                        data.get("flights_per_year", 2),
                        data.get("kwh_per_month", 200.0),
                        data.get("diet", "mixed"),
                        data.get("new_items_per_month", 5),
                    ),
                )

    def process_telemetry_tick(self, event_type: str) -> None:
        """Process a simulated telemetry event by updating the profile in database."""
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM profile LIMIT 1")
            row = cursor.fetchone()
            if not row:
                return
            
            p_id = row["id"]
            km = row["km_driven_per_week"]
            flights = row["flights_per_year"]
            kwh = row["kwh_per_month"]
            new_items = row["new_items_per_month"]
            
            if event_type == "drive":
                km = min(2000.0, km + 25.0)
            elif event_type == "transit":
                km = max(0.0, km - 30.0)
            elif event_type == "flight":
                flights = min(50, flights + 1)
            elif event_type == "utility":
                kwh = min(2000.0, kwh + 15.0)
            elif event_type == "shopping":
                new_items = min(100, new_items + 1)
                
            cursor.execute(
                """
                UPDATE profile
                SET km_driven_per_week = ?,
                    flights_per_year = ?,
                    kwh_per_month = ?,
                    new_items_per_month = ?
                WHERE id = ?
                """,
                (km, flights, kwh, new_items, p_id)
            )

    def calculate_co2_breakdown(
        self,
        city: str,
        km_driven_per_week: float,
        flights_per_year: int,
        kwh_per_month: float,
        diet: str,
        new_items_per_month: int,
    ) -> dict:
        """Calculate and return co2 breakdown for transport, flights, energy, diet, and shopping."""
        gf = lookup_grid_factor(city)
        car_kg = round(km_driven_per_week * 52 * gf.transport_km)
        flights_kg = round(flights_per_year * EF["flight_per_trip"])
        energy_kg = round(kwh_per_month * 12 * gf.grid_kwh)
        diet_kg = EF["diet"].get(diet, 1500.0)
        shopping_kg = round(new_items_per_month * 12 * EF["shopping_per_item"])
        total_annual = car_kg + flights_kg + energy_kg + diet_kg + shopping_kg
        return {
            "car_kg": car_kg,
            "flights_kg": flights_kg,
            "energy_kg": energy_kg,
            "diet_kg": diet_kg,
            "shopping_kg": shopping_kg,
            "total_annual": total_annual,
            "grid_factors": gf,
        }

    def get_daily(self) -> DailyFootprint:
        """Compute the annual footprint and format it as a DailyFootprint response."""
        p = self.get_profile()
        city = p.get("city", "Bengaluru")

        res = self.calculate_co2_breakdown(
            city=city,
            km_driven_per_week=p["km_driven_per_week"],
            flights_per_year=p["flights_per_year"],
            kwh_per_month=p["kwh_per_month"],
            diet=p["diet"],
            new_items_per_month=p["new_items_per_month"],
        )

        total_annual = res["total_annual"]
        car_kg = res["car_kg"]
        flights_kg = res["flights_kg"]
        energy_kg = res["energy_kg"]
        diet_kg = res["diet_kg"]
        shopping_kg = res["shopping_kg"]
        gf = res["grid_factors"]

        # Dynamic update of history: set June's footprint to (total_annual / 12)
        current_monthly_kg = round(total_annual / 12.0, 1)
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO history (month, total) VALUES ('Jun', ?) ON CONFLICT(month) DO UPDATE SET total = ?",
                (current_monthly_kg, current_monthly_kg),
            )

            # Load trend from history
            cursor.execute("SELECT month, total FROM history ORDER BY rowid ASC")
            trend_rows = cursor.fetchall()
            trend = [TrendPoint(label=r["month"], value=r["total"]) for r in trend_rows]

        # Build breakdown
        breakdown = [
            CategoryBreakdown(
                name=CATEGORY_METADATA["energy"]["name"],
                percentage=round((energy_kg / total_annual * 100) if total_annual > 0 else 0, 1),
                kg=energy_kg,
                color=CATEGORY_METADATA["energy"]["color"],
            ),
            CategoryBreakdown(
                name=CATEGORY_METADATA["transport"]["name"],
                percentage=round((car_kg / total_annual * 100) if total_annual > 0 else 0, 1),
                kg=car_kg,
                color=CATEGORY_METADATA["transport"]["color"],
            ),
            CategoryBreakdown(
                name=CATEGORY_METADATA["flights"]["name"],
                percentage=round((flights_kg / total_annual * 100) if total_annual > 0 else 0, 1),
                kg=flights_kg,
                color=CATEGORY_METADATA["flights"]["color"],
            ),
            CategoryBreakdown(
                name=CATEGORY_METADATA["diet"]["name"],
                percentage=round((diet_kg / total_annual * 100) if total_annual > 0 else 0, 1),
                kg=diet_kg,
                color=CATEGORY_METADATA["diet"]["color"],
            ),
            CategoryBreakdown(
                name=CATEGORY_METADATA["shopping"]["name"],
                percentage=round((shopping_kg / total_annual * 100) if total_annual > 0 else 0, 1),
                kg=shopping_kg,
                color=CATEGORY_METADATA["shopping"]["color"],
            ),
        ]

        # Compare against previous month's value for a real delta
        prev_month_kg = None
        if len(trend) >= 2:
            prev_month_kg = trend[-2].value * 12  # annualize the monthly figure
        yesterday_annual = prev_month_kg if prev_month_kg is not None else total_annual

        return DailyFootprint(
            user_name=p.get("name", "Arjun"),
            date=date.today().isoformat(),
            total_kg=total_annual,
            yesterday_kg=round(yesterday_annual, 1),
            delta_kg=round(total_annual - yesterday_annual, 1),
            unit="kg CO2e",
            breakdown=breakdown,
            trend=trend,
        )


_service = FootprintService()


def get_footprint_service() -> FootprintService:
    return _service
