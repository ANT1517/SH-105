from pydantic import BaseModel
from typing import Optional, Literal

class PersonAIntegrationRequest(BaseModel):
    user_id: Optional[str] = None
    question: Optional[str] = None
    request_mode: Literal["education", "personalized", "simulator"]
    literacy_tier: Optional[int] = None

    # Selected UI language from the frontend (en/te/hi/kn). Controls LLM output language.
    # Default "en" preserves backward compatibility for any caller that omits the field.
    language: Literal["en", "te", "hi", "kn"] = "en"

    # For simulator requests
    simulator_scenario: Optional[str] = None
