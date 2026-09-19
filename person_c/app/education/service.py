from typing import Optional
from app.rag.retrieval import Retriever
from app.education.llm import LLMInterface
from app.contracts.output import PersonCResponse
from app.localization.language import get_fallback

# Example system prompt for LLM
EDUCATION_SYSTEM_PROMPT = """
You are a financial educator.
- Use the retrieved source material as the factual knowledge base.
- Do not invent financial rules or facts that are not supported by the retrieved context.
- If the retrieved context does not contain enough information to answer the question, say that the available financial-education material does not provide enough information.
- Do not pretend a source supports something it does not support.
- Keep educational information separate from personalized advice.
- Do not perform important numerical calculations.
- Use clear, accessible language.
"""

class EducationService:
    def __init__(self, retriever: Retriever, llm: LLMInterface):
        self.retriever = retriever
        self.llm = llm
        
    def get_guidance(self, question: str, language: str = "en") -> PersonCResponse:
        # Retrieve context
        contexts = self.retriever.retrieve(question, top_k=1)
        
        # Check if insufficient context
        if not contexts or contexts[0].metadata.get("module") == "unknown":
            # Just to be safe with similarity scores in real life, but for now:
            pass

        # In real implementation we'd pass the EDUCATION_SYSTEM_PROMPT alongside context to the LLM.
        try:
            llm_text = self.llm.generate_response(question, contexts, language=language)
        except Exception as e:
            # Safe fallback on LLM failure
            return PersonCResponse(
                response_text=get_fallback(language, "cannot_process"),
                source_class="system",
                mode="education",
                disclaimer=True
            )
            
        if not llm_text:
            # Handle empty/malformed LLM output safely
            return PersonCResponse(
                response_text=get_fallback(language, "error_response"),
                source_class="system",
                mode="education",
                disclaimer=True
            )

        if not contexts:
            return PersonCResponse(
                response_text=llm_text,
                source_class="none",
                mode="education",
                disclaimer=True
            )
            
        # Grounding source class to the top context
        primary_source_class = contexts[0].metadata.get("source_class", "unknown")
        
        return PersonCResponse(
            response_text=llm_text,
            source_class=primary_source_class,
            mode="education",
            disclaimer=True
        )
