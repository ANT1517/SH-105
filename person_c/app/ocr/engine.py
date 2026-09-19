import os
from typing import List
import tempfile

class OCREngine:
    def extract_text(self, image_bytes: bytes) -> List[str]:
        raise NotImplementedError

class MockOCREngine(OCREngine):
    def __init__(self, mock_text: List[str] = None):
        self.mock_text = mock_text or []
        
    def extract_text(self, image_bytes: bytes) -> List[str]:
        return self.mock_text

class PaddleOCREngine(OCREngine):
    def __init__(self):
        # Loaded on the first scan, so the service starts (and every other endpoint works) without paddleocr.
        self._ocr = None

    @property
    def ocr(self):
        if self._ocr is None:
            os.environ.setdefault("FLAGS_enable_pir_api", "0")
            from paddleocr import PaddleOCR
            self._ocr = PaddleOCR(lang="en", enable_mkldnn=False)
        return self._ocr

    def extract_text(self, image_bytes: bytes) -> List[str]:
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
                tmp.write(image_bytes)
                tmp_path = tmp.name
                
            # Use predict instead of ocr to avoid deprecation and get standard dict output in 3.7+
            result = self.ocr.predict(tmp_path)
            
            texts = []
            if result:
                # Handle PaddleOCR 3.7+ output (list of dicts)
                if isinstance(result[0], dict) and 'rec_texts' in result[0]:
                    texts.extend(result[0]['rec_texts'])
                # Handle legacy v2 output
                elif isinstance(result[0], list):
                    for line in result[0]:
                        if isinstance(line, (list, tuple)) and len(line) > 1:
                            text_tuple = line[1]
                            texts.append(text_tuple[0])
                    
            return texts
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
