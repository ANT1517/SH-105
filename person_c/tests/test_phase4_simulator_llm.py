import pytest
from app.simulator.service import SimulatorService
from app.rag.retrieval import ChromaRetriever
from app.education.llm import MockLLM
from app.contracts.simulator import SimulatorInput
import chromadb
from app.rag.ingestion import setup_chroma_collection

@pytest.fixture
def test_collection():
    client = chromadb.EphemeralClient()
    try:
        client.delete_collection("test_saathi")
    except:
        pass
    return setup_chroma_collection(client, "test_saathi")

@pytest.fixture
def retriever(test_collection):
    return ChromaRetriever(test_collection)

def get_base_input():
    return SimulatorInput(
        scenario="savings_goal_feasibility",
        target=20000,
        saved=8000,
        monthly_contribution=1000,
        timeframe_months=15,
        literacy_tier=2,
        question="How to save money?"
    )

def test_simulator_llm_receives_structured_result(retriever):
    # 25. Mock LLM receives the deterministic simulator result.
    # 26. Mock LLM is not responsible for calculations.
    # 27. LLM cannot change the deterministic numerical result in the final validated simulator data.
    # 31, 32. Tier instructions are used.
    # 34, 35. RAG interaction works.
    llm = MockLLM()
    service = SimulatorService(retriever, llm)
    
    inp = get_base_input()
    resp = service.get_simulation(inp)
    
    assert resp.mode == "simulator"
    assert resp.source_class != "system" # Should get the source class from RAG
    
    # Check that LLM received structured parts
    assert "SCENARIO: savings_goal_feasibility" in resp.response_text
    assert "KNOWN INPUTS: Target=20000.0, Saved=8000.0, Monthly=1000.0" in resp.response_text
    assert "CALCULATED RESULTS: Gap=12000.0, Months=12, Feasible=True" in resp.response_text
    assert "INSTRUCTIONS FOR TIER 2" in resp.response_text
    assert "USER QUESTION: How to save money?" in resp.response_text
    assert "RETRIEVED EDUCATIONAL CONTEXT" in resp.response_text

def test_simulator_llm_failure(retriever):
    # 29. LLM failure is handled.
    llm = MockLLM(simulate_failure=True)
    service = SimulatorService(retriever, llm)
    
    inp = get_base_input()
    resp = service.get_simulation(inp)
    
    assert resp.mode == "simulator"
    assert resp.source_class == "system"
    assert "Sorry" in resp.response_text

def test_simulator_llm_empty(retriever):
    # 28. Empty LLM response is handled.
    # 30. Malformed LLM output is handled safely.
    llm = MockLLM(simulate_malformed=True)
    service = SimulatorService(retriever, llm)
    
    inp = get_base_input()
    resp = service.get_simulation(inp)
    
    assert resp.mode == "simulator"
    assert resp.source_class == "system"
    assert "error explaining the simulation" in resp.response_text

def test_simulator_without_rag(retriever):
    # 36. Simulator calculations do not depend on RAG availability.
    # If question is None, no RAG is fetched.
    llm = MockLLM()
    service = SimulatorService(retriever, llm)
    
    inp = get_base_input()
    inp.question = None
    
    resp = service.get_simulation(inp)
    
    assert resp.mode == "simulator"
    assert resp.source_class == "system"
    assert "None" in resp.response_text  # MockLLM joins "None" if empty context
    assert "USER QUESTION: " in resp.response_text

def test_simulator_literacy_tier_independence(retriever):
    # 33. The numerical simulator result is identical across literacy tiers.
    llm = MockLLM()
    service = SimulatorService(retriever, llm)
    
    inp1 = get_base_input()
    inp1.literacy_tier = 1
    resp1 = service.get_simulation(inp1)
    
    inp2 = get_base_input()
    inp2.literacy_tier = 3
    resp2 = service.get_simulation(inp2)
    
    assert "INSTRUCTIONS FOR TIER 1" in resp1.response_text
    assert "INSTRUCTIONS FOR TIER 3" in resp2.response_text
    
    # Both receive identical calculated results
    assert "CALCULATED RESULTS: Gap=12000.0, Months=12, Feasible=True" in resp1.response_text
    assert "CALCULATED RESULTS: Gap=12000.0, Months=12, Feasible=True" in resp2.response_text
