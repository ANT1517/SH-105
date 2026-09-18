"""Routing order: the safety check runs BEFORE the transaction path.

A scam-style message that also parses as a valid transaction must go to Person C's safety check and must
never be forwarded to Person B. Ordinary transaction messages must still reach Person B.
Both services are stubbed at the httpx boundary (no Person B / Supabase writes, nothing to clean up).
"""
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.transaction_parser import normalize_text, parse_transaction

TEST_USER = "test_dev_a_integration"
client = TestClient(app)
CORPUS = json.loads((Path(__file__).resolve().parents[3] / "person_c" / "tests" / "safety_corpus.json").read_text(encoding="utf-8"))

PARSES = lambda m: parse_transaction(normalize_text(m)) is not None
SCAMS_THAT_PARSE_AS_TRANSACTIONS = [m for m in CORPUS["scam"] if PARSES(m)]
TRANSACTIONS_IN_CORPUS = [m for m in CORPUS["safe"] if PARSES(m)]


def _fake_post(calls):
    """Stub for httpx.AsyncClient.post: records (url, json) and answers like Person B / Person C would."""
    async def post(self, url, json=None, **kw):
        calls.append((url, json))
        r = MagicMock()
        if url.endswith("/api/transactions"):
            r.status_code = 201
            r.json.return_value = {
                "transaction": {"tx_type": json["parsed_transaction"]["type"], "amount": json["parsed_transaction"]["amount"],
                                "category": json["parsed_transaction"]["category"]},
                "pot_affected": "cash",
            }
        else:
            r.status_code = 200
            r.json.return_value = {"response_text": "stubbed Person C answer", "source_class": "system", "mode": "safety", "disclaimer": True}
        r.headers = {"content-type": "application/json"}
        return r
    return post


def _send(body):
    calls = []
    with patch("httpx.AsyncClient.post", _fake_post(calls)):
        r = client.post("/webhooks/whatsapp", data={"From": TEST_USER, "Body": body, "NumMedia": "0"})
    assert r.status_code == 200
    return r, calls


def test_the_reported_example_is_a_valid_transaction_and_a_scam():
    msg = "paid 500 to verify your KYC now"
    assert parse_transaction(normalize_text(msg)) == {"type": "expense", "amount": 500.0, "category": "expense"}


def test_scam_with_parseable_amount_goes_to_safety_not_person_b():
    r, calls = _send("paid 500 to verify your KYC now")
    urls = [u for u, _ in calls]
    assert len(urls) == 1 and urls[0].endswith("/api/v1/safety/check")
    assert not any(u.endswith("/api/transactions") for u in urls)
    assert "Safety check: stubbed Person C answer" in r.text
    assert "Recorded" not in r.text


def test_scam_with_parseable_amount_never_calls_forward_to_person_b():
    with patch("app.main.forward_to_person_b", new_callable=AsyncMock) as fwd, \
         patch("app.person_c.httpx.AsyncClient.post", new_callable=AsyncMock) as post:
        post.return_value = MagicMock(status_code=200, **{"json.return_value": {"response_text": "careful"}})
        r = client.post("/webhooks/whatsapp", data={"From": TEST_USER, "Body": "paid 500 to verify your KYC now", "NumMedia": "0"})
    fwd.assert_not_called()
    assert "Safety check: careful" in r.text


def test_corpus_contains_scams_that_also_parse_as_transactions():
    assert "paid 500 to verify your KYC now" in SCAMS_THAT_PARSE_AS_TRANSACTIONS


@pytest.mark.parametrize("msg", SCAMS_THAT_PARSE_AS_TRANSACTIONS)
def test_every_scam_that_parses_as_a_transaction_is_kept_away_from_person_b(msg):
    _, calls = _send(msg)
    assert [u.rsplit("/api", 1)[1] for u, _ in calls] == ["/v1/safety/check"]


@pytest.mark.parametrize("msg", [
    "I earned 800 from tailoring",
    "I earned 800 from tailoring today",
    "I spent 300 on electricity",
    "I saved 1000 today",
    "I sold 10 pickle bottles for 1000",
    "paid the chit installment 4000",
    "I paid 500 for vegetables",
    "I got 1200 from stitching",
])
def test_ordinary_transactions_still_reach_person_b(msg):
    r, calls = _send(msg)
    urls = [u for u, _ in calls]
    assert len(urls) == 1 and urls[0].endswith("/api/transactions"), urls
    assert calls[0][1]["user_id"] == TEST_USER and calls[0][1]["raw_text"] == msg
    assert "Recorded:" in r.text and "Saathi received:" in r.text
    assert not any("/api/v1/" in u for u in urls)  # Person C untouched


def test_every_ordinary_transaction_in_the_corpus_reaches_person_b():
    assert TRANSACTIONS_IN_CORPUS, "corpus should contain ordinary transaction messages"
    for msg in TRANSACTIONS_IN_CORPUS:
        _, calls = _send(msg)
        assert [u.rsplit("/api", 1)[1] for u, _ in calls] == ["/transactions"], msg


def test_ordinary_question_still_goes_to_guidance():
    _, calls = _send("how much can I save?")
    assert [u.rsplit("/api", 1)[1] for u, _ in calls] == ["/v1/integration/person_a/guidance"]
