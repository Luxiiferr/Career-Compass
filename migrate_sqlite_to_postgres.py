"""One-time migration tool for moving CareerCompass data from SQLite to PostgreSQL.

Usage:
  1. Set DATABASE_URL to the target PostgreSQL connection URL.
  2. Run: python migrate_sqlite_to_postgres.py --replace

The --replace flag is intentional: it clears the TARGET PostgreSQL tables before
copying local SQLite data. It never changes the SQLite source database.
"""
import argparse
import sqlite3
import sys
from pathlib import Path

import app as career_app


TABLES = ("users", "assessments", "verification_codes", "faculty_notes")
INTEGER_COLUMNS = {"users": {"id", "age"}, "assessments": {"id", "user_id", "score"},
                   "verification_codes": {"id", "attempts"}, "faculty_notes": {"id", "student_id", "faculty_id"}}


def postgres_value(table, column, value):
    """SQLite may store blank text in an integer column; PostgreSQL correctly rejects it."""
    if column in INTEGER_COLUMNS.get(table, set()) and value == "":
        return None
    return value


def migrate(source_path):
    if not career_app.USING_POSTGRES:
        raise RuntimeError("Set DATABASE_URL to a PostgreSQL connection URL before running this script.")
    if not source_path.is_file():
        raise RuntimeError(f"SQLite source database was not found: {source_path}")

    source = sqlite3.connect(source_path)
    source.row_factory = sqlite3.Row
    target = career_app.connect_db()
    try:
        # The target may contain the development administrator created during schema setup.
        target.execute("TRUNCATE TABLE faculty_notes, assessments, verification_codes, users RESTART IDENTITY CASCADE")
        for table in TABLES:
            columns = [row["name"] for row in source.execute(f"PRAGMA table_info({table})").fetchall()]
            if not columns:
                continue
            placeholders = ", ".join("?" for _ in columns)
            insert = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"
            rows = source.execute(f"SELECT {', '.join(columns)} FROM {table}").fetchall()
            for row in rows:
                target.execute(insert, tuple(postgres_value(table, column, row[column]) for column in columns))
            print(f"Migrated {len(rows)} row(s) from {table}.")

        for table in TABLES:
            target.execute(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE((SELECT MAX(id) FROM {table}), 1), true)"
            )
        target.commit()
        print("Migration completed successfully. The SQLite source database was not modified.")
    except Exception:
        target.connection.rollback()
        raise
    finally:
        source.close()
        target.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Copy CareerCompass SQLite data to PostgreSQL.")
    parser.add_argument("--source", default="careercompass.db", help="Path to the SQLite source database.")
    parser.add_argument("--replace", action="store_true", help="Required acknowledgement that target PostgreSQL tables will be cleared.")
    args = parser.parse_args()
    if not args.replace:
        sys.exit("Migration was not started. Re-run with --replace after confirming the PostgreSQL target can be cleared.")
    try:
        migrate(Path(args.source).resolve())
    except Exception as error:
        sys.exit(f"Migration failed: {error}")
