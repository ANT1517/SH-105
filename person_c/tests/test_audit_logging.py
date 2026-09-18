"""Person C -> Person B audit trail (POST /api/audit-log).

The cross-service tests start a REAL Person B (node src/server.js) with DATABASE_URL blanked so it
runs on its in-memory store: nothing touches the shared Supabase database, so nothing needs cleanup.
Only meera_001 exists in that mode, which is the user used here.
"""
import os
import socket
import subprocess
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.main import app, get_person_b_client
from app.integration.person_b import PersonBClient

REPO = Path(__file__).resolve().parents[2]
USER = "meera_001"


def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


@pytest.fixture(scope="module")
def person_b_url():
    port = _free_port()
    url = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen(
        ["node", "src/server.js"], cwd=REPO,
        env={**os.environ, "PORT": str(port), "DATABASE_URL": ""},  # blank => in-memory store, no Supabase
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        for _ in range(40):
            try:
                if httpx.get(f"{url}/api/financial-state/mock", timeout=1).status_code == 200:
                    break
            except httpx.HTTPError:
                time.sleep(0.25)
        else:
            pytest.fail("Person B did not start")
        health = httpx.get(f"{url}/health", timeout=2)
        if health.status_code == 200:
            assert health.json().get("postgres_connected") in (False, None), "must not run against the shared DB"
        yield url
    finally:
        proc.terminate()


@pytest.fixture
def c_client(person_b_url, monkeypatch):
    monkeypatch.setenv("PERSON_B_API_URL", person_b_url)
    app.dependency_overrides[get_person_b_client] = lambda: PersonBClient()
    yield TestClient(app)
    app.dependency_overrides.pop(get_person_b_client, None)


def _logs(url, action):
    logs = httpx.get(f"{url}/api/audit-log", params={"user_id": USER}, timeout=5).json()["logs"]
    return [entry for entry in logs if entry["action"] == action]


def test_guidance_call_creates_audit_row_visible_in_person_b(c_client, person_b_url):
    before = len(_logs(person_b_url, "GUIDANCE_GIVEN"))
    q = "What is a savings goal?"
    r = c_client.post("/api/v1/guidance", json={"user_id": USER, "request_mode": "education", "question": q,
                                                "cash": 1, "bank": 1, "shg": 1, "chit_committed": 1, "post_office": 1})
    assert r.status_code == 200
    rows = _logs(person_b_url, "GUIDANCE_GIVEN")
    assert len(rows) == before + 1
    row = rows[0]
    assert row["user_id"] == USER and row["entity_type"] == "guidance"
    assert row["metadata"]["question"] == q
    assert row["metadata"]["source_class"] == r.json()["source_class"]
    assert row["metadata"]["request_mode"] == "education"


def test_safety_check_creates_audit_row_without_storing_the_message(c_client, person_b_url):
    msg = "Your KYC will expire, click to verify"
    r = c_client.post("/api/v1/safety/check", json={"user_id": USER, "message": msg})
    assert r.status_code == 200
    row = _logs(person_b_url, "SAFETY_CHECK_PERFORMED")[0]
    assert row["metadata"]["classification"] in ("CAUTION", "SUSPICIOUS", "NEEDS_HUMAN_HELP")
    assert row["metadata"]["message_length"] == len(msg)
    assert msg not in str(row["metadata"])  # message text is not written to the audit trail


def test_simulator_creates_audit_row(c_client, person_b_url):
    r = c_client.post("/api/v1/simulator", json={"user_id": USER, "scenario": "savings_goal_feasibility",
                                                 "target": 20000, "saved": 8000})
    assert r.status_code == 200
    row = _logs(person_b_url, "SIMULATOR_RUN")[0]
    assert row["metadata"]["scenario"] == "savings_goal_feasibility"
    assert row["metadata"]["target"] == 20000 and row["metadata"]["saved"] == 8000


def test_no_user_id_means_no_audit_call():
    with patch("app.integration.person_b.httpx.AsyncClient.post", new_callable=AsyncMock) as post:
        r = TestClient(app).post("/api/v1/safety/check", json={"message": "hello"})
        assert r.status_code == 200
        post.assert_not_called()


# --- fire-and-forget: Person B's audit endpoint being down/failing never affects the response ---

def test_response_unaffected_when_person_b_audit_port_is_dead(monkeypatch):
    dead = f"http://127.0.0.1:{_free_port()}"  # nothing listening
    monkeypatch.setenv("PERSON_B_API_URL", dead)
    app.dependency_overrides[get_person_b_client] = lambda: PersonBClient()
    try:
        t = time.time()
        r = TestClient(app).post("/api/v1/simulator", json={"user_id": USER, "scenario": "savings_goal_feasibility",
                                                            "target": 20000, "saved": 8000})
        assert r.status_code == 200 and r.json()["mode"] == "simulator"
        assert time.time() - t < 5
    finally:
        app.dependency_overrides.pop(get_person_b_client, None)


@pytest.mark.asyncio
async def test_log_audit_never_raises_and_reports_failure():
    with patch("app.integration.person_b.httpx.AsyncClient.post", new_callable=AsyncMock) as post:
        post.side_effect = httpx.ConnectError("refused")
        assert await PersonBClient().log_audit(USER, "GUIDANCE_GIVEN", "guidance", {}) is False
        post.side_effect = RuntimeError("boom")
        assert await PersonBClient().log_audit(USER, "GUIDANCE_GIVEN", "guidance", {}) is False
        resp = MagicMock()
        resp.status_code = 404
        post.side_effect = None
        post.return_value = resp
        assert await PersonBClient().log_audit(USER, "GUIDANCE_GIVEN", "guidance", {}) is False
        resp.status_code = 201
        assert await PersonBClient().log_audit(USER, "GUIDANCE_GIVEN", "guidance", {}) is True


# --- /api/v1/integration/person_a/guidance (user_id comes from Person A's request) ---

@pytest.mark.parametrize("mode,extra", [("education", {}), ("personalized", {}), ("simulator", {})])
def test_person_a_integration_creates_guidance_audit_row(c_client, person_b_url, mode, extra):
    before = len(_logs(person_b_url, "GUIDANCE_GIVEN"))
    q = f"integration audit check {mode}"
    r = c_client.post("/api/v1/integration/person_a/guidance",
                      json={"user_id": USER, "request_mode": mode, "question": q, **extra})
    assert r.status_code == 200
    rows = _logs(person_b_url, "GUIDANCE_GIVEN")
    assert len(rows) == before + 1
    row = rows[0]
    assert row["user_id"] == USER and row["entity_type"] == "guidance"
    assert row["metadata"]["request_mode"] == mode
    assert row["metadata"]["question"] == q
    assert row["metadata"]["source_class"] == r.json()["source_class"]
    assert row["metadata"]["source_class"] != "system"  # real guidance, not an error reply


def test_person_a_integration_error_replies_are_not_audited_as_guidance():
    # Unknown user (404 from Person B) and Person B down both produce system error replies: nothing to audit.
    with patch("app.integration.person_b.httpx.AsyncClient.post", new_callable=AsyncMock) as post, \
         patch("app.integration.person_b.httpx.AsyncClient.get", new_callable=AsyncMock) as get:
        resp = MagicMock()
        resp.status_code = 404
        get.return_value = resp
        r = TestClient(app).post("/api/v1/integration/person_a/guidance",
                                 json={"user_id": "nobody", "request_mode": "personalized", "question": "hi"})
        assert r.status_code == 200 and r.json()["source_class"] == "system"
        get.return_value = None
        get.side_effect = httpx.ConnectError("refused")
        r = TestClient(app).post("/api/v1/integration/person_a/guidance",
                                 json={"user_id": USER, "request_mode": "personalized", "question": "hi"})
        assert r.status_code == 200 and r.json()["source_class"] == "system"
        post.assert_not_called()
