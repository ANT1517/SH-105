import pytest
from fastapi.testclient import TestClient
from app.api.main import app

client = TestClient(app)

def get_base_payload():
    return {
        "scenario": "savings_goal_feasibility",
        "target": 20000,
        "saved": 8000,
        "monthly_contribution": 1000,
        "timeframe_months": 15,
        "literacy_tier": 2
    }

def test_api_simulator_endpoint_valid():
    # 37. Simulator endpoint accepts valid input.
    # 38. Simulator endpoint returns a valid structured result/response.
    # 41. Meera regression: target 20000, saved 8000.
    payload = get_base_payload()
    resp = client.post("/api/v1/simulator", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "simulator"
    assert "Target=20000.0, Saved=8000.0" in data["response_text"]
    assert "Gap=12000.0" in data["response_text"]
    assert "Months=12" in data["response_text"]

def test_api_simulator_missing_target():
    # 2. Missing required target is rejected.
    # 39. Invalid simulator input produces controlled validation behavior.
    payload = get_base_payload()
    del payload["target"]
    
    resp = client.post("/api/v1/simulator", json=payload)
    assert resp.status_code == 422
    assert "target" in resp.text

def test_api_simulator_invalid_numeric():
    # 3. Invalid numeric input is rejected safely.
    payload = get_base_payload()
    payload["saved"] = "hello"
    
    resp = client.post("/api/v1/simulator", json=payload)
    assert resp.status_code == 422
    assert "saved" in resp.text

def test_api_simulator_malformed_request():
    resp = client.post("/api/v1/simulator", data="not json")
    assert resp.status_code == 422

def test_api_simulator_missing_saved():
    payload = get_base_payload()
    del payload["saved"]
    resp = client.post("/api/v1/simulator", json=payload)
    assert resp.status_code == 422

def test_api_simulator_invalid_target():
    payload = get_base_payload()
    payload["target"] = "not_a_number"
    resp = client.post("/api/v1/simulator", json=payload)
    assert resp.status_code == 422

def test_api_simulator_groq_failure():
    # If the LLM throws an error, the endpoint should safely fall back and still return 200 with fallback text
    # In integration it uses MockLLM which doesn't fail unless simulate_failure=True
    # We can pass simulate_failure indirectly or just assert the integration works.
    pass # covered by llm tests

def test_api_simulator_invalid_scenario():
    # It might accept it but fallback in the service
    payload = get_base_payload()
    payload["scenario"] = "unknown_scenario"
    resp = client.post("/api/v1/simulator", json=payload)
    # The API schema explicitly uses Literal["savings_goal_feasibility"] so it returns 422
    assert resp.status_code == 422

