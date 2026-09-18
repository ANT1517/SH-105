from pydantic import BaseModel
from typing import Dict, Any

class RetrievedContext(BaseModel):
    text: str
    metadata: Dict[str, Any]
