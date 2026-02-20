import os
import re
import hashlib
import secrets
from flask import Flask, request, jsonify, make_response, send_file
import psycopg
from app.oracle_genai import create_session, get_reply, generate_podcast as generate_podcast_ai, _load_config
from oci.exceptions import ServiceError
import oci
from io import BytesIO

app = Flask(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL")
LECCAP_BASE = "https://leccap.engin.umich.edu/leccap/player/r/"

_HENRY_VOICE_ID: str | None = None

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


def oci_tts_mp3(text: str) -> bytes:
    """Generate MP3 audio from text using OCI TTS with Henry voice."""
    global _HENRY_VOICE_ID

    config = _load_config()
    scope_ocid = config.get("compartment_id") or config.get("tenancy")
    if not scope_ocid:
        raise ValueError("Missing tenancy in ~/.oci/config [DEFAULT].")

    client = oci.ai_speech.AIServiceSpeechClient(config)

    language_code = "en-US"
    model_name = "TTS_2_NATURAL"
    sample_rate_in_hz = 24000

    # Resolve Henry voice ID once and cache it
    if _HENRY_VOICE_ID is None:
        voices_resp = client.list_voices(
            compartment_id=scope_ocid,
            language_code=language_code,
            model_name=model_name,
            display_name="Henry",
        )
        voices = getattr(voices_resp.data, "items", None) or []
        if not voices:
            raise RuntimeError("Henry voice not found for TTS_2_NATURAL model.")
        _HENRY_VOICE_ID = voices[0].voice_id

    model_details = oci.ai_speech.models.TtsOracleTts2NaturalModelDetails(
        model_name=model_name,
        voice_id=_HENRY_VOICE_ID,
        language_code=language_code,
    )

    synth_details = oci.ai_speech.models.SynthesizeSpeechDetails(
        text=text,
        is_stream_enabled=False,
        compartment_id=scope_ocid,
        configuration=oci.ai_speech.models.TtsOracleConfiguration(
            model_family="ORACLE",
            model_details=model_details,
            speech_settings=oci.ai_speech.models.TtsOracleSpeechSettings(
                text_type="TEXT",
                output_format="MP3",
                sample_rate_in_hz=sample_rate_in_hz,
            ),
        ),
        audio_config=oci.ai_speech.models.TtsBaseAudioConfig(
            config_type="BASE_AUDIO_CONFIG",
        ),
    )

    resp = client.synthesize_speech(synthesize_speech_details=synth_details)

    stream = resp.data
    out = bytearray()

    if hasattr(stream, "raw") and hasattr(stream.raw, "stream"):
        for chunk in stream.raw.stream(1024 * 1024, decode_content=False):
            if chunk:
                out.extend(chunk)
    elif hasattr(stream, "read"):
        while True:
            chunk = stream.read(1024 * 1024)
            if not chunk:
                break
            out.extend(chunk)
    else:
        out.extend(bytes(stream))

    return bytes(out)


@app.route("/api/tts", methods=["POST"])
def tts():
    data = request.json
    if not data or "text" not in data:
        return jsonify({"error": "Body must include {text}"}), 400

    text = data["text"].strip()
    if not text:
        return jsonify({"error": "text cannot be empty"}), 400

    try:
        mp3_bytes = oci_tts_mp3(text)
        return send_file(
            BytesIO(mp3_bytes),
            mimetype="audio/mpeg",
            as_attachment=False
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/generate_podcast", methods=["POST"])
def generate_podcast():
    """Generate a podcast summary for a specific lecture recording."""
    data = request.json
    if not data or "course" not in data or "recording_id" not in data:
        return jsonify({"error": "Body must include {course, recording_id}"}), 400

    course = data["course"].strip()
    recording_id = data["recording_id"].strip()

    if not course or not recording_id:
        return jsonify({"error": "course and recording_id cannot be empty"}), 400

    resp = make_response()
    session_id = get_or_create_session(resp)

    try:
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
                    oracle_session_id = create_session(f"{course} - podcast {chat_id}")
                    cur.execute(
                        "UPDATE chats SET oracle_session_id = %s WHERE chat_id = %s",
                        (oracle_session_id, chat_id)
                    )

        # Create a podcast generation prompt
        podcast_prompt = """
        You are a teaching assistant writing a spoken refresher script for students about to
        attend the next lecture. Your job is to briefly re-teach the material — not describe
        it, not list it, but actually explain it again as if the student forgot everything.

        Write in a conversational, present-tense, first-person plural tone ("we", "you").
        Explain concepts mechanically and concretely — always say HOW something works,
        not just THAT it exists or is important.

        Structure:
        - Follow the order concepts were taught in the lecture
        - For each concept: one framing sentence, 2-3 sentences of concrete explanation,
        one example or analogy from the lecture
        - Transition between topics using phrases like "Building on that...",
        "Which brings us to...", "Related to this...", "And this is where X comes in..."

        Content rules:
        - Only use information explicitly present in the retrieved chunks — do not infer,
        generalize, or fill gaps with outside knowledge
        - If a concept is not in the retrieved content, do not include it
        - Every concept needs its actual mechanics explained — never say "this is important
        for consistency" without explaining the mechanism that ensures that consistency
        - If a concept is a prerequisite for another, introduce it first regardless of order
        in the retrieved content
        - Never repeat a concept already explained — every paragraph must introduce something new
        - Skip setup statements framed as assumptions or simplifications unless the assumption
        itself is the core concept
        - Give equal depth to each concept — do not rush later concepts because earlier
        ones took too long

        Format rules:
        - Start immediately with the first substantive concept — no intro sentence,
        no "in this lecture", no "today we"
        - DIVE RIGHT INTO IT, NOT INTRO, NO FLUFF.
        - No bullet points, no headers, no timestamps
        - ABSOLUTELY NO TIMESTAMPS
        - ABSOLUTELY NO LECTURE ID
        - No filler phrases like "this is critical", "it's essential to understand",
        "this is important" — just explain the thing
        - Do not conclude or summarize at the end — end on the last concept
        - Write approximately 700 words — do not stop early
        - If you are approaching the end, wrap up the current concept cleanly
        rather than cutting off mid-sentence
        """
        # Call generate_podcast_ai to generate the podcast content filtered by recording_id
        try:
            podcast_text = generate_podcast_ai(podcast_prompt, str(oracle_session_id), recording_id)
        except ServiceError as e:
            podcast_text = f"Sorry, the podcast generator could not process that request. {e.message}"

        # Convert the podcast text to speech
        mp3_bytes = oci_tts_mp3(podcast_text)

        return send_file(
            BytesIO(mp3_bytes),
            mimetype="audio/mpeg",
            as_attachment=False
        )
    except Exception as e:
        print(f"Podcast generation error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/professor/heatmap", methods=["GET"])
def professor_heatmap():
    """Return per-lecture heatmap data for a course.

    Each lecture date becomes a row.  The `counts` array holds the number of
    student questions that referenced a timestamp falling inside each
    consecutive 5-minute bucket (0-4:59, 5-9:59, …).  The frontend renders
    these as coloured cells (green → red).
    """
    course = request.args.get("course")
    if not course:
        return jsonify({"error": "Missing ?course="}), 400

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT class_id FROM classes WHERE name = %s", (course,))
            row = cur.fetchone()
            if not row:
                return jsonify({"lectures": []})
            class_id = row[0]

            # Pull every hit for this class, ordered by lecture date
            cur.execute(
                """
                SELECT rec_date, rec_time
                FROM   recording_hits
                WHERE  class_id = %s
                ORDER  BY rec_date, rec_time
                """,
                (class_id,),
            )
            rows = cur.fetchall()

    # Group hits by lecture date and bucket into 5-min chunks
    from collections import defaultdict
    date_hits = defaultdict(list)  # date -> [total_seconds, …]
    for rec_date, rec_time in rows:
        # rec_time is stored as "MM:SS"
        parts = rec_time.split(":")
        try:
            total_seconds = int(parts[0]) * 60 + int(parts[1])
        except (ValueError, IndexError):
            total_seconds = 0
        date_hits[rec_date].append(total_seconds)

    CHUNK = 300  # 5 minutes in seconds

    lectures = []
    for idx, (rec_date, seconds_list) in enumerate(sorted(date_hits.items()), start=1):
        max_sec = max(seconds_list) if seconds_list else 0
        n_chunks = max(max_sec // CHUNK + 1, 1)
        counts = [0] * n_chunks
        for s in seconds_list:
            bucket = min(s // CHUNK, n_chunks - 1)
            counts[bucket] += 1
        lectures.append({
            "id": idx,
            "date": str(rec_date),
            "duration_minutes": n_chunks * 5,
            "counts": counts,
        })

    return jsonify({"lectures": lectures})
