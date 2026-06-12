"""Insights domain logic.

Queries the database for user lifestyle choices and calculates personalized
insights. If GEMINI_API_KEY is configured in the environment, it uses the
Gemini LLM to generate context-aware suggestions in real-time. Otherwise, it
falls back to a dynamic rule-based engine.
"""

from __future__ import annotations

import json
import urllib.request
from functools import lru_cache
from typing import List

from app.config import get_settings
from app.db import get_db_connection
from app.schemas import Insight
from app.services.footprint_service import get_footprint_service, EF


class InsightsService:
    """Serves real-time dynamic AI insights for user sustainability."""

    def list_insights(self) -> List[Insight]:
        """Generate personalized insights, utilizing Gemini if API key is present."""
        # 1. Fetch user profile
        fp_service = get_footprint_service()
        p = fp_service.get_profile()

        # 2. Check for Gemini API key via application settings
        settings = get_settings()
        api_key = settings.gemini_api_key
        if api_key:
            try:
                insights = self._get_gemini_insights(api_key, p)
                if insights:
                    return [
                        Insight(
                            id=item.get("id", f"gemini-nudge-{i}"),
                            type=item.get("type", "positive"),
                            icon=item.get("icon", "Lightbulb"),
                            title=item.get("title", "Sustainability Tip"),
                            description=item.get("description", ""),
                            impact_kg=float(item.get("impact_kg", -1.0)),
                        )
                        for i, item in enumerate(insights)
                    ]
            except Exception:
                # Log error or print in console, fallback silently
                pass

        # 3. Heuristic Fallback
        return self._generate_heuristic_insights(p)

    def _get_gemini_insights(self, api_key: str, p: dict) -> List[dict] | None:
        """Call the Gemini API using standard library to generate insights in JSON format."""
        settings = get_settings()
        model = settings.llm_model
        temp = settings.llm_temperature

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        # Build prompt
        prompt = (
            "You are the EcoSync AI Assistant. Analyze this carbon footprint lifestyle data:\n"
            f"- Commute: {p['km_driven_per_week']} km driven per week\n"
            f"- Flights: {p['flights_per_year']} flights per year\n"
            f"- Home energy: {p['kwh_per_month']} kWh electricity per month\n"
            f"- Diet: {p['diet']}\n"
            f"- Shopping: {p['new_items_per_month']} new items purchased per month\n\n"
            "Generate EXACTLY 3 highly engaging, specific, and actionable carbon footprint insights.\n"
            "Return ONLY a raw JSON array matching this schema structure, without any markdown formatting or backticks:\n"
            "[\n"
            "  {\n"
            "    \"id\": \"insight-id\",\n"
            "    \"type\": \"positive\" | \"alert\" | \"swap\",\n"
            "    \"icon\": \"Footprints\" | \"Zap\" | \"Salad\" | \"Sparkles\" | \"Lightbulb\",\n"
            "    \"title\": \"Catchy title\",\n"
            "    \"description\": \"Actionable and encouraging description\",\n"
            "    \"impact_kg\": -12.5\n"
            "  }\n"
            "]"
        )

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": temp,
            },
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=5) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            raw_text = res_data["candidates"][0]["content"]["parts"][0]["text"]
            # Parse response text
            insights = json.loads(raw_text.strip())
            if isinstance(insights, list):
                return insights
        return None

    def _generate_heuristic_insights(self, p: dict) -> List[Insight]:
        """Generate smart rule-based insights based on user's highest emissions."""
        # Calculate individual annual footprints to rank them
        car_kg = p["km_driven_per_week"] * 52 * EF["car_per_km"]
        flights_kg = p["flights_per_year"] * EF["flight_per_trip"]
        energy_kg = p["kwh_per_month"] * 12 * EF["electricity_per_kwh"]
        diet_kg = EF["diet"].get(p["diet"], 1500.0)
        shopping_kg = p["new_items_per_month"] * 12 * EF["shopping_per_item"]

        categories = [
            ("transport", car_kg, "Footprints"),
            ("flights", flights_kg, "Lightbulb"),
            ("energy", energy_kg, "Zap"),
            ("diet", diet_kg, "Salad"),
            ("shopping", shopping_kg, "Sparkles"),
        ]
        # Sort highest first
        categories.sort(key=lambda x: x[1], reverse=True)

        insights = []

        # 1. Highest impact category swap
        highest_cat = categories[0][0]
        if highest_cat == "transport":
            insights.append(
                Insight(
                    id="commute-swap",
                    type="swap",
                    icon="Footprints",
                    title="Commute Optimization",
                    description="Taking public transit or walking for trips under 3 km cuts emissions substantially.",
                    impact_kg=-200.0,
                )
            )
        elif highest_cat == "flights":
            insights.append(
                Insight(
                    id="flight-swap",
                    type="swap",
                    icon="Lightbulb",
                    title="Direct Routes & Calls",
                    description="Replacing just one flight with a video call saves a massive chunk of carbon.",
                    impact_kg=-255.0,
                )
            )
        elif highest_cat == "energy":
            insights.append(
                Insight(
                    id="energy-swap",
                    type="swap",
                    icon="Zap",
                    title="AC Efficiency Nudge",
                    description="Setting your AC to 26C instead of 22C can save 120 kg CO2/year.",
                    impact_kg=-120.0,
                )
            )
        elif highest_cat == "diet":
            insights.append(
                Insight(
                    id="diet-swap",
                    type="swap",
                    icon="Salad",
                    title="Smart Swap: Legumes for Beef",
                    description="Replacing red meat with beans or lentils just once a week makes a huge impact.",
                    impact_kg=-300.0,
                )
            )
        else:
            insights.append(
                Insight(
                    id="shopping-swap",
                    type="swap",
                    icon="Sparkles",
                    title="Second-hand purchases",
                    description="Buying second-hand for your next 3 major purchases saves manufacturing carbon.",
                    impact_kg=-60.0,
                )
            )

        # 2. General smart energy alert
        insights.append(
            Insight(
                id="peak-hours-alert",
                type="alert",
                icon="Zap",
                title="Standby Power Alert",
                description="Unplugging standby devices (TVs, routers, monitors) when not in use trims hidden electricity drain.",
                impact_kg=-45.0,
            )
        )

        # 3. Positive behavior nudge
        insights.append(
            Insight(
                id="positive-badge",
                type="positive",
                icon="Sparkles",
                title="Active Tracking Active",
                description="Keep logging and adjustments active! Tracking is the first step to reduction.",
                impact_kg=-10.0,
            )
        )

        return insights


_insights_service = InsightsService()


def get_insights_service() -> InsightsService:
    return _insights_service
