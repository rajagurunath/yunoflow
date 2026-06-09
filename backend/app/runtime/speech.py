"""ElevenLabs voice: speech-to-text (Scribe) and text-to-speech.

Powers two features:
  * voice -> workflow: transcribe a *spoken* request, then feed the text to the
    NL workflow generator (``generator.generate_workflow_spec``);
  * voice-back: speak an agent's answer or a workflow explanation aloud.

The API key stays server-side — the browser only ships/receives audio bytes, so
the credential is never exposed to the client (a lesson from the earlier breach).
"""
from __future__ import annotations

import httpx

from app.core.config import settings
from app.core.errors import AppError

_BASE = "https://api.elevenlabs.io/v1"


def _require_key() -> str:
    if not settings.elevenlabs_api_key:
        raise AppError(
            "Voice is not configured — set ELEVENLABS_API_KEY on the backend.",
            code="voice_unconfigured", status_code=503,
        )
    return settings.elevenlabs_api_key


async def transcribe_audio(data: bytes, filename: str = "audio.webm",
                           content_type: str = "audio/webm") -> str:
    """Transcribe recorded audio via ElevenLabs Scribe -> plain text."""
    key = _require_key()
    form = {"model_id": settings.elevenlabs_stt_model}
    # Pin the language so Scribe doesn't auto-detect (and mis-transcribe in
    # another language); blank = let ElevenLabs auto-detect.
    if settings.elevenlabs_stt_language:
        form["language_code"] = settings.elevenlabs_stt_language
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{_BASE}/speech-to-text",
            headers={"xi-api-key": key},
            data=form,
            files={"file": (filename, data, content_type)},
        )
    if resp.status_code >= 400:
        raise AppError(f"transcription failed: {resp.text[:200]}",
                       code="stt_failed", status_code=502)
    return ((resp.json() or {}).get("text") or "").strip()


async def synthesize_speech(text: str) -> bytes:
    """Render text to speech via ElevenLabs -> mp3 bytes."""
    key = _require_key()
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{_BASE}/text-to-speech/{settings.elevenlabs_voice_id}",
            headers={"xi-api-key": key, "accept": "audio/mpeg"},
            json={"text": text, "model_id": settings.elevenlabs_tts_model},
        )
    if resp.status_code >= 400:
        raise AppError(f"speech synthesis failed: {resp.text[:200]}",
                       code="tts_failed", status_code=502)
    return resp.content
