import os
import re
import hashlib
import secrets
from flask import Flask, request, jsonify, make_response
import psycopg
from app.oracle_genai import create_session, get_reply
from oci.exceptions import ServiceError

app = Flask(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL")
LECCAP_BASE = "https://leccap.engin.umich.edu/leccap/player/r/"

# Regex shared by linkify and timestamp extraction
TIMESTAMP_RE = re.compile(r"<([A-Za-z0-9]+),\s*([0-9]+-[0-9]+-[0-9]+),\s*([0-9]+:[0-9]+)>")

def extract_timestamps(text: str):
    """Return list of (recording_id, date_str, time_str) from raw agent text."""
    return [(m.group(1).strip(), m.group(2).strip(), m.group(3).strip())
            for m in TIMESTAMP_RE.finditer(text)]

def linkify_timestamps(text: str) -> str:
    """Replace <CODE, DATE, MM:SS> stubs with markdown links to lecture recordings."""
    def _replace(m):
        code = m.group(1).strip()
        date = m.group(2).strip()
        timestamp = m.group(3).strip()
        parts = timestamp.split(":")
        seconds = int(parts[0]) * 60 + int(parts[1])
        return f"[{timestamp}]({LECCAP_BASE}{code}?start={seconds})"
    return TIMESTAMP_RE.sub(_replace, text)

def get_db():
    return psycopg.connect(DATABASE_URL)

def sha256_hex(s):
    return hashlib.sha256(s.encode()).hexdigest()

def get_or_create_session(resp):
    token = request.cookies.get("sid")

    if not token:
        token = secrets.token_hex(32)
        resp.set_cookie(
            "sid",
            token,
            httponly=True,
            samesite="Lax",
            secure=False,
            max_age=60*60*24*30
        )

    session_hash = sha256_hex(token)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT session_id FROM sessions WHERE session_hash = %s",
                (session_hash,)
            )
            row = cur.fetchone()

            if row:
                return row[0]

            cur.execute(
                "INSERT INTO sessions (session_hash) VALUES (%s) RETURNING session_id",
                (session_hash,)
            )
            session_id = cur.fetchone()[0]
            conn.commit()
            return session_id


@app.route("/api/get_classes", methods=["GET"])
def get_classes():
    resp = make_response()
    get_or_create_session(resp)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM classes ORDER BY name ASC")
            classes = [r[0] for r in cur.fetchall()]

    resp.set_data(jsonify({"classes": classes}).get_data())
    resp.mimetype = "application/json"
    return resp


@app.route("/api/chat_history", methods=["GET"])
def chat_history():
    course = request.args.get("course")
    if not course:
        return jsonify({"error": "Missing ?course="}), 400

    resp = make_response()
    session_id = get_or_create_session(resp)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT class_id FROM classes WHERE name = %s", (course,))
            row = cur.fetchone()
            if not row:
                return jsonify({"results": []})

            class_id = row[0]

            cur.execute(
                "SELECT chat_id FROM chats WHERE session_id = %s AND class_id = %s",
                (session_id, class_id)
            )
            chat = cur.fetchone()
            if not chat:
                return jsonify({"results": []})

            chat_id = chat[0]

            cur.execute(
                """
                SELECT created_at, sender, text
                FROM messages
                WHERE chat_id = %s
                ORDER BY created_at ASC
                """,
                (chat_id,)
            )
            rows = cur.fetchall()

    results = [
        {"time": r[0], "sender": r[1], "text": r[2]}
        for r in rows
    ]

    resp.set_data(jsonify({"results": results}).get_data())
    resp.mimetype = "application/json"
    return resp


@app.route("/api/send_message", methods=["POST"])
def send_message():
    data = request.json
    if not data or "course" not in data or "prompt" not in data:
        return jsonify({"error": "Body must include {course, prompt}"}), 400

    course = data["course"]
    prompt = data["prompt"].strip()

    resp = make_response()
    session_id = get_or_create_session(resp)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT class_id FROM classes WHERE name = %s", (course,))
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "Unknown course"}), 400
            class_id = row[0]

            # Get or create our DB chat, fetching any existing OCI session ID
            cur.execute(
                """
                INSERT INTO chats (session_id, class_id)
                VALUES (%s, %s)
                ON CONFLICT (session_id, class_id)
                DO UPDATE SET session_id = EXCLUDED.session_id
                RETURNING chat_id, oracle_session_id
                """,
                (session_id, class_id)
            )
            chat_id, oracle_session_id = cur.fetchone()

            # Create a new OCI agent session if this is the first message
            if oracle_session_id is None:
                oracle_session_id = create_session(f"{course} - session {chat_id}")
                cur.execute(
                    "UPDATE chats SET oracle_session_id = %s WHERE chat_id = %s",
                    (oracle_session_id, chat_id)
                )

            try:
                agent_reply = get_reply(prompt + " Additionally, when referencing a timestamp, always do so in the format <id, date, time>.", oracle_session_id, course)
                timestamps = extract_timestamps(agent_reply)
                agent_reply = linkify_timestamps(agent_reply)
            except ServiceError as e:
                agent_reply = f"Sorry, the AI agent could not process that request. ({e.message})"
                timestamps = []

            cur.execute(
                "INSERT INTO messages (chat_id, sender, text) VALUES (%s, 'user', %s)",
                (chat_id, prompt)
            )
            cur.execute(
                "INSERT INTO messages (chat_id, sender, text) VALUES (%s, 'agent', %s) RETURNING message_id",
                (chat_id, agent_reply)
            )
            agent_message_id = cur.fetchone()[0]

            # Log every referenced recording timestamp for analytics
            for _rec_id, rec_date, rec_time in timestamps:
                cur.execute(
                    """
                    INSERT INTO recording_hits (message_id, class_id, rec_date, rec_time)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (agent_message_id, class_id, rec_date, rec_time)
                )

        conn.commit()

    resp.set_data(jsonify({"reply": agent_reply}).get_data())
    resp.mimetype = "application/json"
    return resp
