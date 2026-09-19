"""POST /api/transcribe: the app's mic button uses the same Whisper function as the WhatsApp voice path.

Whisper itself is stubbed here (loading the model is slow); test_transcribe_uses_the_shared_whisper_function proves the
endpoint calls the very function the WhatsApp path calls.
"""
import os
from unittest.mock import patch

from fastapi.testclient import TestClient

import app.main as main
from app.main import app

client = TestClient(app)


def _post(data=b"RIFFfakeaudio", filename="voice.m4a", content_type="audio/m4a"):
    return client.post("/api/transcribe", files={"audio": (filename, data, content_type)})


def test_returns_the_transcript_and_transcribes_a_real_file_with_the_right_suffix():
    seen = {}

    def fake(path):
        seen["path"], seen["suffix"], seen["bytes"] = path, os.path.splitext(path)[1], open(path, "rb").read()
        return "I earned 800 from tailoring today"

    with patch("app.main.transcribe_audio", side_effect=fake):
        r = _post(b"AUDIO-BYTES", "note.webm", "audio/webm")
    assert r.status_code == 200
    assert r.json() == {"transcript": "I earned 800 from tailoring today"}
    assert seen["suffix"] == ".webm" and seen["bytes"] == b"AUDIO-BYTES"
    assert not os.path.exists(seen["path"]), "temp audio file must be deleted"


def test_suffix_falls_back_to_the_content_type_when_the_filename_has_none():
    seen = {}
    with patch("app.main.transcribe_audio", side_effect=lambda p: seen.setdefault("s", os.path.splitext(p)[1]) and "x"):
        _post(b"a", "blob", "audio/webm;codecs=opus")
    assert seen["s"] == ".webm"


def test_transcribe_uses_the_shared_whisper_function():
    # The WhatsApp voice path imports the same name; the endpoint must call it (not a second model).
    from app import transcription
    assert main.transcribe_audio is transcription.transcribe_audio


def test_empty_upload_is_400_and_oversize_is_413():
    with patch("app.main.transcribe_audio") as t:
        assert _post(b"").status_code == 400
        assert _post(b"x" * (main.MAX_AUDIO_BYTES + 1)).status_code == 413
        t.assert_not_called()


def test_whisper_failure_is_an_honest_422_and_still_cleans_up():
    paths = []

    def boom(path):
        paths.append(path)
        raise RuntimeError("ffmpeg blew up")

    with patch("app.main.transcribe_audio", side_effect=boom):
        r = _post()
    assert r.status_code == 422 and "couldn't understand" in r.json()["detail"]
    assert paths and not os.path.exists(paths[0])


def test_silence_returns_an_empty_transcript_not_an_error():
    with patch("app.main.transcribe_audio", return_value=""):
        r = _post()
    assert r.status_code == 200 and r.json() == {"transcript": ""}


def test_web_app_can_call_it_cross_origin():
    r = client.options("/api/transcribe", headers={"Origin": "http://localhost:8081", "Access-Control-Request-Method": "POST"})
    assert r.headers.get("access-control-allow-origin") in ("*", "http://localhost:8081")
