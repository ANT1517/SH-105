import pytest
from app.literacy.quiz import calculate_tier
from app.literacy.prompts import get_literacy_instructions

def test_quiz_tier_1_boundary():
    # 26. Boundary score for Tier 1 is tested.
    # Score 4 -> Tier 1
    # 'A' = 1, 'B' = 2, 'C' = 3
    # A, A, B -> 1+1+2 = 4 -> Tier 1
    assert calculate_tier(["A", "A", "B"]) == 1
    # 21. Tier 1 is accepted.
    assert calculate_tier(["A", "A", "A"]) == 1

def test_quiz_tier_2_boundary():
    # 27. Boundary score for Tier 2 is tested.
    # Score 5 to 7 -> Tier 2
    # A, B, B -> 1+2+2 = 5 -> Tier 2
    assert calculate_tier(["A", "B", "B"]) == 2
    # B, B, C -> 2+2+3 = 7 -> Tier 2
    assert calculate_tier(["B", "B", "C"]) == 2
    # 22. Tier 2 is accepted.
    assert calculate_tier(["B", "B", "B"]) == 2

def test_quiz_tier_3_boundary():
    # 28. Boundary score for Tier 3 is tested.
    # Score > 7 -> Tier 3
    # B, C, C -> 2+3+3 = 8 -> Tier 3
    assert calculate_tier(["B", "C", "C"]) == 3
    # 23. Tier 3 is accepted.
    assert calculate_tier(["C", "C", "C"]) == 3

def test_quiz_invalid_answers_handled():
    # 29. Invalid quiz answers are handled safely.
    # Invalid defaults to 1 point.
    # 'X', 'Y', 'Z' -> 1+1+1 = 3 -> Tier 1
    assert calculate_tier(["X", "Y", "Z"]) == 1
    # 24. Invalid tier is rejected/handled safely (by mapping to default 1)
    # Mixed invalid
    assert calculate_tier(["C", "X", "C"]) == 2 # 3 + 1 + 3 = 7 -> Tier 2

def test_literacy_instructions_generation():
    # 30. Tier 1 generates simple-language instructions.
    t1_instr = get_literacy_instructions(1)
    assert "very simple vocabulary" in t1_instr
    
    # 31. Tier 3 generates more detailed instructions.
    t3_instr = get_literacy_instructions(3)
    assert "Provide complete reasoning" in t3_instr
    
    # 32. Same question at Tier 1 and Tier 3 produces meaningfully different prompt instructions.
    assert t1_instr != t3_instr
