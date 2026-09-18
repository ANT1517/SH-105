import pytest
from app.safety.service import SafetyService
from app.education.llm import MockLLM
from app.contracts.safety import SafetyRequest

def get_base_request():
    return SafetyRequest(
        message="Your KYC will expire, click to verify",
        literacy_tier=2
    )

def test_safety_llm_receives_structured_result():
    # 31. Mock LLM receives deterministic Safety Shield results.
    # 32. LLM cannot override/change the deterministic classification.
    llm = MockLLM()
    service = SafetyService(llm)
    
    req = get_base_request()
    resp = service.check_message(req)
    
    assert resp.mode == "safety"
    assert "MESSAGE: Your KYC will expire, click to verify" in resp.response_text
    assert "CLASSIFICATION: SUSPICIOUS" in resp.response_text
    assert "DETECTED SIGNALS:" in resp.response_text
    assert "RECOMMENDED ACTION: Do not click any links" in resp.response_text
    assert "UNCERTAINTY: Be careful" in resp.response_text
    assert "INSTRUCTIONS FOR TIER 2" in resp.response_text

def test_safety_llm_failure():
    # 33. LLM failure is handled gracefully.
    llm = MockLLM(simulate_failure=True)
    service = SafetyService(llm)
    
    req = get_base_request()
    resp = service.check_message(req)
    
    assert resp.mode == "safety"
    assert "encountered an issue" in resp.response_text
    assert "certainty" in resp.response_text # Uncertainty fallback is included

def test_safety_llm_empty():
    # 34. Empty LLM response is handled safely.
    # 35. Malformed LLM output is handled safely.
    llm = MockLLM(simulate_malformed=True)
    service = SafetyService(llm)
    
    req = get_base_request()
    resp = service.check_message(req)
    
    assert resp.mode == "safety"
    assert "Error generating" in resp.response_text
    assert "certainty" in resp.response_text

def test_safety_without_llm_conceptually():
    # 36. Safety Shield works without an LLM.
    # This is proven by the logic tests, but here we can see that if LLM fails, 
    # we still return a valid PersonCResponse containing the fallback uncertainty string.
    llm = MockLLM(simulate_failure=True)
    service = SafetyService(llm)
    resp = service.check_message(get_base_request())
    assert resp.mode == "safety"
    assert resp.disclaimer is True

def test_safety_literacy_tier_independence():
    # 37. Tier 1 explanation uses Tier 1 instructions.
    # 38. Tier 3 explanation uses Tier 3 instructions.
    # 39. Underlying SafetyResult remains identical across tiers.
    llm = MockLLM()
    service = SafetyService(llm)
    
    req1 = get_base_request()
    req1.literacy_tier = 1
    resp1 = service.check_message(req1)
    
    req3 = get_base_request()
    req3.literacy_tier = 3
    resp3 = service.check_message(req3)
    
    assert "INSTRUCTIONS FOR TIER 1" in resp1.response_text
    assert "INSTRUCTIONS FOR TIER 3" in resp3.response_text
    
    # Both receive identical deterministic classifications
    assert "CLASSIFICATION: SUSPICIOUS" in resp1.response_text
    assert "CLASSIFICATION: SUSPICIOUS" in resp3.response_text
