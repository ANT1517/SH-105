import logging
import os
import re
import httpx

logger = logging.getLogger("interaction")

# Mirror of the trigger patterns in person_c/app/safety/rules.py (detect_signals): a message that
# produces ANY safety signal there is routed to Person C's /api/v1/safety/check instead of guidance.
# Kept as a copy (services stay independent); tests/test_person_c_routing.py fails if rules.py drifts.
# Regenerate by copying the re.search(r'...') patterns from rules.py in order.
SAFETY_TRIGGER_PATTERNS = [
    r'\b(kyc|account|card)\b.*\b(expire|expired|suspended|block|blocked|verify)\b',  # KYC / account expiry
    r'\bclick\b|\b(tap|visit|go to)\b.*\b(link|url|website|site|here|below)\b|\bwww\.',  # click-link requests (click/URLs broad; tap/visit/go to need a link context)
    r'\b(otp|one time password)\b|\b(verification|security|confirmation|secret|login|authentication) code\b|\bcode\b.*\b(received|sent to your)\b',  # OTP requests (bare 'code' is not enough)
    r'\b(share|send|enter|provide|reveal|give|tell)\b.{0,15}\byour\b.{0,15}\b(password|pin|mpin|cvv)\b|\b(password|pin|mpin|cvv)\b.{0,40}\b(required|needed|to verify|to confirm|to activate|to unlock)\b',  # credential requests (needs 'your' PIN/password, not a question about them)
    r'\b(share|send|give|provide|submit|update|upload|forward)\b.{0,20}\byour\b.*\b(aadhaar|aadhar|pan|bank details|credit card|card details|card number|account number)\b',  # sensitive info (needs a request for 'your' details)
    r'\b(pay|send money|transfer)\b.*\b(immediately|urgent|urgently|asap|within \d+ ?(hours?|hrs?|minutes?|mins?|days?)|last chance|final notice)\b|\b(immediately|urgent|urgently|asap|within \d+ ?(hours?|hrs?|minutes?|mins?|days?)|last chance|final notice)\b.*\b(pay|send money|transfer)\b|\b(pay|transfer)\b\s+(rs\.?|inr|₹)?\s*\d[\d,]*\s+now\b',  # urgent payment (needs urgency language, either order)
    r'\b(arrest|arrested|warrant|prosecution)\b|\b(legal action|police case|court case|police complaint)\b.{0,30}\b(against you|will be (filed|taken|registered|initiated)|has been (filed|registered)|avoid)\b|\bavoid\b.{0,15}\b(legal action|police)\b|\bcourt (notice|summons)\b|\b(fine|penalty)\b.*\b(imposed|levied|violation|violated|illegal|unlawful|breach)\b|\b(imposed|levied|violation|violated|illegal|unlawful|breach)\b.*\b(fine|penalty)\b',  # threats (arrest broad; fine/penalty need a violation context)
    r'\bapk\b|\b(anydesk|teamviewer|quicksupport)\b|\bremote (access|control)\b|\b(install|download)\b.{0,30}\b(app|application|software|file|attachment|link)\b|\b(app|application|software)\b.{0,30}\b(install|download)\b',  # app installs ('app' only next to install/download)
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
