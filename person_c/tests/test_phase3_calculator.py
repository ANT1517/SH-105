import pytest
from app.contracts.input import FinancialState, BusinessData, GoalData
from app.calculator.deterministic import calculate_financial_facts

def get_meera_state():
    return FinancialState(
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
        }
    )

def test_calculator_meera_goal_gap():
    # 34. 20,000 target - 8,000 saved = 12,000.
    state = get_meera_state()
    facts = calculate_financial_facts(state)
    assert facts.goal_gap == 12000.0

def test_calculator_goal_gap_zero():
    # 35. Saved amount equal to target produces zero gap.
    state = get_meera_state()
    state.goal.saved = 20000.0
    facts = calculate_financial_facts(state)
    assert facts.goal_gap == 0.0

def test_calculator_goal_gap_over_saved():
    # 36. Saved amount greater than target is handled explicitly.
    state = get_meera_state()
    state.goal.saved = 25000.0
    facts = calculate_financial_facts(state)
    assert facts.goal_gap == 0.0

def test_calculator_extracts_pots():
    state = get_meera_state()
    facts = calculate_financial_facts(state)
    assert facts.pots["Cash"] == 2000
    assert facts.pots["Bank"] == 5000
    assert facts.pots["SHG"] == 2500
    assert facts.pots["Chit committed"] == 4000
    assert facts.pots["Post Office"] == 5000
    assert facts.total_saved == 18500.0

def test_calculator_is_deterministic():
    # 38. Calculation is deterministic.
    state = get_meera_state()
    facts1 = calculate_financial_facts(state)
    facts2 = calculate_financial_facts(state)
    assert facts1 == facts2

def test_calculator_saved_zero():
    state = get_meera_state()
    state.goal.saved = 0.0
    facts = calculate_financial_facts(state)
    assert facts.goal_gap == 20000.0

def test_calculator_target_zero():
    state = get_meera_state()
    state.goal.target = 0.0
    state.goal.saved = 0.0
    facts = calculate_financial_facts(state)
    assert facts.goal_gap == 0.0

def test_calculator_large_values():
    state = get_meera_state()
    state.goal.target = 999999999.0
    state.goal.saved = 111111111.0
    facts = calculate_financial_facts(state)
    assert facts.goal_gap == 888888888.0

def test_calculator_negative_values():
    state = get_meera_state()
    state.goal.target = 20000.0
    state.goal.saved = -5000.0
    facts = calculate_financial_facts(state)
    assert facts.goal_gap == 25000.0

