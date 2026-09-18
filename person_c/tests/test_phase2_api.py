from fastapi.testclient import TestClient
from app.api.main import app
from app.contracts.mocks import DEMO_FIXTURE_DICT

client = TestClient(app)

def test_api_education_request_success():
    # 26. POST /api/v1/guidance can execute an education request.
    # 27. The endpoint returns the existing response contract.
    payload = DEMO_FIXTURE_DICT.copy()
    payload["request_mode"] = "education"
    payload["question"] = "What is a money map?"
    
    response = client.post("/api/v1/guidance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "education"
    assert data["source_class"] == "RBI/SEBI/NCFE"
    assert "Based on the provided context:" in data["response_text"]
    assert "Money Map" in data["response_text"]
    assert data["disclaimer"] is True

def test_api_education_request_missing_question():
    payload = DEMO_FIXTURE_DICT.copy()
    payload["request_mode"] = "education"
    # no question
    
    response = client.post("/api/v1/guidance", json=payload)
    assert response.status_code == 400
    assert "Question is required" in response.json()["detail"]

def test_existing_phase1_api_tests_still_pass():
    # 28. Existing Phase 1 API tests still pass.
    # We implicitly run all tests, but we can verify the default behavior here too.
    response = client.post("/api/v1/guidance", json=DEMO_FIXTURE_DICT)
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "personalized"
    assert data["source_class"] == "research"
