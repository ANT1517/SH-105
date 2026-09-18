import pytest
from pydantic import ValidationError
from app.contracts.input import FinancialState
from app.contracts.output import PersonCResponse
from app.contracts.mocks import get_mock_financial_state, DEMO_FIXTURE_DICT

def test_financial_state_mock_schema():
    # 1. The financial-state mock returns the expected schema.
    state = get_mock_financial_state()
    assert isinstance(state, FinancialState)

def test_demo_fixture_values_preserved():
    # 2. The demo fixture values are preserved exactly.
    state = get_mock_financial_state()
    assert state.cash == 2000
    assert state.bank == 5000
    assert state.shg == 2500
    assert state.chit_committed == 4000
    assert state.post_office == 5000
    assert state.business.activity == "pickle sales + tailoring"
    assert state.business.last_entry.revenue == 1000
    assert state.business.last_entry.cost == 600
    assert state.business.last_entry.profit == 400
    assert state.goal.name == "Education"
    assert state.goal.target == 20000
    assert state.goal.saved == 8000

def test_person_c_response_schema_validates():
    # 3. The Person C response schema validates correctly.
    valid_response = {
        "response_text": "Consider saving more",
        "source_class": "RBI/SEBI/NCFE",
        "mode": "education",
        "disclaimer": True
    }
    resp = PersonCResponse(**valid_response)
    assert resp.mode == "education"

def test_invalid_financial_state_rejected():
    # 4. Invalid/malformed financial state is rejected safely.
    invalid_data = DEMO_FIXTURE_DICT.copy()
    del invalid_data["cash"]
    with pytest.raises(ValidationError):
        FinancialState(**invalid_data)

def test_modes_accepted():
    # 5. Both education and personalized modes are accepted.
    PersonCResponse(
        response_text="text", source_class="source", mode="education", disclaimer=False
    )
    PersonCResponse(
        response_text="text", source_class="source", mode="personalized", disclaimer=False
    )
    with pytest.raises(ValidationError):
        PersonCResponse(
            response_text="text", source_class="source", mode="invalid_mode", disclaimer=False # type: ignore
        )

def test_empty_llm_response_invalid():
    # 6. An empty response from the future LLM layer cannot silently produce an invalid response.
    # Simulating LLM returning empty dict or incomplete data
    with pytest.raises(ValidationError):
        PersonCResponse(**{})
