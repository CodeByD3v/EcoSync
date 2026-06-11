"""Deterministic mock data backing the MVP.

Keeping the seed data in one place makes it trivial to later swap these
constants for a database or an external carbon-accounting API without touching
the services or routes.
"""

from __future__ import annotations

from typing import List

from app.schemas import ActionItem, CategoryBreakdown, Insight, TrendPoint

USER_NAME = "Devanand"
YESTERDAY_KG = 15.7

BREAKDOWN: List[CategoryBreakdown] = [
    CategoryBreakdown(name="Home Energy", percentage=42.0, kg=6.1, color="#34d399"),
    CategoryBreakdown(name="Transport", percentage=38.0, kg=5.5, color="#22c55e"),
    CategoryBreakdown(name="Food", percentage=20.0, kg=2.9, color="#a3e635"),
]

TREND: List[TrendPoint] = [
    TrendPoint(label="Mon", value=17.2),
    TrendPoint(label="Tue", value=16.4),
    TrendPoint(label="Wed", value=15.9),
    TrendPoint(label="Thu", value=16.8),
    TrendPoint(label="Fri", value=15.7),
    TrendPoint(label="Sat", value=15.2),
    TrendPoint(label="Sun", value=14.5),
]

INSIGHTS: List[Insight] = [
    Insight(
        id="walk-detected",
        type="positive",
        icon="Footprints",
        title="Smart Walk Detected",
        description="You walked 2 miles today instead of driving.",
        impact_kg=-0.8,
    ),
    Insight(
        id="peak-hours",
        type="alert",
        icon="Zap",
        title="Peak Hours Alert",
        description="Unplug idle devices now to avoid high-carbon grid power.",
        impact_kg=-0.5,
    ),
    Insight(
        id="swap-beef",
        type="swap",
        icon="Salad",
        title="Smart Swap: Lentils for Beef",
        description="Swapping one beef meal this week for lentils cuts emissions.",
        impact_kg=-3.2,
    ),
]


def default_actions() -> List[ActionItem]:
    """Fresh copy of the seed checklist (so each repository owns its state)."""

    return [
        ActionItem(id="plant-lunch", label="Eat a plant-based lunch", points=25, completed=False),
        ActionItem(id="public-transit", label="Take public transit or walk", points=30, completed=False),
        ActionItem(id="cold-wash", label="Wash clothes in cold water", points=15, completed=False),
        ActionItem(id="unplug-devices", label="Unplug idle devices", points=10, completed=False),
        ActionItem(id="reusable-bottle", label="Use a reusable water bottle", points=10, completed=False),
    ]
