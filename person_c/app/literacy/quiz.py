from typing import List

def calculate_tier(answers: List[str]) -> int:
    """
    Deterministically calculates the literacy tier based on quiz answers.
    Assumes each answer is 'A', 'B', or 'C'.
    'A' = 1 point, 'B' = 2 points, 'C' = 3 points.
    
    Scoring boundaries:
    - Score <= 4: Tier 1
    - Score <= 7: Tier 2
    - Score > 7: Tier 3
    """
    score = 0
    for answer in answers:
        ans_upper = answer.strip().upper()
        if ans_upper == 'A':
            score += 1
        elif ans_upper == 'B':
            score += 2
        elif ans_upper == 'C':
            score += 3
        else:
            # Invalid answers contribute 1 point (lowest literacy assumption)
            score += 1
            
    if score <= 4:
        return 1
    elif score <= 7:
        return 2
    else:
        return 3
