"""Footprint domain logic backed by SQLite.

Loads user inputs, computes carbon footprint according to emissions factors (EF),
and dynamically updates history trends.
"""

from __future__ import annotations

from datetime import date
from app.db import get_db_connection
from app.schemas import DailyFootprint, CategoryBreakdown, TrendPoint

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
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM profile LIMIT 1")
            row = cursor.fetchone()
            if row:
                d = dict(row)
                d.pop("id", None)
                return d
            return {
                "name": "Arjun",
                "city": "Bengaluru",
                "km_driven_per_week": 100.0,
                "flights_per_year": 2,
                "kwh_per_month": 200.0,
                "diet": "mixed",
                "new_items_per_month": 5,
            }
        finally:
            conn.close()

    def update_profile(self, data: dict) -> None:
        """Update profile parameters in SQLite."""
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM profile LIMIT 1")
            row = cursor.fetchone()
            if row:
                cursor.execute(
                    """
                    UPDATE profile
                    SET km_driven_per_week = ?,
                        flights_per_year = ?,
                        kwh_per_month = ?,
                        diet = ?,
                        new_items_per_month = ?
                    WHERE id = ?
                    """,
                    (
                        data["km_driven_per_week"],
                        data["flights_per_year"],
                        data["kwh_per_month"],
                        data["diet"],
                        data["new_items_per_month"],
                        row["id"],
                    ),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO profile (name, city, km_driven_per_week, flights_per_year, kwh_per_month, diet, new_items_per_month)
                    VALUES ('Arjun', 'Bengaluru', ?, ?, ?, ?, ?)
                    """,
                    (
                        data["km_driven_per_week"],
                        data["flights_per_year"],
                        data["kwh_per_month"],
                        data["diet"],
                        data["new_items_per_month"],
                    ),
                )
            conn.commit()
        finally:
            conn.close()

    def get_daily(self) -> DailyFootprint:
        """Compute the annual footprint and format it as a DailyFootprint response."""
        p = self.get_profile()

        # Calculate annual emissions for each bucket
        car_kg = round(p["km_driven_per_week"] * 52 * EF["car_per_km"])
        flights_kg = round(p["flights_per_year"] * EF["flight_per_trip"])
        energy_kg = round(p["kwh_per_month"] * 12 * EF["electricity_per_kwh"])
        diet_kg = EF["diet"].get(p["diet"], 1500.0)
        shopping_kg = round(p["new_items_per_month"] * 12 * EF["shopping_per_item"])
        total_annual = car_kg + flights_kg + energy_kg + diet_kg + shopping_kg

        # Dynamic update of history: set June's footprint to (total_annual / 12)
        current_monthly_kg = round(total_annual / 12.0, 1)
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO history (month, total) VALUES ('Jun', ?) ON CONFLICT(month) DO UPDATE SET total = ?",
                (current_monthly_kg, current_monthly_kg),
            )
            conn.commit()

            # Load trend from history
            cursor.execute("SELECT month, total FROM history ORDER BY rowid ASC")
            trend_rows = cursor.fetchall()
            trend = [TrendPoint(label=r["month"], value=r["total"]) for r in trend_rows]
        finally:
            conn.close()

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

        # In this amalgamated model, total_kg is annual CO2 in kg (e.g. 3100)
        # We set yesterday_kg to show trend comparisons
        yesterday_annual = total_annual + 120.0  # mock trend

        return DailyFootprint(
            user_name=p.get("name", "Arjun"),
            date=date.today().isoformat(),
            total_kg=total_annual,
            yesterday_kg=yesterday_annual,
            delta_kg=round(total_annual - yesterday_annual, 1),
            unit="kg CO2e",
            breakdown=breakdown,
            trend=trend,
        )


_service = FootprintService()


def get_footprint_service() -> FootprintService:
    return _service
