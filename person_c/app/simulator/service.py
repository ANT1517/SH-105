from app.rag.retrieval import Retriever
from app.education.llm import LLMInterface
from app.contracts.output import PersonCResponse
from app.contracts.simulator import SimulatorInput
from app.simulator.deterministic import run_savings_goal_simulation
from app.literacy.prompts import get_literacy_instructions

class SimulatorService:
    def __init__(self, retriever: Retriever, llm: LLMInterface):
        self.retriever = retriever
        self.llm = llm
        
    def get_simulation(self, request: SimulatorInput) -> PersonCResponse:
        # 1. Deterministic Calculation
        sim_result = run_savings_goal_simulation(request)
        
        # 2. Educational Context Retrieval (if question provided)
        question = request.question or ""
        contexts = []
        if question:
            contexts = self.retriever.retrieve(question, top_k=1)
            
        # 3. Literacy Instructions
        tier = request.literacy_tier if request.literacy_tier else 2
        instructions = get_literacy_instructions(tier)
        
        # 4. Generate LLM Explanation
        result_dict = sim_result.model_dump()
        
        try:
            llm_text = self.llm.generate_simulator_response(
                result=result_dict,
                instructions=instructions,
                question=question,
                contexts=contexts
            )
        except Exception:
            return PersonCResponse(
                response_text="Sorry, I am currently unable to process your simulation request.",
                source_class="system",
                mode="simulator",
                disclaimer=True
            )
            
        if not llm_text:
            return PersonCResponse(
                response_text="Sorry, I encountered an error explaining the simulation.",
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
