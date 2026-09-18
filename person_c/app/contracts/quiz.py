from pydantic import BaseModel
from typing import List

class QuizRequest(BaseModel):
    answers: List[str]

class QuizResponse(BaseModel):
    tier: int
