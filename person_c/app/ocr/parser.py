import re
from typing import List, Optional

class OCRParser:
    def parse(self, raw_lines: List[str]) -> dict:
        combined_text = "\n".join(raw_lines)
        
        date = self._extract_date(combined_text)
        amount = self._extract_amount(combined_text)
        txn_type = self._extract_type(combined_text)
        balance = self._extract_balance(combined_text)
        
        confidence = self._calculate_confidence(date, amount, txn_type)
        
        return {
            "raw_text": combined_text,
            "date": date,
            "amount": amount,
            "transaction_type": txn_type,
            "balance": balance,
            "confidence": confidence
        }
        
    def _extract_date(self, text: str) -> Optional[str]:
        # Format 1: YYYY-MM-DD
        match1 = re.search(r'(\d{4})[-/](\d{2})[-/](\d{2})', text)
        if match1:
            return f"{match1.group(1)}-{match1.group(2)}-{match1.group(3)}"
            
        # Format 2: DD/MM/YYYY or DD-MM-YYYY
        match2 = re.search(r'(\d{2})[-/](\d{2})[-/](\d{4})', text)
        if match2:
            return f"{match2.group(3)}-{match2.group(2)}-{match2.group(1)}"
            
        # Format 3: DD/MM/YY
        match3 = re.search(r'(\d{2})[-/](\d{2})[-/](\d{2})\b', text)
        if match3:
            year = "20" + match3.group(3)
            return f"{year}-{match3.group(2)}-{match3.group(1)}"
            
        return None
        
    def _extract_amount(self, text: str) -> Optional[float]:
        # Structural labels take precedence
        label_pattern = r'(GRAND\s*TOTAL|NET\s*TOTAL|TOTAL|AMOUNT\s*PAYABLE|AMOUNT\s*RECEIVED|PAID)\s*(?:Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)'
        match = re.search(label_pattern, text, re.IGNORECASE)
        if match:
            return self._clean_amount(match.group(2))
            
        # Fallback to general currency symbols
        sym_pattern = r'(?:Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)'
        match = re.search(sym_pattern, text, re.IGNORECASE)
        if match:
            return self._clean_amount(match.group(1))
            
        return None
        
    def _clean_amount(self, val_str: str) -> Optional[float]:
        try:
            return float(val_str.replace(",", ""))
        except ValueError:
            return None
            
    def _extract_type(self, text: str) -> Optional[str]:
        text_upper = text.upper()
        # Income cues
        if "SALE" in text_upper or "RECEIVED" in text_upper or "AMOUNT RECEIVED" in text_upper:
            return "income"
            
        # Expense cues
        if "PURCHASE" in text_upper or "ITEMS" in text_upper or "TOTAL" in text_upper or "PAID" in text_upper or "BOUGHT" in text_upper:
            return "expense"
            
        return None
        
    def _extract_balance(self, text: str) -> Optional[float]:
        # Only extract balance if explicitly labeled
        match = re.search(r'(BALANCE|OUTSTANDING)\s*(?:Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)', text, re.IGNORECASE)
        if match:
            return self._clean_amount(match.group(2))
        return None
        
    def _calculate_confidence(self, date, amount, txn_type) -> str:
        score = 0
        if date is not None: score += 1
        if amount is not None: score += 1
        if txn_type is not None: score += 1
        
        if score == 3: return "high"
        if score == 2: return "medium"
        return "low"
