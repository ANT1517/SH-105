"""
Centralized backend localization for Person C.

LANGUAGE_INSTRUCTIONS  – injected into every LLM system prompt to control output language.
FALLBACK_MESSAGES      – used for deterministic fallback strings (no LLM involved).

The canonical language field accepted everywhere is `language: Literal["en","te","hi","kn"]`.
Default is always "en" for backward compatibility.
"""
from typing import Literal

SupportedLanguage = Literal["en", "te", "hi", "kn"]

# ─── LLM language directives ─────────────────────────────────────────────────
# Injected at the TOP of every system prompt so the model is never left to guess.
LANGUAGE_INSTRUCTIONS: dict[str, str] = {
    "en": "Respond entirely in English.",
    "te": "Respond entirely in Telugu (తెలుగు). Use Telugu script for all explanations, labels, and sentences. Keep numeric values and currency symbols (₹) unchanged.",
    "hi": "Respond entirely in Hindi (हिन्दी). Use Devanagari script for all explanations, labels, and sentences. Keep numeric values and currency symbols (₹) unchanged.",
    "kn": "Respond entirely in Kannada (ಕನ್ನಡ). Use Kannada script for all explanations, labels, and sentences. Keep numeric values and currency symbols (₹) unchanged.",
}

def get_language_instruction(language: str) -> str:
    """Return the LLM language directive for the given language code."""
    return LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["en"])


