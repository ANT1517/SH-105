from pydantic import BaseModel
from typing import Literal

class PersonCResponse(BaseModel):
    response_text: str
    source_class: str
    mode: Literal["education", "personalized", "simulator", "safety"]
    disclaimer: bool
