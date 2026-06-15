"""Version 1 of the EcoSync API."""

from fastapi import APIRouter

from app.api.v1 import actions, footprint, insights, location, onboarding, parse

api_router = APIRouter()
api_router.include_router(footprint.router)
api_router.include_router(insights.router)
api_router.include_router(actions.router)
api_router.include_router(onboarding.router)
api_router.include_router(parse.router)
api_router.include_router(location.router)

__all__ = ["api_router"]
