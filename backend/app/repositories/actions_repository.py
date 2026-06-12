"""SQLite-backed store for the actions checklist and community challenges."""

from __future__ import annotations

from typing import List, Optional

from app.core import db_session
from app.schemas import ActionItem


class ActionsRepository:
    """Manages actions checklist and gamified points in SQLite."""

    def list(self) -> List[ActionItem]:
        """Query and return all checklist items."""
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, category, label, points, completed FROM actions")
            rows = cursor.fetchall()
            return [
                ActionItem(
                    id=r["id"],
                    label=r["label"],
                    points=r["points"],
                    completed=bool(r["completed"]),
                )
                for r in rows
            ]

    def get(self, action_id: str) -> Optional[ActionItem]:
        """Fetch a single action item by ID."""
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, category, label, points, completed FROM actions WHERE id = ?",
                (action_id,),
            )
            r = cursor.fetchone()
            if r:
                return ActionItem(
                    id=r["id"],
                    label=r["label"],
                    points=r["points"],
                    completed=bool(r["completed"]),
                )
            return None

    def set_completed(self, action_id: str, completed: bool) -> Optional[ActionItem]:
        """Update completion state of an action and automatically progress related challenges."""
        with db_session() as conn:
            cursor = conn.cursor()
            # 1. Fetch action to confirm it exists
            cursor.execute("SELECT * FROM actions WHERE id = ?", (action_id,))
            row = cursor.fetchone()
            if not row:
                return None

            # 2. Update action completion status
            status_val = 1 if completed else 0
            cursor.execute(
                "UPDATE actions SET completed = ? WHERE id = ?", (status_val, action_id)
            )

            # 3. Gamification Engine: Increment or decrement community challenge progress based on action completion
            delta = 1 if completed else -1

            if action_id == "meatless-monday" or action_id == "plant-lunch":
                # Advance Meatless Monday Streak
                cursor.execute(
                    "UPDATE challenges SET progress = MIN(goal, MAX(0, progress + ?)) WHERE id = 'meatless-monday-streak'",
                    (delta,),
                )
            elif action_id == "public-transit" or action_id == "walk-trips":
                # Advance Zero-drive week
                cursor.execute(
                    "UPDATE challenges SET progress = MIN(goal, MAX(0, progress + ?)) WHERE id = 'zero-drive-week'",
                    (delta,),
                )
            elif action_id == "unplug-devices" or action_id == "set-ac-26" or action_id == "cold-wash":
                # Advance Solar switch collective
                cursor.execute(
                    "UPDATE challenges SET progress = MIN(goal, MAX(0, progress + ?)) WHERE id = 'solar-switch-collective'",
                    (delta,),
                )

            # Return updated item
            return ActionItem(
                id=row["id"],
                label=row["label"],
                points=row["points"],
                completed=completed,
            )

    def total_points(self) -> int:
        """Calculate the sum of points for all completed actions."""
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT SUM(points) as total FROM actions WHERE completed = 1")
            row = cursor.fetchone()
            return row["total"] if row["total"] else 0

    def list_challenges(self) -> List[dict]:
        """Fetch all community challenges."""
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, members, progress, goal FROM challenges")
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
