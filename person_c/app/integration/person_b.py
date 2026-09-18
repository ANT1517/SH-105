import os
import httpx
from typing import Optional, Dict, Any
from app.contracts.input import FinancialState, BusinessData, BusinessLastEntry, GoalData

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

class PersonBClient:
    def __init__(self):
        self.base_url = os.environ.get("PERSON_B_API_URL", "http://localhost:5000")
        self.timeout = int(os.environ.get("PERSON_B_TIMEOUT", "5"))

    async def get_financial_state(self, user_id: str) -> Optional[FinancialState]:
        """
        Fetches financial state from Person B for a given user.
        Returns None on any network failure or malformed payload, ensuring graceful degradation.
        """
        if not user_id:
            return None
            
        url = f"{self.base_url}/api/financial-state"
        params = {"user_id": user_id}
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params)
                
            if response.status_code != 200:
                # e.g. 404 unknown_user (Person B no longer serves Meera's state for unknown users) or 5xx.
                return None
                
            data = response.json()
            return map_b_to_c_state(data)
            
        except (httpx.RequestError, httpx.HTTPError, ValueError, TypeError):
            # Includes timeouts, connection errors, and JSON parsing errors
            return None
