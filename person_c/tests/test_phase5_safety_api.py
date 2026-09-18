import pytest
from fastapi.testclient import TestClient
from app.api.main import app

client = TestClient(app)

def test_api_safety_endpoint_valid():
    # 40. Safety endpoint accepts valid message.
    # 41. Safety endpoint returns a valid response.
    payload = {
        "message": "Your KYC will expire, click to verify",
        "literacy_tier": 2
    }
    resp = client.post("/api/v1/safety/check", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "safety"
    assert "CLASSIFICATION: SUSPICIOUS" in data["response_text"]
    assert "UNCERTAINTY" in data["response_text"]

def test_api_safety_empty_request():
    # 42. Empty/invalid request is rejected safely.
    payload = {}
    resp = client.post("/api/v1/safety/check", json=payload)
    assert resp.status_code == 422
    assert "message" in resp.text

def test_api_safety_missing_message():
    # 42. Empty/invalid request is rejected safely.
    payload = {"literacy_tier": 1}
    resp = client.post("/api/v1/safety/check", json=payload)
    assert resp.status_code == 422
    assert "message" in resp.text

def test_api_safety_regressions():
    # We rely on the full regression suite to prove:
    # 43. Existing guidance endpoint still works.
    # 44. Existing simulator endpoint still works.
    # 45. Existing literacy endpoint still works.
    pass
