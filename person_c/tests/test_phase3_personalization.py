import pytest
from app.personalization.service import PersonalizationService
from app.rag.retrieval import ChromaRetriever
from app.education.llm import MockLLM
from app.contracts.input import GuidanceRequest
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

def get_meera_request(mode="personalized", question="How to reach my goal?", tier=2):
    return GuidanceRequest(
        cash=2000,
        bank=5000,
        shg=2500,
        chit_committed=4000,
        post_office=5000,
        business={
            "activity": "pickle sales + tailoring",
            "last_entry": {
                "revenue": 1000,
                "cost": 600,
                "profit": 400
            }
        },
        goal={
            "name": "Education",
            "target": 20000,
            "saved": 8000
        },
        question=question,
        request_mode=mode,
        literacy_tier=tier
    )

def test_personalization_mode_success(retriever):
    # 39. Mock LLM receives financial state separately from retrieved context.
    # 40. Mock LLM receives calculated facts.
    # 41. Mock LLM receives literacy-tier instructions.
    llm = MockLLM()
    service = PersonalizationService(retriever, llm)
    
    request = get_meera_request()
    resp = service.get_guidance(request)
    
    assert resp.mode == "personalized"
    assert "USER QUESTION: How to reach my goal?" in resp.response_text
    assert "FINANCIAL STATE" in resp.response_text
    assert "CALCULATED FACTS" in resp.response_text
    assert "INSTRUCTIONS FOR TIER 2" in resp.response_text
    
    # 3-17. Ensure values are preserved
    assert "2000" in resp.response_text
    assert "5000" in resp.response_text
    assert "2500" in resp.response_text
    assert "4000" in resp.response_text
    assert "1000" in resp.response_text
    assert "600" in resp.response_text
    assert "400" in resp.response_text
    assert "20000" in resp.response_text
    assert "8000" in resp.response_text

def test_personalization_llm_failure(retriever):
    # 42. LLM failure is handled gracefully.
    llm = MockLLM(simulate_failure=True)
    service = PersonalizationService(retriever, llm)
    
    request = get_meera_request()
    resp = service.get_guidance(request)
    
    assert resp.mode == "personalized"
    assert resp.source_class == "system"
    assert "Sorry" in resp.response_text

def test_personalization_llm_empty(retriever):
    # 43. Empty LLM response is rejected.
    llm = MockLLM(simulate_malformed=True)
    service = PersonalizationService(retriever, llm)
    
    request = get_meera_request()
    resp = service.get_guidance(request)
    
    assert resp.mode == "personalized"
    assert resp.source_class == "system"
    assert "error generating a response" in resp.response_text
