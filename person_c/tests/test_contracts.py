import pytest
from pydantic import ValidationError
from app.contracts.input import FinancialState, GuidanceRequest, BusinessData, GoalData
from app.contracts.output import PersonCResponse
from app.contracts.mocks import get_mock_financial_state, DEMO_FIXTURE_DICT

def test_financial_state_valid_minimal():
    # Only required fields (business and goal are Optional)
    state = FinancialState(cash=0, bank=0, shg=0, chit_committed=0, post_office=0)
    assert state.cash == 0
    assert state.business is None
    assert state.goal is None

def test_financial_state_valid_complete():
    state = get_mock_financial_state()
    assert state.cash == 2000
    assert state.bank == 5000
    assert state.business is not None
    assert state.business.last_entry.profit == 400
    assert state.goal is not None
    assert state.goal.target == 20000

def test_financial_state_missing_required():
    with pytest.raises(ValidationError):
        FinancialState(cash=100) # Missing bank, shg, etc.

def test_financial_state_wrong_types():
    with pytest.raises(ValidationError):
        FinancialState(cash="invalid", bank=5000, shg=2500, chit_committed=4000, post_office=5000)

def test_financial_state_negative_values_allowed():
    # Validation doesn't currently forbid negatives, so we test it accepts them.
    # Do not change production behavior merely to make tests pass.
    state = FinancialState(cash=-100, bank=-50, shg=0, chit_committed=0, post_office=0)
    assert state.cash == -100

def test_financial_state_malformed_nested():
    valid_base = {"cash": 0, "bank": 0, "shg": 0, "chit_committed": 0, "post_office": 0}
    with pytest.raises(ValidationError):
        FinancialState(**valid_base, business={"activity": "only_activity_no_last_entry"})
    with pytest.raises(ValidationError):
        FinancialState(**valid_base, goal={"name": "only_name_no_target"})

# --- PersonCResponse Tests ---

def test_person_c_response_modes():
    PersonCResponse(response_text="test", source_class="system", mode="education", disclaimer=False)
    PersonCResponse(response_text="test", source_class="system", mode="personalized", disclaimer=False)
    PersonCResponse(response_text="test", source_class="system", mode="simulator", disclaimer=False)
    PersonCResponse(response_text="test", source_class="system", mode="safety", disclaimer=False)
    with pytest.raises(ValidationError):
        PersonCResponse(response_text="test", source_class="system", mode="invalid_mode", disclaimer=False)

def test_person_c_response_missing_fields():
    with pytest.raises(ValidationError):
        PersonCResponse(response_text="missing mode and source")

def test_person_c_response_disclaimer():
    resp = PersonCResponse(response_text="test", source_class="system", mode="education", disclaimer=True)
    assert resp.disclaimer is True

# --- GuidanceRequest Tests ---

def test_guidance_request_education():
    req = GuidanceRequest(
        cash=0, bank=0, shg=0, chit_committed=0, post_office=0,
        question="How to save?", request_mode="education"
    )
    assert req.question == "How to save?"
    assert req.request_mode == "education"
    assert req.literacy_tier is None

def test_guidance_request_personalized():
    req = GuidanceRequest(
        **DEMO_FIXTURE_DICT,
        question="How to save 20k?", request_mode="personalized", literacy_tier=2
    )
    assert req.cash == 2000
    assert req.literacy_tier == 2

def test_guidance_request_missing_question():
    # question is Optional in Pydantic, API validation handles it, but contract accepts None
    req = GuidanceRequest(
        cash=0, bank=0, shg=0, chit_committed=0, post_office=0
    )
    assert req.question is None
