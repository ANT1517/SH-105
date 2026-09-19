from app.rag.retrieval import Retriever
from app.education.llm import LLMInterface
from app.contracts.output import PersonCResponse
from app.contracts.simulator import SimulatorInput
from app.simulator.deterministic import run_savings_goal_simulation
from app.literacy.prompts import get_literacy_instructions
from app.localization.language import get_fallback

class SimulatorService:
    def __init__(self, retriever: Retriever, llm: LLMInterface):
        self.retriever = retriever
        self.llm = llm
        
    def get_simulation(self, request: SimulatorInput) -> PersonCResponse:
        language = request.language if hasattr(request, "language") else "en"

        # 1. Deterministic Calculation (financial facts — unaffected by language)
        sim_result = run_savings_goal_simulation(request)
        
        # 2. Educational Context Retrieval (if question provided)
        question = request.question or ""
        contexts = []
        if question:
            contexts = self.retriever.retrieve(question, top_k=1)
            
        # 3. Literacy Instructions
        tier = request.literacy_tier if request.literacy_tier else 2
        instructions = get_literacy_instructions(tier)
        
        # 4. Generate LLM Explanation in the selected language
        result_dict = sim_result.model_dump()
        
        try:
            llm_text = self.llm.generate_simulator_response(
                result=result_dict,
                instructions=instructions,
                question=question,
                contexts=contexts,
                language=language
            )
        except Exception:
            return PersonCResponse(
                response_text=get_fallback(language, "sim_cannot_process"),
                source_class="system",
                mode="simulator",
                disclaimer=True
            )
            
        if not llm_text:
            return PersonCResponse(
                response_text=get_fallback(language, "sim_error"),
                source_class="system",
                mode="simulator",
                disclaimer=True
            )
            
        # 5. Determine source class
        primary_source_class = contexts[0].metadata.get("source_class", "system") if contexts else "system"
        
        return PersonCResponse(
            response_text=llm_text,
            source_class=primary_source_class,
            mode="simulator",
            disclaimer=True
        )
