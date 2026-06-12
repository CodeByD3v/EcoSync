"""Actions checklist domain logic."""

from __future__ import annotations

from functools import lru_cache
from typing import List

from app.repositories import ActionsRepository
from app.schemas import ActionItem, CompleteActionResponse


class ActionNotFoundError(Exception):
    """Raised when a checklist item id does not exist."""

    def __init__(self, action_id: str) -> None:
        super().__init__(f"Unknown action '{action_id}'")
        self.action_id = action_id


class ActionsService:
    """Coordinates checklist reads, completion updates, and challenges."""

    def __init__(self, repository: ActionsRepository) -> None:
        self._repo = repository

    def list_actions(self) -> List[ActionItem]:
        return self._repo.list()

    def complete(self, action_id: str, completed: bool) -> CompleteActionResponse:
        item = self._repo.set_completed(action_id, completed)
        if item is None:
            raise ActionNotFoundError(action_id)

        return CompleteActionResponse(
            action_id=item.id,
            completed=item.completed,
            points_earned=item.points if item.completed else 0,
            total_points=self._repo.total_points(),
            actions=self._repo.list(),
        )

    def list_challenges(self) -> List[dict]:
        """Fetch current status of community challenges."""
        return self._repo.list_challenges()


@lru_cache
def get_actions_service() -> ActionsService:
    """FastAPI dependency provider (cached singleton -> shared database state)."""
    return ActionsService(ActionsRepository())
