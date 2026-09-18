from pydantic import BaseModel
from typing import Optional, List, Literal

class SafetyRequest(BaseModel):
    user_id: Optional[str] = None  # optional; used only to attribute the audit-log entry in Person B
    message: str
    literacy_tier: Optional[int] = None

class SafetySignal(BaseModel):
    category: str
    description: str
    severity: Literal["low", "medium", "high"]

class SafetyResult(BaseModel):
    classification: Literal["SAFE", "CAUTION", "SUSPICIOUS", "NEEDS_HUMAN_HELP"]
    signals: List[SafetySignal]
    explanation: str
    uncertainty: str
    recommended_action: str
