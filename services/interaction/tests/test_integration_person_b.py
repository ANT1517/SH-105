"""End-to-end: WhatsApp webhook -> Person B /api/transactions -> GET /api/financial-state.

Starts a real Person B (node src/server.js, Supabase via repo .env) on a spare port unless
PERSON_B_URL is already reachable. Uses only the dedicated user below and deletes it afterwards.
"""
import os
import random
import socket
import subprocess
import time
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app

TEST_USER = "test_dev_a_integration"
REPO = Path(__file__).resolve().parents[3]


def _up(url):
    try:
        return httpx.get(f"{url}/api/financial-state/mock", timeout=2).status_code == 200
    except httpx.HTTPError:
        return False


def _cleanup():
    subprocess.run(["node", str(Path(__file__).with_name("cleanup_test_user.js")), TEST_USER], check=True, cwd=REPO)


@pytest.fixture(scope="module")
def person_b(monkeypatch_module=None):
    url = os.environ.get("PERSON_B_URL")
    proc = None
    if not (url and _up(url)):
        s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
        url = f"http://127.0.0.1:{port}"
        proc = subprocess.Popen(["node", "src/server.js"], cwd=REPO, env={**os.environ, "PORT": str(port)},
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(30):
            if _up(url):
                break
            time.sleep(0.5)
        else:
            proc.kill()
            pytest.fail("Person B did not start")
    os.environ["PERSON_B_URL"] = url
    try:
        yield url
    finally:
        try:
            _cleanup()
        finally:
            if proc:
                proc.terminate()


def _cash(url):
    return httpx.get(f"{url}/api/financial-state", params={"user_id": TEST_USER}).json()


def test_webhook_records_via_person_b_and_moves_pot(person_b):
    client = TestClient(app)
    a, b = random.randint(700, 799), random.randint(800, 899)

    def send(amount):
        r = client.post("/webhooks/whatsapp", data={"From": TEST_USER, "Body": f"I earned {amount} today", "NumMedia": "0"})
        assert r.status_code == 200
        return r.text

    # First tx creates the user's pots (before that, Person B serves Meera's in-memory state for unknown users).
    reply = send(a)
    assert f"I earned {a} today" in reply and f"₹{a}" in reply and "cash pot" in reply
    assert _cash(person_b)["pots"]["cash"] == a

    before = _cash(person_b)["pots"]["cash"]
    send(b)
    assert _cash(person_b)["pots"]["cash"] - before == b


def test_low_confidence_or_unparsed_is_not_forwarded(person_b):
    client = TestClient(app)
    r = client.post("/webhooks/whatsapp", data={"From": TEST_USER, "Body": "how much can i save?", "NumMedia": "0"})
    assert "Recorded" not in r.text
