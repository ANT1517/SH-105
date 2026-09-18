from pydantic import BaseModel
from typing import Optional, Literal

class PersonAIntegrationRequest(BaseModel):
    user_id: Optional[str] = None
    question: Optional[str] = None
    request_mode: Literal["education", "personalized", "simulator"]
    literacy_tier: Optional[int] = None
    
    # For simulator requests
    simulator_scenario: Optional[str] = None
