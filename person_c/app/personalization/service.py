from typing import Optional
from app.rag.retrieval import Retriever
from app.education.llm import LLMInterface
from app.contracts.output import PersonCResponse
from app.contracts.input import GuidanceRequest
from app.calculator.deterministic import calculate_financial_facts
from app.literacy.prompts import get_literacy_instructions

class PersonalizationService:
    def __init__(self, retriever: Retriever, llm: LLMInterface):
        self.retriever = retriever
        self.llm = llm
        
    def get_guidance(self, request: GuidanceRequest) -> PersonCResponse:
        question = request.question or ""
        
        # 1. Retrieve context via RAG
        contexts = self.retriever.retrieve(question, top_k=1)
        
        # 2. Run deterministic calculations
        facts = calculate_financial_facts(request)
        
        # 3. Get literacy instructions
        tier = request.literacy_tier if request.literacy_tier else 2
        instructions = get_literacy_instructions(tier)
        
        # 4. Generate response via LLM
        state_dict = request.model_dump()
        facts_dict = facts.model_dump()
        
        try:
            llm_text = self.llm.generate_personalized_response(
                question=question,
                contexts=contexts,
                financial_state=state_dict,
                calculated_facts=facts_dict,
                literacy_instructions=instructions
            )
        except Exception:
            return PersonCResponse(
                response_text="Sorry, I am currently unable to process your request.",
                source_class="system",
                mode="personalized",
                disclaimer=True
            )
            
        if not llm_text:
            return PersonCResponse(
                response_text="Sorry, I encountered an error generating a response.",
                source_class="system",
                mode="personalized",
                disclaimer=True
            )
            
        # Grounding source class to the top context if available
        primary_source_class = contexts[0].metadata.get("source_class", "unknown") if contexts else "none"
        
        return PersonCResponse(
            response_text=llm_text,
            source_class=primary_source_class,
            mode="personalized",
            disclaimer=True
        )
