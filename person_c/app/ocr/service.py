from .engine import OCREngine
from .parser import OCRParser

class OCRService:
    def __init__(self, engine: OCREngine, parser: OCRParser):
        self.engine = engine
        self.parser = parser
        
    def process_receipt(self, image_bytes: bytes) -> dict:
        try:
            raw_lines = self.engine.extract_text(image_bytes)
            structured_data = self.parser.parse(raw_lines)
            return structured_data
        except Exception as e:
            # Safe fallback if OCR crashes
            return {
                "raw_text": "",
                "date": None,
                "amount": None,
                "transaction_type": None,
                "balance": None,
                "confidence": "low"
            }
