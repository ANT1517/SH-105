from fastapi.testclient import TestClient
from app.api.main import app
from app.contracts.mocks import DEMO_FIXTURE_DICT

client = TestClient(app)

def test_service_starts():
    # 7. The service can start successfully.
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_basic_endpoint_with_mocked_state():
    # 8. The basic endpoint can receive mocked state and return a valid response-contract-shaped object.
    response = client.post("/api/v1/guidance", json=DEMO_FIXTURE_DICT)
    assert response.status_code == 200
    data = response.json()
    assert "response_text" in data
    assert "source_class" in data
    assert "mode" in data
    assert "disclaimer" in data
    assert data["mode"] in ["education", "personalized"]
