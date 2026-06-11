"""Schemas for the gamified actions checklist."""

from __future__ import annotations

from typing import List

from pydantic import BaseModel


class ActionItem(BaseModel):
    """A single daily habit the user can check off."""

    id: str
    label: str
    points: int
    completed: bool


class CompleteActionRequest(BaseModel):
    """Payload to toggle a checklist item's completion state."""

    action_id: str
    completed: bool = True


class CompleteActionResponse(BaseModel):
    """Result of toggling a checklist item, including the new totals."""

    action_id: str
    completed: bool
    points_earned: int
    total_points: int
    actions: List[ActionItem]
