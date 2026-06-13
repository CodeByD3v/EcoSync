import os
import json
import logging
import google.generativeai as genai
from typing import List, Dict, Any

# Assuming your schema is defined here based on your file tree
from app.schemas.insights import Insight 

logger = logging.getLogger(__name__)

# Configure Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

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
    if not GEMINI_API_KEY:
        logger.warning("No GEMINI_API_KEY found. Using fallback insights.")
        return _get_fallback_insights()

    # The prompt explicitly locks Gemini into the data structure the frontend needs.
    prompt = f"""
    You are the EcoSync AI Coach. Analyze the following user carbon footprint data:
    {json.dumps(user_footprint)}

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
    models_to_try = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-1.5-flash"]
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

