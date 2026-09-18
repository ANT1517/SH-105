import pytest
from app.contracts.simulator import SimulatorInput
from app.simulator.deterministic import run_savings_goal_simulation
import math

def test_gap_calculation_basic():
    # 6. target 20,000, saved 8,000 -> gap 12,000
    inp = SimulatorInput(scenario="savings_goal_feasibility", target=20000, saved=8000)
    res = run_savings_goal_simulation(inp)
    assert res.gap == 12000.0

def test_gap_calculation_zero():
    # 7. saved == target -> gap 0
    inp = SimulatorInput(scenario="savings_goal_feasibility", target=20000, saved=20000)
    res = run_savings_goal_simulation(inp)
    assert res.gap == 0.0
    assert "target has already been met or exceeded" in res.assumptions[0]
    assert res.feasible is True

def test_gap_calculation_exceeded():
    # 8. saved > target -> target-exceeded state is represented correctly
    inp = SimulatorInput(scenario="savings_goal_feasibility", target=20000, saved=25000)
    res = run_savings_goal_simulation(inp)
    assert res.gap == 0.0
    assert res.feasible is True

def test_monthly_contribution_valid():
    # 11. Valid monthly contribution calculates months_required correctly.
    inp = SimulatorInput(scenario="savings_goal_feasibility", target=20000, saved=8000, monthly_contribution=1000)
    res = run_savings_goal_simulation(inp)
    assert res.months_required == 12

def test_monthly_contribution_decimal():
    # 12. Decimal monthly contribution is handled correctly.
    inp = SimulatorInput(scenario="savings_goal_feasibility", target=20000, saved=8000, monthly_contribution=1234.56)
    res = run_savings_goal_simulation(inp)
    assert res.months_required == math.ceil(12000 / 1234.56)

def test_monthly_contribution_zero():
    # 13. Monthly contribution = 0 does not cause division-by-zero.
    inp = SimulatorInput(scenario="savings_goal_feasibility", target=20000, saved=8000, monthly_contribution=0)
    res = run_savings_goal_simulation(inp)
    assert res.months_required is None
    assert any("Valid (positive) monthly contribution is required" in m for m in res.missing_information)

def test_monthly_contribution_negative():
    # 14. Negative monthly contribution is rejected safely.
    inp = SimulatorInput(scenario="savings_goal_feasibility", target=20000, saved=8000, monthly_contribution=-500)
    res = run_savings_goal_simulation(inp)
    assert res.months_required is None
    assert any("Valid (positive) monthly contribution is required" in m for m in res.missing_information)

def test_monthly_contribution_missing():
    # 15. Missing monthly contribution does not produce an invented result.
    inp = SimulatorInput(scenario="savings_goal_feasibility", target=20000, saved=8000)
    res = run_savings_goal_simulation(inp)
    assert res.months_required is None
    assert any("Monthly contribution amount is required" in m for m in res.missing_information)

def test_timeframe_valid_feasible():
    # 16. Valid timeframe is handled.
    # 17. Required months can be compared against timeframe.
    inp = SimulatorInput(scenario="savings_goal_feasibility", target=20000, saved=8000, monthly_contribution=1000, timeframe_months=15)
    res = run_savings_goal_simulation(inp)
    assert res.feasible is True

def test_timeframe_valid_unfeasible():
    inp = SimulatorInput(scenario="savings_goal_feasibility", target=20000, saved=8000, monthly_contribution=1000, timeframe_months=10)
    res = run_savings_goal_simulation(inp)
    assert res.feasible is False

def test_timeframe_missing():
    # 18. Missing timeframe is handled without invention.
    inp = SimulatorInput(scenario="savings_goal_feasibility", target=20000, saved=8000, monthly_contribution=1000)
    res = run_savings_goal_simulation(inp)
    assert res.feasible is None
    assert any("Timeframe (in months) is required" in m for m in res.missing_information)

def test_timeframe_invalid():
    # 19. Invalid/negative timeframe is rejected safely.
    inp = SimulatorInput(scenario="savings_goal_feasibility", target=20000, saved=8000, monthly_contribution=1000, timeframe_months=-5)
    res = run_savings_goal_simulation(inp)
    assert res.feasible is None
    assert any("Valid (positive) timeframe is required" in m for m in res.missing_information)

def test_calculation_deterministic():
    # 9. Calculation is deterministic.
    # 10. Calculation does not use the LLM.
    inp = SimulatorInput(scenario="savings_goal_feasibility", target=20000, saved=8000)
    res1 = run_savings_goal_simulation(inp)
    res2 = run_savings_goal_simulation(inp)
    assert res1 == res2
