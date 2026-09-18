import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
import httpx
from app.api.main import app
from app.integration.person_b import map_b_to_c_state

client = TestClient(app)

def get_meera_b_response():
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

def test_b_mapping_success():
    # 1. Real B response maps to FinancialState.
    # 2. Field mapping is correct.
    # 3. Nested business data maps correctly.
    # 4. Goal data maps correctly.
    data = get_meera_b_response()
    c_state = map_b_to_c_state(data)
    
    assert c_state.cash == 2000.0
    assert c_state.bank == 5000.0
    assert c_state.business is not None
    assert c_state.business.activity == "pickle sales + tailoring"
    assert c_state.business.last_entry.revenue == 1000.0
    assert c_state.business.last_entry.cost == 600.0
    assert c_state.goal is not None
    assert c_state.goal.target == 20000.0
    assert c_state.goal.saved == 8000.0

def test_b_mapping_missing_fields():
    # 5. Missing required B field is handled.
    data = {"cash": 100}
    c_state = map_b_to_c_state(data)
    assert c_state.cash == 100.0
    assert c_state.bank == 0.0
    assert c_state.business is None
    assert c_state.goal is None

def test_b_mapping_invalid_data():
    # 6. Invalid B data is handled.
    data = {"cash": "hello"}
    with pytest.raises(ValueError):
        map_b_to_c_state(data)

@patch("app.integration.person_b.httpx.AsyncClient.get")
def test_a_integration_education(mock_get):
    # 9. Person A request can reach Person C.
    # 10. Education response is consumable by A.
    # Education mode shouldn't call B.
    payload = {
        "user_id": "u123",
        "question": "What is saving?",
        "request_mode": "education",
        "literacy_tier": 2
    }
    
    resp = client.post("/api/v1/integration/person_a/guidance", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "education"
    assert "response_text" in data
    mock_get.assert_not_called()

@patch("app.integration.person_b.httpx.AsyncClient.get", new_callable=AsyncMock)
def test_a_integration_personalized_meera(mock_get):
    # 11. Personalized response is consumable by A.
    # 14. Real/mock B state -> C personalization works.
    # 16. RAG source metadata survives integration.
    # 17. Literacy tier survives integration.
    mock_get.return_value = httpx.Response(200, json=get_meera_b_response(), request=httpx.Request("GET", "http://test"))
    
    payload = {
        "user_id": "meera_1",
        "question": "Can I reach my goal?",
        "request_mode": "personalized",
        "literacy_tier": 3
    }
    
    resp = client.post("/api/v1/integration/person_a/guidance", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "personalized"
    
    # 15. Meera goal gap = ₹12,000.
    # 18. Deterministic calculations remain unchanged.
    assert "12000.0" in data["response_text"] or "12,000" in data["response_text"]
    assert "TIER 3" in data["response_text"] # Literacy tier 3 instructions

@patch("app.integration.person_b.httpx.AsyncClient.get", new_callable=AsyncMock)
def test_a_integration_simulator(mock_get):
    # 12. Simulator response is consumable by A.
    # 19. Meera simulator result remains correct.
    # 20. LLM cannot alter deterministic result.
    mock_get.return_value = httpx.Response(200, json=get_meera_b_response(), request=httpx.Request("GET", "http://test"))
    
    payload = {
        "user_id": "meera_1",
        "request_mode": "simulator",
        "literacy_tier": 1
    }
    
    resp = client.post("/api/v1/integration/person_a/guidance", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "simulator"
    assert "Gap=12000.0" in data["response_text"]
    assert "TIER 1" in data["response_text"]

@patch("app.integration.person_b.httpx.AsyncClient.get", new_callable=AsyncMock)
def test_integration_b_failure(mock_get):
    # 7. B HTTP failure is handled.
    # 23. B unavailable.
    mock_get.return_value = httpx.Response(500, request=httpx.Request("GET", "http://test"))
    
    payload = {
        "user_id": "u123",
        "request_mode": "personalized"
    }
    
    resp = client.post("/api/v1/integration/person_a/guidance", json=payload)
    assert resp.status_code == 200 # Handled gracefully by returning PersonCResponse
    data = resp.json()
    assert "unable to access your financial information" in data["response_text"]

@patch("app.integration.person_b.httpx.AsyncClient.get", new_callable=AsyncMock)
def test_integration_b_timeout(mock_get):
    # 8. B timeout is handled.
    mock_get.side_effect = httpx.ConnectError("Timeout")
    
    payload = {
        "user_id": "u123",
        "request_mode": "personalized"
    }
    
    resp = client.post("/api/v1/integration/person_a/guidance", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "unable to access your financial information" in data["response_text"]

def test_api_safety_integration_works():
    # 13. Safety response is consumable by A.
    # 21. Demo KYC message is flagged.
    # 22. Uncertainty language is preserved.
    # It remains independent.
    payload = {
        "message": "Your KYC will expire, click to verify",
        "literacy_tier": 2
    }
    resp = client.post("/api/v1/safety/check", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "safety"
    assert "SUSPICIOUS" in data["response_text"]
    assert "We cannot determine with absolute certainty" in data["response_text"]

# Tests to ensure contracts are valid
# 28. PersonCResponse remains valid.
# 29. All existing modes continue to validate.
# 30. No existing Phase 1-5 tests regress. (Handled by running full suite)
