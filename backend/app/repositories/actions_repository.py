"""In-memory store for the actions checklist.

Swap this class for one backed by a real database to add persistence; the
service and route layers stay unchanged.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from app.data import mock_data
from app.schemas import ActionItem


class ActionsRepository:
    def __init__(self) -> None:
        self._items: Dict[str, ActionItem] = {a.id: a for a in mock_data.default_actions()}

    def list(self) -> List[ActionItem]:
        return list(self._items.values())

    def get(self, action_id: str) -> Optional[ActionItem]:
        return self._items.get(action_id)

    def set_completed(self, action_id: str, completed: bool) -> Optional[ActionItem]:
        item = self._items.get(action_id)
        if item is None:
            return None
        item.completed = completed
        return item

    def total_points(self) -> int:
        return sum(a.points for a in self._items.values() if a.completed)
