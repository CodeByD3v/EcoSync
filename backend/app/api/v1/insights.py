from typing import List
from fastapi import APIRouter

from app.schemas.insights import Insight
from app.services.insights_service import generate_live_insights

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("", response_model=List[Insight])
def get_insights() -> List[Insight]:
    """Return context-aware nudges and smart swaps for the user."""
    # In a fully connected app, you would fetch this from your db.py.
    # For now, we pass the current live state to Gemini to analyze.
    current_user_data = {
        "transport_kg": 5.5,
        "energy_kg": 6.1,
        "food_kg": 2.9,
        "primary_commute": "drive-alone",
        "recent_activity": "High electricity usage detected at 6 PM."
    }
    
    return generate_live_insights(current_user_data)
