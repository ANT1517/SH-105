from typing import List
from app.rag.models import RetrievedContext
import os

def format_contexts(contexts: List[RetrievedContext]) -> str:
    if not contexts:
        return "None"
    parts = []
    for c in contexts:
        meta = c.metadata
        source_name = meta.get("source_name", "Unknown")
        source_class = meta.get("source_class", "Unknown")
        source_url = meta.get("source_url", "Unknown")
        topic = meta.get("topic", "Unknown")
        parts.append(f"[Source: {source_name} | Class: {source_class} | Topic: {topic} | URL: {source_url}]\n{c.text}")
    return "\n\n".join(parts)

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
            
        return f"Based on the provided context:\n{format_contexts(contexts)}"
        
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
            
        parts = [
            f"USER QUESTION: {question}",
            f"FINANCIAL STATE: {financial_state}",
            f"CALCULATED FACTS: {calculated_facts}",
            f"RETRIEVED EDUCATIONAL CONTEXT:\n{format_contexts(contexts)}",
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
            
        parts = [
            f"SCENARIO: {result.get('scenario')}",
            f"KNOWN INPUTS: Target={result.get('target')}, Saved={result.get('saved')}, Monthly={result.get('monthly_contribution')}",
            f"CALCULATED RESULTS: Gap={result.get('gap')}, Months={result.get('months_required')}, Feasible={result.get('feasible')}",
            f"ASSUMPTIONS: {result.get('assumptions')}",
            f"MISSING INFORMATION: {result.get('missing_information')}",
            f"LITERACY INSTRUCTIONS: {instructions}",
            f"USER QUESTION: {question}",
            f"RETRIEVED EDUCATIONAL CONTEXT:\n{format_contexts(contexts)}"
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

class GroqLLM(LLMInterface):
    def __init__(self, api_key: str, model: str = "openai/gpt-oss-20b"):
        from groq import Groq
        self.client = Groq(api_key=api_key)
        self.model = model

    def _call_groq(self, system_prompt: str, user_prompt: str) -> str:
        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.0
            )
            return completion.choices[0].message.content or ""
        except Exception:
            return ""

    def generate_response(self, question: str, contexts: List[RetrievedContext]) -> str:
        if not contexts:
            return "I don't have enough information to answer that."
        
        system = (
            "You are a helpful financial educator.\n"
            "Use the retrieved source material as the factual knowledge base. "
            "Do not invent financial rules or facts that are not supported by the retrieved context. "
            "If the retrieved context does not contain enough information to answer the question, "
            "say that the available financial-education material does not provide enough information. "
            "Do not pretend a source supports something it does not support.\n\n"
            f"Retrieved Context:\n{format_contexts(contexts)}"
        )
        return self._call_groq(system, question)

    def generate_personalized_response(
        self, 
        question: str, 
        contexts: List[RetrievedContext], 
        financial_state: dict, 
        calculated_facts: dict, 
        literacy_instructions: str
    ) -> str:
        system = (
            "You are a personalized financial assistant.\n"
            f"{literacy_instructions}\n"
            "Use the retrieved source material as the factual knowledge base. "
            "Do not invent financial rules or facts that are not supported by the retrieved context. "
            "Use the provided financial state and calculated facts to answer the user.\n"
            "Do NOT recalculate numbers; explain the provided calculated facts instead.\n\n"
            f"Financial State:\n{financial_state}\n\n"
            f"Calculated Facts:\n{calculated_facts}\n\n"
            f"Retrieved Educational Context:\n{format_contexts(contexts)}"
        )
        return self._call_groq(system, question)

    def generate_simulator_response(
        self,
        result: dict,
        instructions: str,
        question: str,
        contexts: List[RetrievedContext]
    ) -> str:
        system = (
            "You are a financial simulator assistant.\n"
            f"{instructions}\n"
            "Explain the simulator results to the user based on the scenario below.\n"
            "Do NOT perform the authoritative financial calculation yourself; explain the provided calculated Gap, Months, and Feasibility.\n\n"
            f"Scenario: {result.get('scenario')}\n"
            f"Inputs: Target={result.get('target')}, Saved={result.get('saved')}, Monthly={result.get('monthly_contribution')}\n"
            f"Results: Gap={result.get('gap')}, Months={result.get('months_required')}, Feasible={result.get('feasible')}\n"
            f"Assumptions: {result.get('assumptions')}\n"
            f"Missing Info: {result.get('missing_information')}\n\n"
            f"Retrieved Educational Context:\n{format_contexts(contexts)}"
        )
        return self._call_groq(system, question)

    def generate_safety_response(
        self,
        result: dict,
        message: str,
        instructions: str
    ) -> str:
        system = (
            "You are a safety shield assistant.\n"
            f"{instructions}\n"
            "The deterministic safety shield has classified a message.\n"
            "Do NOT override the classification or invent a different classification.\n"
            "Your job is ONLY to explain this classification to the user safely.\n\n"
            f"Classification: {result.get('classification')}\n"
            f"Detected Signals: {result.get('signals')}\n"
            f"Recommended Action: {result.get('recommended_action')}\n"
            f"Uncertainty Note: {result.get('uncertainty')}"
        )
        user_prompt = f"Message to explain:\n{message}"
        return self._call_groq(system, user_prompt)
