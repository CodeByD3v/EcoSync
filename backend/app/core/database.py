"""SQLite database configuration and initialization.

Provides connection helpers and seeds the database with initial actions,
challenges, and history if they are not already present.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Generator
from app.core.config import get_settings

# Database path is resolved dynamically via application Settings
DB_PATH = get_settings().db_path


def get_db_connection() -> sqlite3.Connection:
    """Return a sqlite3 connection with dict-like row formatting and WAL mode enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON;")
    # Enable Write-Ahead Logging (WAL) for better concurrency
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


@contextmanager
def db_session() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for SQLite database connections.

    Automatically commits on success or rolls back on exception, and closes the connection.
    """
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
    """Initialize database tables and seed initial data if empty."""
    with db_session() as conn:
        cursor = conn.cursor()

        # Create tables
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            city TEXT NOT NULL,
            zip_code TEXT DEFAULT '',
            km_driven_per_week REAL DEFAULT 100.0,
            flights_per_year INTEGER DEFAULT 2,
            kwh_per_month REAL DEFAULT 200.0,
            diet TEXT DEFAULT 'mixed',
            new_items_per_month INTEGER DEFAULT 5
        );
        """)

        try:
            cursor.execute("ALTER TABLE profile ADD COLUMN zip_code TEXT DEFAULT '';")
        except sqlite3.OperationalError:
            pass

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS actions (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            label TEXT NOT NULL,
            points INTEGER NOT NULL,
            completed INTEGER DEFAULT 0
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS challenges (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            members INTEGER DEFAULT 0,
            progress INTEGER DEFAULT 0,
            goal INTEGER DEFAULT 100
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS history (
            month TEXT PRIMARY KEY,
            total REAL NOT NULL
        );
        """)

        # Seed Default Profile if none exists
        cursor.execute("SELECT COUNT(*) as cnt FROM profile")
        if cursor.fetchone()["cnt"] == 0:
            cursor.execute("""
            INSERT INTO profile (name, city, km_driven_per_week, flights_per_year, kwh_per_month, diet, new_items_per_month)
            VALUES ('Arjun', 'Bengaluru', 100.0, 2, 200.0, 'mixed', 5)
            """)

        # Seed Default Actions if none exist
        cursor.execute("SELECT COUNT(*) as cnt FROM actions")
        if cursor.fetchone()["cnt"] == 0:
            default_actions = [
                ("plant-lunch", "diet", "Eat a plant-based lunch", 25, 0),
                ("public-transit", "transport", "Take public transit or walk", 30, 0),
                ("cold-wash", "energy", "Wash clothes in cold water", 15, 0),
                ("unplug-devices", "energy", "Unplug idle devices", 10, 0),
                ("reusable-bottle", "shopping", "Use a reusable water bottle", 10, 0),
                ("walk-trips", "transport", "Walk or cycle trips under 3 km", 20, 0),
                ("set-ac-26", "energy", "Set AC to 26C instead of 22C", 25, 0),
                ("meatless-monday", "diet", "Go meat-free on Mondays", 30, 0),
                ("second-hand", "shopping", "Buy second-hand items", 15, 0)
            ]
            cursor.executemany(
                "INSERT INTO actions (id, category, label, points, completed) VALUES (?, ?, ?, ?, ?)",
                default_actions
            )

        # Seed Default Challenges if none exist
        cursor.execute("SELECT COUNT(*) as cnt FROM challenges")
        if cursor.fetchone()["cnt"] == 0:
            default_challenges = [
                ("meatless-monday-streak", "Meatless Monday streak", 142, 0, 100),
                ("zero-drive-week", "Zero-drive week", 89, 0, 100),
                ("solar-switch-collective", "Solar switch collective", 234, 0, 100)
            ]
            cursor.executemany(
                "INSERT INTO challenges (id, name, members, progress, goal) VALUES (?, ?, ?, ?, ?)",
                default_challenges
            )

        # Seed Default History if none exists
        cursor.execute("SELECT COUNT(*) as cnt FROM history")
        if cursor.fetchone()["cnt"] == 0:
            default_history = [
                ("Jan", 420.0),
                ("Feb", 395.0),
                ("Mar", 370.0),
                ("Apr", 355.0),
                ("May", 340.0),
                ("Jun", 310.0)
            ]
            cursor.executemany(
                "INSERT INTO history (month, total) VALUES (?, ?)",
                default_history
            )
