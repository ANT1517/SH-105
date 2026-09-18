import pytest
from fastapi.testclient import TestClient
from app.api.main import app

client = TestClient(app)

def get_meera_payload():
    return {
        "cash": 2000,
        "bank": 5000,
        "shg": 2500,
        "chit_committed": 4000,
        "post_office": 5000,
        "business": {
            "activity": "pickle sales + tailoring",
            "last_entry": {
                "revenue": 1000,
                "cost": 600,
                "profit": 400
            }
        },
        "goal": {
            "name": "Education",
            "target": 20000,
            "saved": 8000
        }
    }

def test_api_quiz_endpoint():
    # 45. Literacy quiz scoring is deterministic and API works.
    resp = client.post("/api/v1/literacy_quiz", json={"answers": ["A", "A", "B"]})
    assert resp.status_code == 200
    assert resp.json()["tier"] == 1

def test_api_personalized_mode():
    # 45. Personalized API request works.
    payload = get_meera_payload()
    payload["request_mode"] = "personalized"
    payload["question"] = "How can I reach my goal?"
    payload["literacy_tier"] = 2
    
    resp = client.post("/api/v1/guidance", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "personalized"
    assert "CALCULATED FACTS" in data["response_text"]
    assert "INSTRUCTIONS FOR TIER 2" in data["response_text"]

def test_api_personalized_mode_missing_question():
    # 48. Invalid personalized requests return controlled validation errors.
    payload = get_meera_payload()
    payload["request_mode"] = "personalized"
    # no question
    
    resp = client.post("/api/v1/guidance", json=payload)
    assert resp.status_code == 400
    assert "Question is required" in resp.json()["detail"]

def test_api_education_mode_still_works():
    # 46. Education API request still works.
    # 47. Existing Phase 1/2 API behavior is not broken.
    payload = get_meera_payload()
    payload["request_mode"] = "education"
    payload["question"] = "What is a money map?"
    
    resp = client.post("/api/v1/guidance", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "education"
    assert "Based on the provided context" in data["response_text"]
