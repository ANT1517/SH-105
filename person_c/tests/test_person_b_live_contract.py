"""Person C client vs Person B's REAL /api/financial-state contract (not the flat /mock fixture).

No network and no database: httpx is patched. LIVE_B_RESPONSE is a verbatim response shape from a
running Person B (Supabase-backed) for meera_001.
"""
from unittest.mock import patch, AsyncMock, MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.main import app
from app.integration.person_b import PersonBClient, map_b_to_c_state

client = TestClient(app)

LIVE_B_RESPONSE = {
    "user_id": "meera_001",
    "pots": {"cash": 2000, "bank": 5000, "shg": 2500, "chit_committed": 4000, "post_office": 5000},
    "total_balance": 18500,
    "business": {"activity": "pickle sales + tailoring", "last_entry": {"revenue": 1000, "cost": 600, "profit": 400}},
    "goal": {"name": "Education", "target": 20000, "saved": 8000},
    "recent_transactions": [],
    "updated_at": "2026-09-18T21:24:26.637Z",
    "_meta": {"pots_count": 5},
}


def _resp(status, body):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = body
    return r


def test_live_b_response_with_nested_pots_maps_to_real_balances():
    # Regression: the mapper used to read top-level cash/bank/... and silently returned all zeros here.
    s = map_b_to_c_state(LIVE_B_RESPONSE)
    assert (s.cash, s.bank, s.shg, s.chit_committed, s.post_office) == (2000, 5000, 2500, 4000, 5000)
    assert s.goal.target == 20000 and s.goal.saved == 8000
    assert s.business.last_entry.profit == 400


def test_flat_mock_shape_still_maps():
    flat = {k: v for k, v in LIVE_B_RESPONSE["pots"].items()}
    assert map_b_to_c_state(flat).bank == 5000


def test_default_base_url_is_person_b_port(monkeypatch):
    monkeypatch.delenv("PERSON_B_API_URL", raising=False)
    assert PersonBClient().base_url == "http://localhost:5000"


@pytest.mark.asyncio
@patch("app.integration.person_b.httpx.AsyncClient.get", new_callable=AsyncMock)
async def test_client_calls_live_endpoint_not_mock(mock_get):
    mock_get.return_value = _resp(200, LIVE_B_RESPONSE)
    state = await PersonBClient().get_financial_state("meera_001")
    url = mock_get.call_args.args[0]
    assert url.endswith("/api/financial-state") and "mock" not in url
    assert mock_get.call_args.kwargs["params"] == {"user_id": "meera_001"}
    assert state.cash == 2000


@pytest.mark.asyncio
@patch("app.integration.person_b.httpx.AsyncClient.get", new_callable=AsyncMock)
async def test_unknown_user_404_returns_none_without_raising(mock_get):
    mock_get.return_value = _resp(404, {"error": "unknown_user"})
    assert await PersonBClient().get_financial_state("nobody") is None


@patch("app.integration.person_b.httpx.AsyncClient.get", new_callable=AsyncMock)
def test_api_degrades_gracefully_on_b_404(mock_get):
    mock_get.return_value = _resp(404, {"error": "unknown_user"})
    r = client.post("/api/v1/integration/person_a/guidance",
                    json={"user_id": "nobody", "request_mode": "personalized", "question": "How am I doing?"})
    assert r.status_code == 200
    assert r.json()["source_class"] == "system"
    assert "unable to access your financial information" in r.json()["response_text"]


@patch("app.integration.person_b.httpx.AsyncClient.get", new_callable=AsyncMock)
def test_api_degrades_gracefully_when_b_is_down(mock_get):
    mock_get.side_effect = httpx.ConnectError("refused")
    r = client.post("/api/v1/integration/person_a/guidance",
                    json={"user_id": "meera_001", "request_mode": "personalized", "question": "How am I doing?"})
    assert r.status_code == 200 and r.json()["source_class"] == "system"