# ─── Deterministic fallback messages ─────────────────────────────────────────
# Used when the LLM call fails or returns empty output, and in API-level fallbacks
# in main.py (unknown user, Person B down, goal missing, etc.).
FALLBACK_MESSAGES: dict[str, dict[str, str]] = {
    "en": {
        "cannot_process":       "Sorry, I am currently unable to process your request.",
        "error_response":       "Sorry, I encountered an error generating a response.",
        "no_financial_info":    "We are currently unable to access your financial information. Please try again later.",
        "goal_missing":         "Goal information is missing from your financial state.",
        "no_account":           "We couldn't find a Saathi account for you yet, so we can't give personalised guidance. Please check with support or record a first transaction to get started.",
        "safety_error":         "We encountered an issue processing your safety check.",
        "safety_empty":         "Error generating safety explanation.",
        "sim_cannot_process":   "Sorry, I am currently unable to process your simulation request.",
        "sim_error":            "Sorry, I encountered an error explaining the simulation.",
    },
    "te": {
        "cannot_process":       "క్షమించండి, ప్రస్తుతం మీ అభ్యర్థనను ప్రాసెస్ చేయలేకపోతున్నాను.",
        "error_response":       "క్షమించండి, సమాధానం రూపొందించడంలో లోపం ఏర్పడింది.",
        "no_financial_info":    "ప్రస్తుతం మీ ఆర్థిక సమాచారాన్ని యాక్సెస్ చేయలేకపోతున్నాము. దయచేసి మళ్ళీ ప్రయత్నించండి.",
        "goal_missing":         "మీ ఆర్థిక స్థితిలో లక్ష్య సమాచారం అందుబాటులో లేదు.",
        "no_account":           "మీ సాథీ ఖాతాను ఇంకా కనుగొనలేకపోయాము, కాబట్టి వ్యక్తిగతమైన మార్గదర్శకత్వం ఇవ్వలేకపోతున్నాము. సపోర్ట్‌ తో సంప్రదించండి లేదా మొదటి లావాదేవీ నమోదు చేయండి.",
        "safety_error":         "మీ భద్రతా తనిఖీని ప్రాసెస్ చేయడంలో సమస్య ఏర్పడింది.",
        "safety_empty":         "భద్రతా వివరణ రూపొందించడంలో లోపం.",
        "sim_cannot_process":   "క్షమించండి, ప్రస్తుతం మీ సిమ్యులేషన్ అభ్యర్థనను ప్రాసెస్ చేయలేకపోతున్నాను.",
        "sim_error":            "క్షమించండి, సిమ్యులేషన్ వివరించడంలో లోపం ఏర్పడింది.",
    },
    "hi": {
        "cannot_process":       "क्षमा करें, अभी आपके अनुरोध को संसाधित करने में असमर्थ हूँ।",
        "error_response":       "क्षमा करें, उत्तर बनाने में एक त्रुटि हुई।",
        "no_financial_info":    "अभी आपकी वित्तीय जानकारी तक पहुँचने में असमर्थ हैं। कृपया बाद में पुनः प्रयास करें।",
        "goal_missing":         "आपकी वित्तीय स्थिति में लक्ष्य की जानकारी उपलब्ध नहीं है।",
        "no_account":           "अभी तक आपका साथी खाता नहीं मिला, इसलिए व्यक्तिगत मार्गदर्शन नहीं दे सकते। सहायता से संपर्क करें या पहला लेन-देन दर्ज करें।",
        "safety_error":         "आपकी सुरक्षा जाँच संसाधित करने में समस्या हुई।",
        "safety_empty":         "सुरक्षा स्पष्टीकरण बनाने में त्रुटि।",
        "sim_cannot_process":   "क्षमा करें, अभी आपके सिमुलेशन अनुरोध को संसाधित करने में असमर्थ हूँ।",
        "sim_error":            "क्षमा करें, सिमुलेशन समझाने में एक त्रुटि हुई।",
    },
    "kn": {
        "cannot_process":       "ಕ್ಷಮಿಸಿ, ಪ್ರಸ್ತುತ ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ.",
        "error_response":       "ಕ್ಷಮಿಸಿ, ಪ್ರತಿಕ್ರಿಯೆ ರಚಿಸುವಲ್ಲಿ ದೋಷ ಉಂಟಾಯಿತು.",
        "no_financial_info":    "ಪ್ರಸ್ತುತ ನಿಮ್ಮ ಆರ್ಥಿಕ ಮಾಹಿತಿಯನ್ನು ಪ್ರವೇಶಿಸಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
        "goal_missing":         "ನಿಮ್ಮ ಆರ್ಥಿಕ ಸ್ಥಿತಿಯಲ್ಲಿ ಗುರಿಯ ಮಾಹಿತಿ ಇಲ್ಲ.",
        "no_account":           "ಇನ್ನೂ ನಿಮ್ಮ ಸಾಥಿ ಖಾತೆ ಸಿಗಲಿಲ್ಲ, ಆದ್ದರಿಂದ ವೈಯಕ್ತಿಕ ಮಾರ್ಗದರ್ಶನ ನೀಡಲಾಗುವುದಿಲ್ಲ. ಬೆಂಬಲದೊಂದಿಗೆ ಸಂಪರ್ಕಿಸಿ ಅಥವಾ ಮೊದಲ ವ್ಯವಹಾರ ದಾಖಲಿಸಿ.",
        "safety_error":         "ನಿಮ್ಮ ಸುರಕ್ಷತೆ ತಪಾಸಣೆ ಪ್ರಕ್ರಿಯೆಗೊಳಿಸುವಲ್ಲಿ ಸಮಸ್ಯೆ ಉಂಟಾಯಿತು.",
        "safety_empty":         "ಸುರಕ್ಷತೆ ವಿವರಣೆ ರಚಿಸುವಲ್ಲಿ ದೋಷ.",
        "sim_cannot_process":   "ಕ್ಷಮಿಸಿ, ಪ್ರಸ್ತುತ ನಿಮ್ಮ ಸಿಮ್ಯುಲೇಷನ್ ವಿನಂತಿಯನ್ನು ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ.",
        "sim_error":            "ಕ್ಷಮಿಸಿ, ಸಿಮ್ಯುಲೇಷನ್ ವಿವರಿಸುವಲ್ಲಿ ದೋಷ ಉಂಟಾಯಿತು.",
    },
}

def get_fallback(language: str, key: str) -> str:
    """Return a localized fallback message; defaults to English if language/key not found."""
    lang_messages = FALLBACK_MESSAGES.get(language, FALLBACK_MESSAGES["en"])
    return lang_messages.get(key, FALLBACK_MESSAGES["en"].get(key, "An error occurred."))
