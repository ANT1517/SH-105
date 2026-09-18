from typing import List
from app.rag.models import RetrievedContext

class LLMInterface:
    def generate_response(self, question: str, contexts: List[RetrievedContext]) -> str:
        raise NotImplementedError

    def generate_personalized_response(
        self, 
        question: str, 
        contexts: List[RetrievedContext], 
        financial_state: dict, 
        calculated_facts: dict, 
        literacy_instructions: str
    ) -> str:
        raise NotImplementedError

    def generate_simulator_response(
        self,
        result: dict,
        instructions: str,
        question: str,
        contexts: List[RetrievedContext]
    ) -> str:
        raise NotImplementedError

    def generate_safety_response(
        self,
        result: dict,
        message: str,
        instructions: str
    ) -> str:
        raise NotImplementedError

class MockLLM(LLMInterface):
    def __init__(self, simulate_failure: bool = False, simulate_malformed: bool = False):
        self.simulate_failure = simulate_failure
        self.simulate_malformed = simulate_malformed
        
    def generate_response(self, question: str, contexts: List[RetrievedContext]) -> str:
        if self.simulate_failure:
            raise Exception("LLM connection failed")
        if self.simulate_malformed:
            return "" # returning empty string can simulate malformed or empty output
        
        if not contexts:
            return "I don't have enough information to answer that."
            
        # For testing, we just parrot back the context text to prove grounding
        context_texts = [c.text for c in contexts]
        return f"Based on the provided context: {' '.join(context_texts)}"
        
    def generate_personalized_response(
        self, 
        question: str, 
        contexts: List[RetrievedContext], 
        financial_state: dict, 
        calculated_facts: dict, 
        literacy_instructions: str
    ) -> str:
        if self.simulate_failure:
            raise Exception("LLM connection failed")
        if self.simulate_malformed:
            return ""
            
        context_texts = [c.text for c in contexts] if contexts else ["None"]
        
        # Parrot back the sections for testing
        parts = [
            f"USER QUESTION: {question}",
            f"FINANCIAL STATE: {financial_state}",
            f"CALCULATED FACTS: {calculated_facts}",
            f"RETRIEVED EDUCATIONAL CONTEXT: {' '.join(context_texts)}",
            f"INSTRUCTIONS: {literacy_instructions}"
        ]
        return "\n".join(parts)

    def generate_simulator_response(
        self,
        result: dict,
        instructions: str,
        question: str,
        contexts: List[RetrievedContext]
    ) -> str:
        if self.simulate_failure:
            raise Exception("LLM connection failed")
        if self.simulate_malformed:
            return ""
            
        context_texts = [c.text for c in contexts] if contexts else ["None"]
        
        parts = [
            f"SCENARIO: {result.get('scenario')}",
            f"KNOWN INPUTS: Target={result.get('target')}, Saved={result.get('saved')}, Monthly={result.get('monthly_contribution')}",
            f"CALCULATED RESULTS: Gap={result.get('gap')}, Months={result.get('months_required')}, Feasible={result.get('feasible')}",
            f"ASSUMPTIONS: {result.get('assumptions')}",
            f"MISSING INFORMATION: {result.get('missing_information')}",
            f"LITERACY INSTRUCTIONS: {instructions}",
            f"USER QUESTION: {question}",
            f"RETRIEVED EDUCATIONAL CONTEXT: {' '.join(context_texts)}"
        ]
        return "\n".join(parts)

    def generate_safety_response(
        self,
        result: dict,
        message: str,
        instructions: str
    ) -> str:
        if self.simulate_failure:
            raise Exception("LLM connection failed")
        if self.simulate_malformed:
            return ""
            
        parts = [
            f"MESSAGE: {message}",
            f"CLASSIFICATION: {result.get('classification')}",
            f"DETECTED SIGNALS: {result.get('signals')}",
            f"RECOMMENDED ACTION: {result.get('recommended_action')}",
            f"UNCERTAINTY: {result.get('uncertainty')}",
            f"LITERACY INSTRUCTIONS: {instructions}"
        ]
        return "\n".join(parts)
