import re
from typing import List
from app.contracts.safety import SafetySignal

def normalize_text(message: str) -> str:
    """Normalizes the text for rule matching while preserving important information."""
    if not message:
        return ""
    # Safe handling of long inputs (truncate beyond a reasonable SMS length)
    message = message[:2000]
    # Lowercase and handle surrounding whitespace
    normalized = message.strip().lower()
    # Replace multiple spaces with a single space
    normalized = re.sub(r'\s+', ' ', normalized)
    # Remove standard punctuation but keep useful parts (we can just do a very permissive lowercased search)
    return normalized

def detect_signals(message: str) -> List[SafetySignal]:
    """Applies rule-based checks on normalized text to extract safety signals."""
    normalized = normalize_text(message)
    signals = []
    
    if not normalized:
        return signals

    # 1. KYC / Account Expiry
    if re.search(r'\b(kyc|account|card)\b.*\b(expire|expired|suspended|block|blocked|verify)\b', normalized):
        signals.append(SafetySignal(
            category="urgency", 
            description="Urgent request regarding KYC or account status.", 
            severity="high"
        ))
    
    # 2. Click Link Requests
    if re.search(r'\b(click|visit|tap|go to)\b', normalized) or "http" in normalized:
        signals.append(SafetySignal(
            category="link", 
            description="Request to click a link.", 
            severity="medium"
        ))
        
    # 3. OTP Requests
    if re.search(r'\b(otp|one time password|code)\b', normalized):
        signals.append(SafetySignal(
            category="otp", 
            description="Request for OTP or verification code.", 
            severity="high"
        ))
        
    # 4. Password / PIN Requests
    if re.search(r'\b(password|pin|mpin|cvv)\b', normalized):
        signals.append(SafetySignal(
            category="credentials", 
            description="Request for password or PIN.", 
            severity="high"
        ))
        
    # 5. Sensitive Information
    if re.search(r'\b(aadhaar|pan|bank details|credit card)\b', normalized):
        signals.append(SafetySignal(
            category="sensitive_info", 
            description="Request for sensitive personal or banking information.", 
            severity="medium"
        ))
        
    # 6. Suspicious Payment Requests
    if re.search(r'\b(pay|send money|transfer)\b.*\b(immediately|urgent|now)\b', normalized):
        signals.append(SafetySignal(
            category="payment", 
            description="Urgent payment request.", 
            severity="high"
        ))
        
    # 7. Threat or Pressure
    if re.search(r'\b(police|arrest|fine|penalty|court)\b', normalized):
        signals.append(SafetySignal(
            category="threat", 
            description="Threatening language or pressure tactics.", 
            severity="high"
        ))
        
    # 8. App/Software Installation
    if re.search(r'\b(install|download|app|apk)\b', normalized):
        signals.append(SafetySignal(
            category="installation", 
            description="Request to install software or an app.", 
            severity="medium"
        ))

    return signals
