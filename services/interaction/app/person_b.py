import logging
import os
import httpx

logger = logging.getLogger("interaction")

MIN_CONFIDENCE = 0.6


def person_b_url() -> str:
    return os.environ.get("PERSON_B_URL", "http://localhost:5000").rstrip("/")


async def forward_to_person_b(normalized: dict) -> str | None:
    """POST a normalized input to Person B's /api/transactions as-is (no field coercion).

    Returns a user-facing sentence about what happened, or None if nothing was
    forwarded (no parsed transaction, or confidence below MIN_CONFIDENCE).
    """
    if not normalized.get("parsed_transaction") or normalized.get("confidence", 0) < MIN_CONFIDENCE:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(f"{person_b_url()}/api/transactions", json=normalized)
    except httpx.HTTPError as e:
        logger.error(f"Person B unreachable: {e!r}")
        return "I couldn't reach the financial records service, so nothing was recorded."

    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    if r.status_code == 201:
        tx = body["transaction"]
        return f"Recorded: {tx['tx_type']} of ₹{tx['amount']:g} ({tx['category']}) in your {body['pot_affected']} pot."
    if r.status_code == 409:
        return "I already recorded this one, so I did not add it again."
    logger.error(f"Person B rejected transaction: {r.status_code} {body}")
    return f"I understood this but couldn't record it: {body.get('error', r.status_code)}"
