from app.education.llm import LLMInterface
from app.contracts.output import PersonCResponse
from app.contracts.safety import SafetyRequest, SafetyResult
from app.safety.rules import detect_signals
from app.safety.escalation import escalate_signals
from app.literacy.prompts import get_literacy_instructions
from app.localization.language import get_fallback

class SafetyService:
    def __init__(self, llm: LLMInterface):
        self.llm = llm
        
    def check_message(self, request: SafetyRequest) -> PersonCResponse:
        language = request.language if hasattr(request, "language") else "en"

        # 1. Deterministic Calculation (Signals & Escalation) — language does NOT affect this
        signals = detect_signals(request.message)
        safety_result = escalate_signals(signals)
        
        # 2. Literacy Instructions
        tier = request.literacy_tier if request.literacy_tier else 2
        instructions = get_literacy_instructions(tier)
        
        # 3. Generate LLM Explanation in the selected language
        result_dict = safety_result.model_dump()
        
        try:
            llm_text = self.llm.generate_safety_response(
                result=result_dict,
                message=request.message,
                instructions=instructions,
                language=language
            )
        except Exception:
            return PersonCResponse(
                response_text=get_fallback(language, "safety_error") + " " + safety_result.uncertainty,
                source_class="system",
                mode="safety",
                disclaimer=True
            )
            
        if not llm_text:
            return PersonCResponse(
                response_text=get_fallback(language, "safety_empty") + " " + safety_result.uncertainty,
                source_class="system",
                mode="safety",
                disclaimer=True
            )
            
        return PersonCResponse(
            response_text=llm_text,
            source_class="system",
            mode="safety",
            disclaimer=True
        )
