from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fastapi import HTTPException
import traceback
from fastapi import Response
import oci

_HENRY_VOICE_ID: str | None = None

app = FastAPI()

# Allow your Vite frontend (5173) to call the backend (8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TTSIn(BaseModel):
    text: str
    voice: str | None = None  # optional override

@app.get("/health")
def health():
    return {"ok": True}


def oci_tts_mp3(text: str) -> bytes:
    global _HENRY_VOICE_ID

    config = oci.config.from_file(profile_name="DEFAULT")
    scope_ocid = config.get("compartment_id") or config.get("tenancy")
    client = oci.ai_speech.AIServiceSpeechClient(config)

    language_code = "en-US"
    model_name = "TTS_2_NATURAL"
    sample_rate_in_hz = 24000

    if _HENRY_VOICE_ID is None:
        voices_resp = client.list_voices(
            compartment_id=scope_ocid,
            language_code=language_code,
            model_name=model_name,
            display_name="Henry",
        )
        voices = getattr(voices_resp.data, "items", None) or []
        if not voices:
            raise RuntimeError("Henry voice not found")
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
        audio_config=oci.ai_speech.models.TtsBaseAudioConfig(config_type="BASE_AUDIO_CONFIG"),
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

@app.post("/api/tts")
def tts(req: TTSIn):
    try:
        mp3 = oci_tts_mp3(req.text)
        return Response(content=mp3, media_type="audio/mpeg")
    except oci.exceptions.ServiceError as e:
        # OCI service rejected the request (IAM, compartment/tenancy scope, region, etc.)
        print("OCI ServiceError:", e)
        raise HTTPException(
            status_code=e.status if hasattr(e, "status") else 500,
            detail={
                "code": getattr(e, "code", None),
                "message": str(e),
                "opc_request_id": getattr(e, "opc_request_id", None),
            },
        )
    except Exception as e:
        # Anything else (bad config, missing file, etc.)
        print("TTS unexpected error:", repr(e))
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))