"""Actions checklist and challenges routes."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.schemas import ActionItem, CompleteActionRequest, CompleteActionResponse
from app.services import ActionsService, get_actions_service
from app.services.actions_service import ActionNotFoundError

router = APIRouter(prefix="/actions", tags=["actions"])


@router.get("", response_model=List[ActionItem])
def get_actions(
    service: ActionsService = Depends(get_actions_service),
) -> List[ActionItem]:
    """Return the daily actions checklist and its completion state."""
    return service.list_actions()


@router.post("/complete", response_model=CompleteActionResponse)
def complete_action(
    payload: CompleteActionRequest,
    service: ActionsService = Depends(get_actions_service),
) -> CompleteActionResponse:
    """Toggle the completion state of a checklist item and return new totals."""
    try:
        return service.complete(payload.action_id, payload.completed)
    except ActionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/challenges", response_model=List[dict])
def get_challenges(
    service: ActionsService = Depends(get_actions_service),
) -> List[dict]:
    """Return the active community challenges and their progress levels."""
    return service.list_challenges()
