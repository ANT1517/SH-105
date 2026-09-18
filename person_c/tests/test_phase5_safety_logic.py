import pytest
from app.safety.rules import normalize_text, detect_signals
from app.safety.escalation import escalate_signals

def test_normalization_basic():
    # 1. Uppercase/lowercase variations behave consistently
    assert normalize_text("KYC") == "kyc"
    assert normalize_text("kYc") == "kyc"
    # 2. Surrounding whitespace is handled
    assert normalize_text("  hello  ") == "hello"

def test_normalization_empty():
    # 3. Empty input is handled safely
    assert normalize_text("") == ""
    assert normalize_text(None) == ""

def test_normalization_long():
    # 4. Very long input does not crash
    long_str = "A" * 5000
    res = normalize_text(long_str)
    assert len(res) == 2000

def test_normalization_punctuation():
    # 5. Punctuation variations do not break core detection
    # Handled via regex \b word boundaries
    assert "kyc" in normalize_text("Your KYC, will expire!")

def test_demo_message_detection():
    # 6. Exact message: "Your KYC will expire, click to verify"
    msg = "Your KYC will expire, click to verify"
    signals = detect_signals(msg)
    
    categories = [s.category for s in signals]
    assert "urgency" in categories
    assert "link" in categories

def test_suspicious_urgent_kyc():
    # 10. Urgent KYC/account message
    msg = "Your account is suspended. Verify now."
    signals = detect_signals(msg)
    assert any(s.category == "urgency" for s in signals)

def test_suspicious_click_link():
    # 11. Click-link message
    msg = "Click here to claim your prize http://scam.com"
    signals = detect_signals(msg)
    assert any(s.category == "link" for s in signals)

def test_suspicious_otp():
    # 12. OTP request
    msg = "Share your OTP to proceed."
    signals = detect_signals(msg)
    assert any(s.category == "otp" for s in signals)

def test_suspicious_password():
    # 13. Password/PIN request
    msg = "Enter your mPIN to receive money."
    signals = detect_signals(msg)
    assert any(s.category == "credentials" for s in signals)

def test_suspicious_sensitive_info():
    # 14. Sensitive-information request
    msg = "Send your Aadhaar details."
    signals = detect_signals(msg)
    assert any(s.category == "sensitive_info" for s in signals)

def test_suspicious_payment():
    # 15. Suspicious payment request
    msg = "Pay immediately or lose your account."
    signals = detect_signals(msg)
    assert any(s.category == "payment" for s in signals)

def test_suspicious_threat():
    # 16. Threat/pressure message
    msg = "Police will arrest you if you don't pay."
    signals = detect_signals(msg)
    assert any(s.category == "threat" for s in signals)

def test_suspicious_app():
    # 17. Unexpected app/software installation request
    msg = "Install this APK for free money."
    signals = detect_signals(msg)
    assert any(s.category == "installation" for s in signals)

def test_legitimate_debit():
    # 18. Legitimate debit notification is not automatically suspicious
    msg = "Your account has been debited ₹500. Transaction completed."
    signals = detect_signals(msg)
    assert len(signals) == 0

def test_legitimate_kyc_statement():
    # Ensure benign language doesn't trigger false positives
    msg = "I need to update my KYC at my bank."
    signals = detect_signals(msg)
    # The current rule might trigger KYC urgency if "kyc" is seen without negative context,
    # let's verify it's safe. If it triggers CAUTION, that's fine but it shouldn't be SUSPICIOUS.
    res = escalate_signals(signals)
    assert res.classification in ["SAFE", "CAUTION"]

def test_legitimate_statement():
    # 19. Legitimate statement notification is not automatically suspicious
    msg = "Your monthly statement is now available."
    signals = detect_signals(msg)
    assert len(signals) == 0

def test_neutral_informational():
    # 20. Neutral informational message is handled safely
    msg = "The SHG meeting is scheduled for tomorrow at 10 AM."
    signals = detect_signals(msg)
    assert len(signals) == 0

def test_escalation_structure():
    msg = "Your KYC will expire, click to verify"
    signals = detect_signals(msg)
    result = escalate_signals(signals)
    
    # 7. The result contains an explanation
    # 8. The system does NOT state certainty that it is a scam
    # 9. Recommended action is present
    # 21. SafetyResult validates
    # 22. Classification is one of the allowed escalation categories
    # 23. Detected signals are structured
    # 24. Signal severity is structured
    # 25. Recommended action exists when appropriate
    # 26. Uncertainty is represented
    
    assert result.classification in ["SAFE", "CAUTION", "SUSPICIOUS", "NEEDS_HUMAN_HELP"]
    assert len(result.signals) > 0
    assert result.signals[0].severity in ["low", "medium", "high"]
    assert "suspicious" in result.explanation.lower()
    assert result.recommended_action != ""
    assert "We cannot determine with absolute certainty" in result.uncertainty

def test_escalation_deterministic():
    # 27. Same input produces deterministic classification
    msg = "Share your OTP"
    r1 = escalate_signals(detect_signals(msg))
    r2 = escalate_signals(detect_signals(msg))
    assert r1.classification == r2.classification

def test_escalation_multiple_signals():
    # 28. Multiple strong signals result in the appropriate stronger escalation category
    msg = "Police will arrest you if you don't share your OTP immediately"
    signals = detect_signals(msg)
    result = escalate_signals(signals)
    assert result.classification == "NEEDS_HUMAN_HELP"

def test_escalation_weak_signals():
    # 29. Weak/ambiguous signals do not automatically become a definitive fraud claim
    # 30. Insufficient confidence results in uncertainty-aware behavior
    msg = "Click this link to see the menu."
    signals = detect_signals(msg)
    result = escalate_signals(signals)
    assert result.classification == "CAUTION"
    assert "certainty" in result.uncertainty
