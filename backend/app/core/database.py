"""SQLite database configuration and initialization."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Generator
from app.core.config import get_settings

DB_PATH = get_settings().db_path


def get_db_connection() -> sqlite3.Connection:
    """Return a sqlite3 connection with dict-like row formatting and WAL mode enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


@contextmanager
def db_session() -> Generator[sqlite3.Connection, None, None]:
    """Context manager: commits on success, rolls back on exception, always closes."""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Initialize database tables and seed safe placeholder data if empty."""
    with db_session() as conn:
        cursor = conn.cursor()

        # ── profile ────────────────────────────────────────────────────────────
        # is_onboarded = 0 → startup placeholder, NOT real user data
        # is_onboarded = 1 → set by POST /onboard once a real user completes setup
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS profile (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            name                TEXT    NOT NULL DEFAULT '',
            city                TEXT    NOT NULL DEFAULT '',
            zip_code            TEXT    DEFAULT '',
            km_driven_per_week  REAL    DEFAULT 100.0,
            flights_per_year    INTEGER DEFAULT 2,
            kwh_per_month       REAL    DEFAULT 200.0,
            diet                TEXT    DEFAULT 'mixed',
            new_items_per_month INTEGER DEFAULT 5,
            is_onboarded        INTEGER DEFAULT 0
        );
        """)

        # ── safe migrations for existing DBs ──────────────────────────────────
        for migration in [
            "ALTER TABLE profile ADD COLUMN zip_code TEXT DEFAULT '';",
            "ALTER TABLE profile ADD COLUMN is_onboarded INTEGER DEFAULT 0;",
        ]:
            try:
                cursor.execute(migration)
            except sqlite3.OperationalError:
                pass  # column already exists — safe to ignore

        # ── actions ───────────────────────────────────────────────────────────
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS actions (
            id        TEXT    PRIMARY KEY,
            category  TEXT    NOT NULL,
            label     TEXT    NOT NULL,
            points    INTEGER NOT NULL,
            completed INTEGER DEFAULT 0
        );
        """)

        # ── challenges ────────────────────────────────────────────────────────
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS challenges (
            id       TEXT    PRIMARY KEY,
            name     TEXT    NOT NULL,
            members  INTEGER DEFAULT 0,
            progress INTEGER DEFAULT 0,
            goal     INTEGER DEFAULT 100
        );
        """)

        # ── history ───────────────────────────────────────────────────────────
        # is_seeded = 1 marks rows that are regional estimates, not real user data.
        # The frontend chart uses these as a backdrop; they are replaced on onboarding.
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS history (
            month     TEXT    PRIMARY KEY,
            total     REAL    NOT NULL,
            is_seeded INTEGER DEFAULT 0
        );
        """)
        try:
            cursor.execute("ALTER TABLE history ADD COLUMN is_seeded INTEGER DEFAULT 0;")
        except sqlite3.OperationalError:
            pass

        # Index for faster history queries (idempotent)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_month ON history(month);")

        # ── seed placeholder profile (no fake name/city) ──────────────────────
        cursor.execute("SELECT COUNT(*) as cnt FROM profile")
        if cursor.fetchone()["cnt"] == 0:
            cursor.execute("""
            INSERT INTO profile
                (name, city, zip_code, km_driven_per_week, flights_per_year,
                 kwh_per_month, diet, new_items_per_month, is_onboarded)
            VALUES ('', '', '', 100.0, 2, 200.0, 'mixed', 5, 0)
            """)

        # ── seed actions ──────────────────────────────────────────────────────
        cursor.execute("SELECT COUNT(*) as cnt FROM actions")
        if cursor.fetchone()["cnt"] == 0:
            cursor.executemany(
                "INSERT INTO actions (id, category, label, points, completed) VALUES (?, ?, ?, ?, ?)",
                [
                    ("plant-lunch",     "diet",      "Eat a plant-based lunch",         25, 0),
                    ("public-transit",  "transport", "Take public transit or walk",      30, 0),
                    ("cold-wash",       "energy",    "Wash clothes in cold water",       15, 0),
                    ("unplug-devices",  "energy",    "Unplug idle devices",              10, 0),
                    ("reusable-bottle", "shopping",  "Use a reusable water bottle",      10, 0),
                    ("walk-trips",      "transport", "Walk or cycle trips under 3 km",   20, 0),
                    ("set-ac-26",       "energy",    "Set AC to 26C instead of 22C",     25, 0),
                    ("meatless-monday", "diet",      "Go meat-free on Mondays",          30, 0),
                    ("second-hand",     "shopping",  "Buy second-hand items",            15, 0),
                ],
            )

        # ── seed challenges ───────────────────────────────────────────────────
        cursor.execute("SELECT COUNT(*) as cnt FROM challenges")
        if cursor.fetchone()["cnt"] == 0:
            cursor.executemany(
                "INSERT INTO challenges (id, name, members, progress, goal) VALUES (?, ?, ?, ?, ?)",
                [
                    ("meatless-monday-streak",  "Meatless Monday streak",  142, 0, 100),
                    ("zero-drive-week",          "Zero-drive week",          89, 0, 100),
                    ("solar-switch-collective",  "Solar switch collective",  234, 0, 100),
                ],
            )

        # ── seed history (regional trend estimates, flagged as is_seeded=1) ───
        # These are India-average monthly estimates, NOT specific to any user.
        # POST /onboard replaces Jan–May with NULL (removes them) and recalculates
        # Jun from the real user profile, so these are only ever shown to a brand-
        # new unboarded session and are clearly labelled in the frontend chart.
        cursor.execute("SELECT COUNT(*) as cnt FROM history")
        if cursor.fetchone()["cnt"] == 0:
            cursor.executemany(
                "INSERT INTO history (month, total, is_seeded) VALUES (?, ?, 1)",
                [
                    ("Jan", 420.0),
                    ("Feb", 395.0),
                    ("Mar", 370.0),
                    ("Apr", 355.0),
                    ("May", 340.0),
                    ("Jun", 167.0),  # India avg 2000 / 12 ≈ 167
                ],
            )
