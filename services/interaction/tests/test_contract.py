import json
from pathlib import Path
import pytest
from jsonschema import Draft202012Validator, ValidationError
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

def get_repo_root() -> Path:
    # Current file is in services/interaction/tests/test_contract.py
    # Root is three levels up
    return Path(__file__).resolve().parent.parent.parent.parent

@pytest.fixture
def schema():
    schema_path = get_repo_root() / "contracts" / "normalized-input.schema.json"
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)

@pytest.fixture
def income_voice_fixture():
    fixture_path = get_repo_root() / "contracts" / "examples" / "income-voice.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        return json.load(f)

def test_income_voice_matches_schema(schema, income_voice_fixture):
    validator = Draft202012Validator(schema)
    try:
        validator.validate(income_voice_fixture)
    except ValidationError as e:
        pytest.fail(f"Fixture failed validation: {e.message}")

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"service": "interaction", "status": "ok"}

def test_mock_normalized_input_endpoint():
    response = client.get("/mock/normalized-input")
    assert response.status_code == 200
    assert response.json()["user_id"] == "meera_001"

def test_webhook_whatsapp_with_text():
    # "hello" is not a transaction, so it is answered by Person C (stubbed here) rather than echoed.
    from unittest.mock import AsyncMock, MagicMock, patch
    stub = MagicMock(status_code=200)
    stub.json.return_value = {"response_text": "Hello! How can I help with your money today?"}
    with patch("app.person_c.httpx.AsyncClient.post", new_callable=AsyncMock, return_value=stub):
        response = _post_hello()
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/xml"
    assert "Hello! How can I help with your money today?" in response.text

def _post_hello():
    return client.post(
        "/webhooks/whatsapp",
        data={
            "From": "whatsapp:+1234567890",
            "Body": "hello",
            "MessageSid": "SM123",
            "NumMedia": "0"
        }
    )

def test_webhook_whatsapp_empty_body():
    response = client.post(
        "/webhooks/whatsapp",
        data={
            "From": "whatsapp:+1234567890",
            "MessageSid": "SM123",
            "NumMedia": "0"
        }
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/xml"
    assert "Saathi received your message. Please send some text." in response.text

from unittest.mock import patch
import httpx

@patch("app.main.download_twilio_media")
@patch("app.main.transcribe_audio")
def test_webhook_whatsapp_with_voice(mock_transcribe, mock_download):
    mock_download.return_value = "/tmp/mock.ogg"
    mock_transcribe.return_value = "I earned 800 from tailoring today."
    
    response = client.post(
        "/webhooks/whatsapp",
        data={
            "From": "whatsapp:+1234567890",
            "MessageSid": "SM123",
            "NumMedia": "1",
            "MediaUrl0": "https://api.twilio.com/mock.ogg",
            "MediaContentType0": "audio/ogg"
        }
    )
    
    assert response.status_code == 200
    assert "I heard: I earned 800 from tailoring today." in response.text

def test_webhook_whatsapp_missing_mediaurl():
    response = client.post(
        "/webhooks/whatsapp",
        data={
            "From": "whatsapp:+1234567890",
            "MessageSid": "SM123",
            "NumMedia": "1",
            "MediaContentType0": "audio/ogg"
        }
    )
    assert response.status_code == 200
    assert "I couldn&#39;t access that voice message." in response.text or "I couldn't access that voice message." in response.text

def test_webhook_whatsapp_non_audio():
    response = client.post(
        "/webhooks/whatsapp",
        data={
            "From": "whatsapp:+1234567890",
            "MessageSid": "SM123",
            "NumMedia": "1",
            "MediaUrl0": "https://api.twilio.com/mock.mp4",
            "MediaContentType0": "video/mp4"
        }
    )
    assert response.status_code == 200
    assert "Saathi currently supports voice messages." in response.text

@patch("app.main.download_twilio_media")
@patch("app.main.transcribe_audio")
def test_webhook_whatsapp_transcription_error(mock_transcribe, mock_download):
    mock_download.return_value = "/tmp/mock.ogg"
    mock_transcribe.side_effect = Exception("Whisper failed")
    
    response = client.post(
        "/webhooks/whatsapp",
        data={
            "From": "whatsapp:+1234567890",
            "MessageSid": "SM123",
            "NumMedia": "1",
            "MediaUrl0": "https://api.twilio.com/mock.ogg",
            "MediaContentType0": "audio/ogg"
        }
    )
    assert response.status_code == 200
    assert "I couldn&#39;t understand that voice message." in response.text or "I couldn't understand that voice message." in response.text

@patch("app.main.download_twilio_media")
@patch("app.main.transcribe_audio")
def test_webhook_whatsapp_empty_transcript(mock_transcribe, mock_download):
    mock_download.return_value = "/tmp/mock.ogg"
    mock_transcribe.return_value = ""
    
    response = client.post(
        "/webhooks/whatsapp",
        data={
            "From": "whatsapp:+1234567890",
            "MessageSid": "SM123",
            "NumMedia": "1",
            "MediaUrl0": "https://api.twilio.com/mock.ogg",
            "MediaContentType0": "audio/ogg"
        }
    )
    assert response.status_code == 200
    assert "I couldn&#39;t hear any speech clearly." in response.text or "I couldn't hear any speech clearly." in response.text


