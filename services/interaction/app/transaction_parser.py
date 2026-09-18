import re

def normalize_text(raw_text: str) -> str:
    """Deterministic normalization of user input."""
    # Trim and normalize whitespace
    clean = re.sub(r'\s+', ' ', raw_text.strip())
    return clean

def extract_amount(text: str) -> float | None:
    """Extract numeric amount safely from common formats."""
    # First, look for explicit currency markers
    currency_pattern = r'(?:₹|rs\.?)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:rupees)'
    currency_matches = re.findall(currency_pattern, text, re.IGNORECASE)
    for m in currency_matches:
        val = m[0] or m[1]
        if val:
            return float(val)
            
    # If no explicit currency, find all numbers and return the maximum
    general_pattern = r'\b(\d+(?:\.\d+)?)\b'
    all_numbers = re.findall(general_pattern, text)
    if all_numbers:
        return max([float(n) for n in all_numbers])
        
    return None

def determine_type_and_category(text: str):
    """Determine transaction type and category from normalized text deterministically."""
    text_lower = text.lower()
    
    # Non-transaction inputs
    non_tx_keywords = ["how much", "can i", "should i", "need money", "good day", "what is"]
    if "?" in text or any(k in text_lower for k in non_tx_keywords):
        return None, None
        
    # Business
    if "sold" in text_lower:
        cat = "pickles" if "pickle" in text_lower else "business"
        return "business", cat
        
    # Commitment
    if "chit" in text_lower:
        return "commitment", "chit"
        
    # Saving
    if "saved" in text_lower or "save" in text_lower:
        return "saving", "saving"
        
    # Income
    if "earned" in text_lower or "got" in text_lower or ("from" in text_lower and "tailoring" in text_lower) or ("from" in text_lower and "stitching" in text_lower):
        cat = "income"
        if "tailoring" in text_lower: cat = "tailoring"
        elif "stitching" in text_lower: cat = "stitching"
        return "income", cat
        
    # Expense
    if "spent" in text_lower or "paid" in text_lower:
        cat = "expense"
        if "vegetables" in text_lower: cat = "vegetables"
        elif "electricity" in text_lower: cat = "electricity"
        return "expense", cat
        
    return None, None

def parse_transaction(normalized_text: str) -> dict | None:
    """Parse transaction returning structured dictionary if confident, else None."""
    amount = extract_amount(normalized_text)
    t_type, category = determine_type_and_category(normalized_text)
    
    if amount is not None and t_type is not None and category is not None:
        return {
            "type": t_type,
            "amount": amount,
            "category": category
        }
    return None
