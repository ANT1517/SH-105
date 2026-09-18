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

# NOTE: services/interaction/app/person_c.py keeps a mirrored copy of these patterns (Dev-A routes
# messages that trip them to /api/v1/safety/check). Keep each rule a single re.search call with a raw-string
# pattern and no single quotes inside it (rule 2 also has the "http" check) so the drift test can extract
# them, and update that copy too.
#
# Rules are context-aware: a scam-associated word alone is not enough for the broad-sounding words
# (fine, app, code, pin, pay...now, go to, credit card, ...). KYC / verify / click / OTP / arrest stay broad.

def detect_signals(message: str) -> List[SafetySignal]:
    """Applies rule-based checks on normalized text to extract safety signals."""
    normalized = normalize_text(message)
    signals = []

    if not normalized:
        return signals

    # 1. KYC / Account Expiry (also the reversed order "verify/update your KYC", tied to "your" so that
    #    questions like "how do I verify my KYC?" are not flagged)
    if re.search(r'\b(kyc|account|card)\b.*\b(expire|expired|suspended|block|blocked|verify)\b|\b(verify|update|renew|complete)\b.{0,15}\byour\b.{0,10}\b(kyc|account|card)\b', normalized):
        signals.append(SafetySignal(
            category="urgency",
            description="Urgent request regarding KYC or account status.",
            severity="high"
        ))

    # 2. Click Link Requests ("click" and URLs stay broad; tap/visit/go to need a link context)
    if re.search(r'\bclick\b|\b(tap|visit|go to)\b.*\b(link|url|website|site|here|below)\b|\bwww\.', normalized) or "http" in normalized:
        signals.append(SafetySignal(
            category="link",
            description="Request to click a link.",
            severity="medium"
        ))

    # 3. OTP Requests (OTP stays broad; a bare "code" is not enough)
    if re.search(r'\b(otp|one time password)\b|\b(verification|security|confirmation|secret|login|authentication) code\b|\bcode\b.*\b(received|sent to your)\b', normalized):
        signals.append(SafetySignal(
            category="otp",
            description="Request for OTP or verification code.",
            severity="high"
        ))

    # 4. Password / PIN Requests (needs a request for YOUR credential, not a question about PINs)
    if re.search(r'\b(share|send|enter|provide|reveal|give|tell)\b.{0,15}\byour\b.{0,15}\b(password|pin|mpin|cvv)\b|\b(password|pin|mpin|cvv)\b.{0,40}\b(required|needed|to verify|to confirm|to activate|to unlock)\b', normalized):
        signals.append(SafetySignal(
            category="credentials",
            description="Request for password or PIN.",
            severity="high"
        ))

    # 5. Sensitive Information (needs a request for YOUR details, not a question about Aadhaar/credit cards)
    if re.search(r'\b(share|send|give|provide|submit|update|upload|forward)\b.{0,20}\byour\b.*\b(aadhaar|aadhar|pan|bank details|credit card|card details|card number|account number)\b', normalized):
        signals.append(SafetySignal(
            category="sensitive_info",
            description="Request for sensitive personal or banking information.",
            severity="medium"
        ))

    # 6. Suspicious Payment Requests (needs urgency language, in either order; bare "pay ... now" is not enough)
    if re.search(r'\b(pay|send money|transfer)\b.*\b(immediately|urgent|urgently|asap|within \d+ ?(hours?|hrs?|minutes?|mins?|days?)|last chance|final notice)\b|\b(immediately|urgent|urgently|asap|within \d+ ?(hours?|hrs?|minutes?|mins?|days?)|last chance|final notice)\b.*\b(pay|send money|transfer)\b|\b(pay|transfer)\b\s+(rs\.?|inr|₹)?\s*\d[\d,]*\s+now\b', normalized):
        signals.append(SafetySignal(
            category="payment",
            description="Urgent payment request.",
            severity="high"
        ))

    # 7. Threat or Pressure (arrest stays broad; fine/penalty need a violation context; police/court need a case context)
    if re.search(r'\b(arrest|arrested|warrant|prosecution)\b|\b(legal action|police case|court case|police complaint)\b.{0,30}\b(against you|will be (filed|taken|registered|initiated)|has been (filed|registered)|avoid)\b|\bavoid\b.{0,15}\b(legal action|police)\b|\bcourt (notice|summons)\b|\b(fine|penalty)\b.*\b(imposed|levied|violation|violated|illegal|unlawful|breach)\b|\b(imposed|levied|violation|violated|illegal|unlawful|breach)\b.*\b(fine|penalty)\b', normalized):
        signals.append(SafetySignal(
            category="threat",
            description="Threatening language or pressure tactics.",
            severity="high"
        ))

    # 8. App/Software Installation ("app" only next to install/download; remote-access tools and APKs stay broad)
    if re.search(r'\bapk\b|\b(anydesk|teamviewer|quicksupport)\b|\bremote (access|control)\b|\b(install|download)\b.{0,30}\b(app|application|software|file|attachment|link)\b|\b(app|application|software)\b.{0,30}\b(install|download)\b', normalized):
        signals.append(SafetySignal(
            category="installation",
            description="Request to install software or an app.",
            severity="medium"
        ))

    return signals
