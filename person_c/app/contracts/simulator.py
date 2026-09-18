from pydantic import BaseModel, Field
from typing import Optional, List, Literal

class SimulatorInput(BaseModel):
    scenario: Literal["savings_goal_feasibility"]
    target: float = Field(..., description="Target savings goal amount")
    saved: float = Field(..., description="Current saved amount")
    monthly_contribution: Optional[float] = Field(None, description="Optional monthly contribution amount")
    timeframe_months: Optional[int] = Field(None, description="Optional timeframe in months to reach the goal")
    literacy_tier: Optional[int] = Field(None, description="Literacy tier for explanation formatting")
    question: Optional[str] = Field(None, description="Optional user question for RAG context")

class SimulatorResult(BaseModel):
    scenario: str
    target: float
    saved: float
    gap: float
    monthly_contribution: Optional[float]
    months_required: Optional[int]
    feasible: Optional[bool]
    assumptions: List[str]
    missing_information: List[str]
