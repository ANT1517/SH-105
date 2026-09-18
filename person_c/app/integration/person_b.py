import logging
import os
import uuid
import httpx
from typing import Optional, Dict, Any
from app.contracts.input import FinancialState, BusinessData, BusinessLastEntry, GoalData

logger = logging.getLogger("person_c.person_b")

def map_b_to_c_state(data: dict) -> FinancialState:
    """
    Transforms Person B's external API response into Person C's internal FinancialState contract.
    Ensures safe fallbacks for missing or malformed keys.

    Person B's live GET /api/financial-state nests balances under "pots" ({"pots": {"cash": ...}});
    its /mock endpoint (the Section 2 fixture) is flat. Both shapes are accepted.
    """
    pots = data.get("pots") if isinstance(data.get("pots"), dict) else data
    business_data = data.get("business")
    business_state = None
    if business_data and isinstance(business_data, dict):
        last_entry = business_data.get("last_entry", {})
        business_state = BusinessData(
            activity=business_data.get("activity", "Unknown"),
            last_entry=BusinessLastEntry(
                revenue=last_entry.get("revenue", 0.0),
                cost=last_entry.get("cost", 0.0),
                profit=last_entry.get("profit", 0.0)
            )
        )
        
    goal_data = data.get("goal")
    goal_state = None
    if goal_data and isinstance(goal_data, dict):
        goal_state = GoalData(
            name=goal_data.get("name", "Unknown"),
            target=goal_data.get("target", 0.0),
            saved=goal_data.get("saved", 0.0)
        )

    return FinancialState(
        cash=float(pots.get("cash", 0.0)),
        bank=float(pots.get("bank", 0.0)),
        shg=float(pots.get("shg", 0.0)),
        chit_committed=float(pots.get("chit_committed", 0.0)),
        post_office=float(pots.get("post_office", 0.0)),
        business=business_state,
        goal=goal_state
    )

class UnknownUserError(Exception):
    """Person B has no financial state for this user (HTTP 404 unknown_user, or no user_id given).

    Distinct from an outage: get_financial_state returns None for network failures / 5xx.
    """


class PersonBClient:
    def __init__(self):
        self.base_url = os.environ.get("PERSON_B_API_URL", "http://localhost:5000")
        self.timeout = int(os.environ.get("PERSON_B_TIMEOUT", "5"))
        self.audit_timeout = float(os.environ.get("PERSON_B_AUDIT_TIMEOUT", "2"))

    async def get_financial_state(self, user_id: str) -> Optional[FinancialState]:
        """
        Fetches financial state from Person B for a given user.
        Returns None on any network failure, non-200/404 status or malformed payload (Person B
        unavailable -> graceful degradation). Raises UnknownUserError when Person B says the user
        does not exist (404), or when no user_id was supplied.
        """
        if not user_id:
            raise UnknownUserError("no user_id supplied")
            
        url = f"{self.base_url}/api/financial-state"
        params = {"user_id": user_id}
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params)
                
            if response.status_code == 404:
                # Person B returns 404 unknown_user instead of serving Meera's state for unknown users.
                raise UnknownUserError(user_id)
            if response.status_code != 200:
                return None
                
            data = response.json()
            return map_b_to_c_state(data)
            
        except (httpx.RequestError, httpx.HTTPError, ValueError, TypeError):
            # Includes timeouts, connection errors, and JSON parsing errors
            return None

    async def log_audit(self, user_id: Optional[str], action: str, entity_type: str,
                        metadata: Optional[Dict[str, Any]] = None) -> bool:
        """
        Records an event in Person B's audit log (POST /api/audit-log). Best effort: never raises.
        Returns True if Person B accepted it. Callers run this as a background task so it can
        never delay or fail the user-facing response.
        """
        if not user_id:
            return False  # nothing to attribute the entry to (Person B would refuse it)
        payload = {
            "user_id": user_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": uuid.uuid4().hex,
            "metadata": metadata or {},
        }
        try:
            async with httpx.AsyncClient(timeout=self.audit_timeout) as client:
                response = await client.post(f"{self.base_url}/api/audit-log", json=payload)
            if response.status_code != 201:
                logger.warning("Audit log rejected by Person B: %s %s", response.status_code, action)
                return False
            return True
        except Exception as e:  # noqa: BLE001 - audit must never break the caller
            logger.warning("Audit log POST failed (%s): %r", action, e)
            return False
