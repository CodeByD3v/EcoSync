"""Version 1 of the EcoSync API."""

from fastapi import APIRouter

from app.api.v1 import actions, footprint, insights

api_router = APIRouter()
api_router.include_router(footprint.router)
api_router.include_router(insights.router)
api_router.include_router(actions.router)

__all__ = ["api_router"]
