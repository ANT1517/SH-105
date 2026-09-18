from pydantic import BaseModel
from typing import Optional

class BusinessLastEntry(BaseModel):
    revenue: float
    cost: float
    profit: float

class BusinessData(BaseModel):
    activity: str
    last_entry: BusinessLastEntry

class GoalData(BaseModel):
    name: str
    target: float
    saved: float

class FinancialState(BaseModel):
    cash: float
    bank: float
    shg: float
    chit_committed: float
    post_office: float
    business: Optional[BusinessData] = None
    goal: Optional[GoalData] = None

class GuidanceRequest(FinancialState):
    question: Optional[str] = None
    request_mode: Optional[str] = None
    literacy_tier: Optional[int] = None
