"""Safety rules must be precise: ordinary financial questions are not flagged, genuine scams still are.

Examples live in tests/safety_corpus.json, which Dev-A's routing tests also read, so Person C's rules.py and
Dev-A's mirrored trigger copy are judged on the same messages.
"""
import json
from pathlib import Path

import pytest

from app.safety.escalation import escalate_signals
from app.safety.rules import detect_signals

CORPUS = json.loads((Path(__file__).with_name("safety_corpus.json")).read_text(encoding="utf-8"))

# The four false positives reported from the WhatsApp integration (each used to match one bare keyword).
REPORTED_FALSE_POSITIVES = [
    "is it fine to take a loan?",             # "fine"
    "should I go to the bank for a loan?",    # "go to"
    "which app is best for saving?",          # "app"
    "how do I pay my chit installment now?",  # "pay ... now"
]


@pytest.mark.parametrize("msg", REPORTED_FALSE_POSITIVES)
def test_reported_false_positives_are_now_safe(msg):
    assert detect_signals(msg) == []
    assert escalate_signals(detect_signals(msg)).classification == "SAFE"


@pytest.mark.parametrize("msg", CORPUS["safe"])
def test_ordinary_messages_are_not_flagged(msg):
    assert detect_signals(msg) == [], [s.category for s in detect_signals(msg)]


@pytest.mark.parametrize("msg", CORPUS["scam"])
def test_scam_messages_stay_flagged(msg):
    assert detect_signals(msg), "scam-style message no longer flagged"


def test_masterplan_kyc_sms_is_flagged_as_suspicious():
    result = escalate_signals(detect_signals("Your KYC will expire, click to verify"))
    assert {s.category for s in result.signals} >= {"urgency", "link"}
    assert result.classification in ("SUSPICIOUS", "NEEDS_HUMAN_HELP")


def test_false_positive_rate_is_zero_and_recall_is_full_on_corpus():
    fp = [m for m in CORPUS["safe"] if detect_signals(m)]
    missed = [m for m in CORPUS["scam"] if not detect_signals(m)]
    assert fp == [] and missed == []


@pytest.mark.parametrize("msg,category", [
    ("Enter your UPI PIN to receive money", "credentials"),
    ("Send your Aadhaar details", "sensitive_info"),
    ("Pay Rs 500 now", "payment"),
    ("Pay immediately or lose your account", "payment"),
    ("Immediately send money to avoid legal action", "payment"),
    ("A fine has been imposed for violation of rules", "threat"),
    ("Download this APK to claim cashback", "installation"),
    ("Tap the link below to update your bank details", "link"),
])
def test_each_rule_still_fires_in_its_scam_context(msg, category):
    assert category in {s.category for s in detect_signals(msg)}
