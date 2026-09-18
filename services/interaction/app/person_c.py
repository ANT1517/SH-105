import logging
import os
import re
import httpx

logger = logging.getLogger("interaction")

# Mirror of the trigger patterns in person_c/app/safety/rules.py (detect_signals): a message that
# produces ANY safety signal there is routed to Person C's /api/v1/safety/check instead of guidance.
# Kept as a copy (services stay independent); tests/test_person_c_routing.py fails if rules.py drifts.
SAFETY_TRIGGER_PATTERNS = [
    r'\b(kyc|account|card)\b.*\b(expire|expired|suspended|block|blocked|verify)\b',  # KYC / account expiry
    r'\b(click|visit|tap|go to)\b',                                                   # click-link requests
    r'\b(otp|one time password|code)\b',                                              # OTP requests
    r'\b(password|pin|mpin|cvv)\b',                                                   # credentials
    r'\b(aadhaar|pan|bank details|credit card)\b',                                    # sensitive info
    r'\b(pay|send money|transfer)\b.*\b(immediately|urgent|now)\b',                   # urgent payment
    r'\b(police|arrest|fine|penalty|court)\b',                                        # threats
    r'\b(install|download|app|apk)\b',                                                # app installs
]
_TRIGGERS = [re.compile(p) for p in SAFETY_TRIGGER_PATTERNS]


def person_c_url() -> str:
    return os.environ.get("PERSON_C_URL", "http://localhost:8000").rstrip("/")


def looks_suspicious(text: str) -> bool:
    """Same rule as Person C: normalise (truncate 2000, lowercase, collapse spaces), any pattern or 'http'."""
    t = re.sub(r"\s+", " ", text[:2000].strip().lower())
    return bool(t) and ("http" in t or any(p.search(t) for p in _TRIGGERS))


FAILURE_REPLY = "I couldn't reach Saathi's guidance service right now, so I couldn't answer that. Please try again in a little while."


async def ask_person_c(normalized: dict) -> str:
    """Send a non-transaction message to Person C and return the text to reply with.

    Suspicious-looking messages go to /api/v1/safety/check, everything else to the guidance endpoint.
    Never raises and never returns nothing: an unreachable/erroring Person C gets an honest failure reply.
    """
    text = normalized["raw_text"]
    if looks_suspicious(text):
        path, payload, prefix = "/api/v1/safety/check", {"user_id": normalized["user_id"], "message": text}, "Safety check: "
    else:
        path = "/api/v1/integration/person_a/guidance"
        payload, prefix = {"user_id": normalized["user_id"], "question": text, "request_mode": "personalized"}, ""
    try:
        # Twilio drops webhooks that take longer than ~15s, so keep this under that.
        async with httpx.AsyncClient(timeout=float(os.environ.get("PERSON_C_TIMEOUT", "12"))) as client:
            r = await client.post(f"{person_c_url()}{path}", json=payload)
        if r.status_code != 200:
            logger.error(f"Person C {path} returned {r.status_code}")
            return FAILURE_REPLY
        return prefix + r.json()["response_text"]
    except (httpx.HTTPError, ValueError, KeyError) as e:
        logger.error(f"Person C {path} failed: {e!r}")
        return FAILURE_REPLY
