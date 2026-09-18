"""Webhook routing to Person C (guidance / safety) for messages that are not transactions.

Person C and Person B are stubbed at the HTTP boundary, so nothing is written to Person B or the shared
Supabase DB and there is nothing to clean up. TEST_USER is the dedicated integration-test id.
"""
import re
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.person_c import SAFETY_TRIGGER_PATTERNS, looks_suspicious

TEST_USER = "test_dev_a_integration"
client = TestClient(app)

KYC_SMS = "Your KYC will expire today. Click http://sbi-kyc-update.example/verify to verify now."


def _c_response(text, status=200):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = {"response_text": text, "source_class": "research", "mode": "personalized", "disclaimer": True}
    return r


def _send(body):
    return client.post("/webhooks/whatsapp", data={"From": TEST_USER, "Body": body, "NumMedia": "0"})


@patch("app.person_c.httpx.AsyncClient.post", new_callable=AsyncMock)
def test_question_reaches_person_c_guidance_and_its_answer_is_the_reply(post):
    post.return_value = _c_response("You could save about Rs 500 a month towards your Education goal.")
    r = _send("how much can I save?")
    assert r.status_code == 200
    assert "You could save about Rs 500 a month towards your Education goal." in r.text
    (url,), kwargs = post.call_args
    assert url.endswith("/api/v1/integration/person_a/guidance")
    assert kwargs["json"] == {"user_id": TEST_USER, "question": "how much can I save?", "request_mode": "personalized"}


@patch("app.person_c.httpx.AsyncClient.post", new_callable=AsyncMock)
def test_suspicious_message_goes_to_safety_check_not_guidance(post):
    post.return_value = _c_response("This looks suspicious. Do not click the link.")
    r = _send(KYC_SMS)
    assert r.status_code == 200
    assert "Safety check: This looks suspicious. Do not click the link." in r.text
    assert post.call_count == 1
    (url,), kwargs = post.call_args
    assert url.endswith("/api/v1/safety/check") and "guidance" not in url
    assert kwargs["json"] == {"user_id": TEST_USER, "message": KYC_SMS}


@patch("app.person_c.httpx.AsyncClient.post", new_callable=AsyncMock)
def test_transactions_still_go_to_person_b_not_person_c(post):
    with patch("app.main.forward_to_person_b", new_callable=AsyncMock) as fwd:
        fwd.return_value = "Recorded: income of ₹800 (tailoring) in your business pot."
        r = _send("I earned 800 from tailoring today")
    assert "Recorded: income of ₹800" in r.text
    post.assert_not_called()


@pytest.mark.parametrize("failure", [
    httpx.ConnectError("refused"),
    httpx.ReadTimeout("slow"),
])
@patch("app.person_c.httpx.AsyncClient.post", new_callable=AsyncMock)
def test_person_c_down_gets_honest_failure_reply_not_a_crash(post, failure):
    post.side_effect = failure
    for msg in ("should I take this loan?", KYC_SMS):
        r = _send(msg)
        assert r.status_code == 200
        assert "couldn't reach Saathi's guidance service" in r.text  # never silently dropped


@pytest.mark.parametrize("status", [500, 503, 422])
@patch("app.person_c.httpx.AsyncClient.post", new_callable=AsyncMock)
def test_person_c_error_status_gets_honest_failure_reply(post, status):
    post.return_value = _c_response("", status=status)
    r = _send("should I take this loan?")
    assert r.status_code == 200 and "couldn't reach Saathi's guidance service" in r.text


def test_default_person_c_url_matches_its_readme(monkeypatch):
    from app.person_c import person_c_url
    monkeypatch.delenv("PERSON_C_URL", raising=False)
    assert person_c_url() == "http://localhost:8000"


@pytest.mark.parametrize("msg", [
    "Your KYC will expire today, verify now", "click here http://x.example", "share your OTP", "send your PIN",
    "give your aadhaar number", "pay now or face arrest", "install this apk",
])
def test_scam_style_messages_trigger_safety(msg):
    assert looks_suspicious(msg)


@pytest.mark.parametrize("msg", ["how much can I save?", "should I take this loan?", "what is a chit fund", "hello"])
def test_ordinary_questions_do_not_trigger_safety(msg):
    assert not looks_suspicious(msg)


def test_safety_trigger_patterns_match_person_c_rules_py():
    """Drift guard: Dev-A's copy of the trigger rules must equal person_c/app/safety/rules.py."""
    rules = Path(__file__).resolve().parents[3] / "person_c" / "app" / "safety" / "rules.py"
    src = rules.read_text(encoding="utf-8")
    theirs = re.findall(r"re\.search\(r'([^']+)', normalized\)", src)
    assert theirs, "could not extract patterns from Person C rules.py"
    assert theirs == SAFETY_TRIGGER_PATTERNS
    assert '"http" in normalized' in src
