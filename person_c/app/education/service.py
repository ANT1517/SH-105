from typing import Optional
from app.rag.retrieval import Retriever
from app.education.llm import LLMInterface
from app.contracts.output import PersonCResponse

# Example system prompt for LLM
EDUCATION_SYSTEM_PROMPT = """
You are a financial educator.
- Answer using ONLY the supplied retrieved context.
- Do not invent financial facts or sources.
- Do not claim a source that is not present in metadata.
- Do not recommend named financial products.
- If the retrieved context is insufficient, say that the available information is insufficient.
- Keep educational information separate from personalized advice.
- Do not perform important numerical calculations.
- Use clear, accessible language.
- Do not express certainty when the retrieved information does not support certainty.
"""

class EducationService:
    def __init__(self, retriever: Retriever, llm: LLMInterface):
        self.retriever = retriever
        self.llm = llm
        
    def get_guidance(self, question: str) -> PersonCResponse:
        # Retrieve context
        contexts = self.retriever.retrieve(question, top_k=1)
        
        # Check if insufficient context
        if not contexts or contexts[0].metadata.get("module") == "unknown":
            # Just to be safe with similarity scores in real life, but for now:
            pass

        # In real implementation we'd pass the EDUCATION_SYSTEM_PROMPT alongside context to the LLM.
        try:
            llm_text = self.llm.generate_response(question, contexts)
        except Exception as e:
            # Safe fallback on LLM failure
            return PersonCResponse(
                response_text="Sorry, I am currently unable to process your request.",
                source_class="system",
                mode="education",
                disclaimer=True
            )
            
        if not llm_text:
            # Handle empty/malformed LLM output safely
            return PersonCResponse(
                response_text="Sorry, I encountered an error generating a response.",
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
