"""Schemas for the AI insights endpoint."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Insight(BaseModel):
    """A context-aware nudge or smart swap surfaced to the user."""

    id: str
    type: str = Field(..., description="One of 'positive', 'alert', 'swap'.")
    icon: str = Field(..., description="lucide-react icon name for the frontend.")
    title: str
    description: str
    impact_kg: float
