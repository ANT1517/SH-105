import pytest
from unittest.mock import patch, MagicMock
from app.education.llm import GroqLLM
from app.rag.models import RetrievedContext

@patch("groq.Groq")
def test_groq_llm_success(mock_groq_class):
    mock_client = MagicMock()
    mock_groq_class.return_value = mock_client
    
    mock_completion = MagicMock()
    mock_completion.choices[0].message.content = "This is a successful response."
    mock_client.chat.completions.create.return_value = mock_completion
    
    llm = GroqLLM(api_key="fake-key")
    contexts = [RetrievedContext(text="Some context", metadata={}, score=1.0)]
    
    resp = llm.generate_response("What is saving?", contexts)
    assert resp == "This is a successful response."
    
    # Assert correct parameters were passed to groq
    mock_client.chat.completions.create.assert_called_once()
    args, kwargs = mock_client.chat.completions.create.call_args
    assert kwargs["model"] == "openai/gpt-oss-20b"
    assert len(kwargs["messages"]) == 2
    assert kwargs["messages"][0]["role"] == "system"
    assert kwargs["messages"][1]["role"] == "user"

@patch("groq.Groq")
def test_groq_llm_api_failure(mock_groq_class):
    mock_client = MagicMock()
    mock_groq_class.return_value = mock_client
    
    mock_client.chat.completions.create.side_effect = Exception("API Timeout")
    
    llm = GroqLLM(api_key="fake-key")
    contexts = [RetrievedContext(text="Some context", metadata={}, score=1.0)]
    
    # Should safely return empty string on failure
    resp = llm.generate_response("What is saving?", contexts)
    assert resp == ""

def test_groq_llm_missing_api_key():
    # If API key is None, it should handle gracefully
    llm = GroqLLM(api_key=None)
    # The client might throw an error on init or on request, but our LLM class catches it
    contexts = [RetrievedContext(text="Some context", metadata={}, score=1.0)]
    resp = llm.generate_response("What is saving?", contexts)
    assert "retrieved material does not contain enough information" in resp

@patch("groq.Groq")
def test_groq_llm_no_context(mock_groq_class):
    mock_client = MagicMock()
    mock_groq_class.return_value = mock_client
    
    llm = GroqLLM(api_key="fake-key")
    
    # Empty contexts should return fallback immediately
    resp = llm.generate_response("What is saving?", [])
    assert "don't have enough information" in resp
    mock_client.chat.completions.create.assert_not_called()

@patch("groq.Groq")
def test_groq_llm_simulator_prompt_preserves_facts(mock_groq_class):
    mock_client = MagicMock()
    mock_groq_class.return_value = mock_client
    
    mock_completion = MagicMock()
    mock_completion.choices[0].message.content = "Simulator explanation."
    mock_client.chat.completions.create.return_value = mock_completion
    
    llm = GroqLLM(api_key="fake-key")
    
    result = {
        "scenario": "savings_goal",
        "target": 20000.0,
        "saved": 8000.0,
        "gap": 12000.0,
        "months_required": 12,
        "feasible": True,
        "assumptions": "None",
        "missing_information": "None",
        "monthly_contribution": 1000.0
    }
    
    llm.generate_simulator_response(result, "Tier 2", "Can I make it?", [])
    
    args, kwargs = mock_client.chat.completions.create.call_args
    system_prompt = kwargs["messages"][0]["content"]
    
    # Verify the deterministic facts were injected into the system prompt
    assert "Gap=12000.0" in system_prompt
    assert "Do NOT perform the authoritative financial calculation yourself" in system_prompt

@patch("groq.Groq")
def test_groq_llm_safety_prompt_preserves_facts(mock_groq_class):
    mock_client = MagicMock()
    mock_groq_class.return_value = mock_client
    
    mock_completion = MagicMock()
    mock_completion.choices[0].message.content = "Safety explanation."
    mock_client.chat.completions.create.return_value = mock_completion
    
    llm = GroqLLM(api_key="fake-key")
    
    result = {
        "classification": "SUSPICIOUS",
        "signals": ["urgent", "link"],
        "recommended_action": "Do not click",
        "uncertainty": "Be careful"
    }
    
    llm.generate_safety_response(result, "Click this link", "Tier 2")
    
    args, kwargs = mock_client.chat.completions.create.call_args
    system_prompt = kwargs["messages"][0]["content"]
    
    # Verify deterministic classification is injected
    assert "Classification: SUSPICIOUS" in system_prompt
    assert "Do NOT override the classification" in system_prompt
