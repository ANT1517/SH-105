from pydantic import BaseModel
from typing import Optional, Dict
from app.contracts.input import FinancialState

class CalculatedFacts(BaseModel):
    goal_gap: float
    total_saved: float
    pots: Dict[str, float]

def calculate_financial_facts(state: FinancialState) -> CalculatedFacts:
    """
    Deterministically calculates financial facts from the raw financial state.
    """
    # Calculate goal gap
    # If negative values are passed, FinancialState validation should catch it.
    # We ensure gap is not negative.
    gap = state.goal.target - state.goal.saved
    goal_gap = max(0.0, gap)
    
    # Extract pots explicitly
    pots = {
        "Cash": state.cash,
        "Bank": state.bank,
        "SHG": state.shg,
        "Chit committed": state.chit_committed,
        "Post Office": state.post_office
    }
    
    total_saved = sum(pots.values())
    
    return CalculatedFacts(
        goal_gap=goal_gap,
        total_saved=total_saved,
        pots=pots
    )
