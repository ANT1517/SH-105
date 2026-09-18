import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
import httpx
import io
from app.api.main import app
from tests.test_phase6_integration import get_meera_b_response

client = TestClient(app)

@patch("app.integration.person_b.httpx.AsyncClient.get", new_callable=AsyncMock)
def test_e2e_meera_journey(mock_get):
    """
    End-to-End Test for the full Meera journey:
    1. Financial state received via Person B mock
    2. User asks education question
    3. RAG retrieves SEBI financial-goal content (Mock LLM asserts context)
    4. Deterministic goal gap calculated
    5. Literacy tier applied
    6. Mock Groq generates explanation
    7. Simulator evaluates education goal
    8. Safety Shield checks suspicious message
    9. OCR extracts receipt
    """
    # Mock Person B to return Meera's state
    mock_get.return_value = httpx.Response(200, json=get_meera_b_response(), request=httpx.Request("GET", "http://test"))
    
    # --- Step 1 to 6: Education & Personalization ---
    payload_guidance = {
        "user_id": "meera_1",
        "question": "I want to save for education. How should I plan?",
        "request_mode": "personalized",
        "literacy_tier": 2
    }
    resp_guidance = client.post("/api/v1/integration/person_a/guidance", json=payload_guidance)
    assert resp_guidance.status_code == 200
    guidance_data = resp_guidance.json()
    assert guidance_data["mode"] == "personalized"
    # Verify deterministic gap and literacy instructions
    assert "12000" in guidance_data["response_text"]
    assert "TIER 2" in guidance_data["response_text"]
    
    # --- Step 7: Simulator ---
    payload_simulator = {
        "user_id": "meera_1",
        "request_mode": "simulator",
        "literacy_tier": 2
    }
    resp_simulator = client.post("/api/v1/integration/person_a/guidance", json=payload_simulator)
    assert resp_simulator.status_code == 200
    simulator_data = resp_simulator.json()
    assert simulator_data["mode"] == "simulator"
    assert "Gap=12000.0" in simulator_data["response_text"]
    
    # --- Step 8: Safety Shield ---
    payload_safety = {
        "message": "Click this link to update KYC",
        "literacy_tier": 2
    }
    resp_safety = client.post("/api/v1/safety/check", json=payload_safety)
    assert resp_safety.status_code == 200
    safety_data = resp_safety.json()
    assert safety_data["mode"] == "safety"
    assert "system" in safety_data["source_class"].lower()
    
    # --- Step 9: OCR ---
    file_content = b"fake receipt image"
    resp_ocr = client.post(
        "/api/v1/ocr/receipt",
        files={"file": ("receipt.jpg", io.BytesIO(file_content), "image/jpeg")}
    )
    assert resp_ocr.status_code == 200
    ocr_data = resp_ocr.json()
    # It will use MockOCREngine which in the api context returns predefined text
    # In api.main.py we used MockOCREngine(mock_text=["STORE", "TOTAL 500", "18/09/2026"])
    assert "amount" in ocr_data
    assert "date" in ocr_data
