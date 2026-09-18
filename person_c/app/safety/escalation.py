from typing import List
from app.contracts.safety import SafetySignal, SafetyResult

def escalate_signals(signals: List[SafetySignal]) -> SafetyResult:
    """
    Evaluates safety signals and deterministically determines the escalation category.
    Enforces uncertainty rules (never claims definitive fraud).
    """
    
    if not signals:
        return SafetyResult(
            classification="SAFE",
            signals=[],
            explanation="No suspicious patterns were detected in this message.",
            uncertainty="While this message appears safe, always remain vigilant with personal information.",
            recommended_action="You may proceed normally."
        )
        
    high_count = sum(1 for s in signals if s.severity == "high")
    medium_count = sum(1 for s in signals if s.severity == "medium")
    
    # Escalation Logic
    classification = "CAUTION"
    explanation = "This message contains potentially suspicious elements."
    recommended_action = "Please verify the sender through an official channel before taking any action."
    
    if high_count >= 1 or medium_count >= 2:
        classification = "SUSPICIOUS"
        explanation = "This message looks highly suspicious because it requests sensitive information or urgent action."
        recommended_action = "Do not click any links or share information. Contact your bank or the official organization directly."
    
    if high_count >= 2:
        classification = "NEEDS_HUMAN_HELP"
        explanation = "This message strongly resembles a severe phishing attempt or scam."
        recommended_action = "Do not interact with this message. Consider reporting it or seeking help from a trusted community member."

    # Force Uncertainty Boundary
    uncertainty = "Be careful. We cannot determine with absolute certainty if this is a scam, but it matches common suspicious patterns."

    return SafetyResult(
        classification=classification,
        signals=signals,
        explanation=explanation,
        uncertainty=uncertainty,
        recommended_action=recommended_action
    )
