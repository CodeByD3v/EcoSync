from typing import List
from fastapi import APIRouter, Depends

from app.schemas.insights import Insight
from app.services.insights_service import generate_live_insights
from app.services.footprint_service import get_footprint_service, FootprintService

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("", response_model=List[Insight])
def get_insights(
    service: FootprintService = Depends(get_footprint_service),
) -> List[Insight]:
    profile = service.get_profile()
    user_data = {
        "km_driven_per_week": profile.get("km_driven_per_week", 100),
        "flights_per_year": profile.get("flights_per_year", 2),
        "kwh_per_month": profile.get("kwh_per_month", 200),
        "diet": profile.get("diet", "mixed"),
        "new_items_per_month": profile.get("new_items_per_month", 5),
    }
    return generate_live_insights(user_data)
