import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

DB_PATH = os.getenv(
    "SESSION_DB_PATH",
    os.path.join(os.path.dirname(__file__), "sessions.db")
)


def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS uploads (
                client_id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                filename TEXT,
                uploaded_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                client_id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                message_history TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def save_upload(
    client_id: str,
    upload_type: str,
    file_path: str,
    filename: Optional[str],
    uploaded_at: Optional[str] = None
) -> None:
    timestamp = uploaded_at or datetime.utcnow().isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO uploads (client_id, type, file_path, filename, uploaded_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (client_id, upload_type, file_path, filename, timestamp)
        )
        conn.commit()


def save_session(
    client_id: str,
    session_type: str,
    message_history: List[Dict[str, Any]]
) -> None:
    timestamp = datetime.utcnow().isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO sessions (client_id, type, message_history, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (client_id, session_type, json.dumps(message_history), timestamp)
        )
        conn.commit()


def update_session_message_history(
    client_id: str,
    message_history: List[Dict[str, Any]]
) -> bool:
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT type FROM sessions WHERE client_id = ?",
            (client_id,)
        ).fetchone()
        if not row:
            return False
        session_type = row[0]
        conn.execute(
            """
            INSERT OR REPLACE INTO sessions (client_id, type, message_history, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (client_id, session_type, json.dumps(message_history), datetime.utcnow().isoformat())
        )
        conn.commit()
        return True


def get_upload(client_id: str) -> Optional[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT client_id, type, file_path, filename, uploaded_at FROM uploads WHERE client_id = ?",
            (client_id,)
        ).fetchone()
    if not row:
        return None
    return {
        "client_id": row[0],
        "type": row[1],
        "file_path": row[2],
        "filename": row[3],
        "uploaded_at": row[4]
    }


def get_session(client_id: str) -> Optional[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT client_id, type, message_history, updated_at FROM sessions WHERE client_id = ?",
            (client_id,)
        ).fetchone()
    if not row:
        return None
    try:
        message_history = json.loads(row[2])
    except json.JSONDecodeError:
        message_history = []
    return {
        "client_id": row[0],
        "type": row[1],
        "message_history": message_history,
        "updated_at": row[3]
    }


def list_uploads(limit: int = 200) -> List[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            """
            SELECT client_id, type, file_path, filename, uploaded_at
            FROM uploads
            ORDER BY uploaded_at DESC
            LIMIT ?
            """,
            (limit,)
        ).fetchall()
    results = []
    for row in rows:
        results.append({
            "client_id": row[0],
            "type": row[1],
            "file_path": row[2],
            "filename": row[3],
            "uploaded_at": row[4]
        })
    return results


def delete_upload(client_id: str) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM uploads WHERE client_id = ?", (client_id,))
        conn.execute("DELETE FROM sessions WHERE client_id = ?", (client_id,))
        conn.commit()
