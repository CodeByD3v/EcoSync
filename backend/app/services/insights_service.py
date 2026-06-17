import os
import json
import logging
import google.generativeai as genai
from typing import List, Dict, Any

# Assuming your schema is defined here based on your file tree
from app.schemas.insights import Insight 
from app.core.config import get_settings

logger = logging.getLogger(__name__)

_genai_configured = False

def _get_fallback_insights() -> List[Insight]:
    """Fallback static data if the API key is missing or the network fails."""
    return [
        Insight(
            id="walk-detected-fallback",
            type="positive",
            icon="Footprints",
            title="Smart Walk Detected",
            description="You walked 2 miles today instead of driving.",
            impact_kg=-0.8,
        ),
        Insight(
            id="peak-hours-fallback",
            type="alert",
            icon="Zap",
            title="Peak Hours Alert",
            description="Unplug idle devices now to avoid high-carbon grid power.",
            impact_kg=-0.5,
        ),
        Insight(
            id="swap-beef-fallback",
            type="swap",
            icon="Salad",
            title="Smart Swap: Lentils for Beef",
            description="Swapping one beef meal this week for lentils cuts emissions.",
            impact_kg=-3.2,
        ),
    ]

def generate_live_insights(user_footprint: Dict[str, Any]) -> List[Insight]:
    """
    Passes the user's live carbon footprint data to Gemini to generate
    hyper-personalized, contextual smart swaps.
    """
    global _genai_configured
    settings = get_settings()
    api_key = settings.gemini_api_key

    if not api_key:
        logger.warning("No GEMINI_API_KEY found. Using fallback insights.")
        return _get_fallback_insights()

    if not _genai_configured:
        genai.configure(api_key=api_key)
        _genai_configured = True

    # The prompt explicitly locks Gemini into the data structure the frontend needs.
    prompt = f"""
    You are the EcoSync AI Coach. Analyze the following user carbon footprint data:
    {json.dumps(user_footprint)}

    The data fields are:
    - km_driven_per_week: kilometers driven in a petrol car per week
    - flights_per_year: number of short-haul round-trip flights per year
    - kwh_per_month: household electricity consumption in kWh per month
    - diet: dietary preference (e.g., meat_heavy, mixed, vegetarian, vegan)
    - new_items_per_month: number of manufactured items purchased per month

    Generate 3 hyper-personalized, actionable insights to help them reduce their footprint.
    Do NOT use markdown outside of the JSON block.
    Output EXACTLY a valid JSON array of objects with these exact keys:
    - "id": A unique string ID (e.g., "reduce-ac").
    - "type": MUST be one of ["positive", "alert", "swap"].
    - "icon": MUST be one of ["Footprints", "Zap", "Salad", "Sparkles", "Lightbulb"].
    - "title": A short, catchy title (max 5 words).
    - "description": One actionable sentence of advice.
    - "impact_kg": A float representing kg of CO2 saved (MUST be a negative number, e.g., -1.5).

    JSON Array:
    """

    # We will try these models in order:
    models_to_try = ["gemini-2.0-flash", "gemini-1.5-flash"]
    last_error = None

    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            
            # Clean the response to ensure strict JSON parsing
            raw_text = response.text.strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:-3].strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text[3:-3].strip()
                
            ai_data = json.loads(raw_text)
            
            # Validate and map to Pydantic schemas
            insights = [Insight(**item) for item in ai_data]
            return insights
        except Exception as e:
            logger.warning(f"Insights generation failed with model {model_name}: {e}")
            last_error = e

    logger.error(f"All generative models failed for insights: {last_error}")
    return _get_fallback_insights()

