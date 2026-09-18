import pytest
from app.ocr.parser import OCRParser
from app.ocr.engine import MockOCREngine
from app.ocr.service import OCRService

@pytest.fixture
def parser():
    return OCRParser()

def test_ocr_parser_expense(parser):
    # Expense test
    raw = [
        "ABC STORE",
        "18/09/2026",
        "TOTAL ₹600"
    ]
    result = parser.parse(raw)
    assert result["date"] == "2026-09-18"
    assert result["amount"] == 600.0
    assert result["transaction_type"] == "expense"
    assert result["balance"] is None
    assert result["confidence"] == "high"

def test_ocr_parser_income(parser):
    # Income/sale test
    raw = [
        "PICKLE SALES",
        "18-09-2026",
        "AMOUNT RECEIVED ₹1000"
    ]
    result = parser.parse(raw)
    assert result["date"] == "2026-09-18"
    assert result["amount"] == 1000.0
    assert result["transaction_type"] == "income"
    assert result["balance"] is None
    assert result["confidence"] == "high"

def test_ocr_parser_ambiguous_or_noise(parser):
    # Ambiguous - Phone numbers and GST should not be picked up if not labelled
    raw = [
        "XYZ TRADERS",
        "PH: 9876543210",
        "GSTIN: 22AAAAA0000A1Z5",
        "2026-09-18"
    ]
    result = parser.parse(raw)
    assert result["date"] == "2026-09-18"
    assert result["amount"] is None
    assert result["transaction_type"] is None
    assert result["balance"] is None
    assert result["confidence"] == "low"

def test_ocr_parser_balance_extraction(parser):
    raw = [
        "SUPPLIER CO",
        "18/09/26",
        "ITEMS 400",
        "PAID Rs. 200",
        "BALANCE Rs. 200"
    ]
    result = parser.parse(raw)
    assert result["date"] == "2026-09-18"
    # Prioritizes PAID over BALANCE for transaction amount?
    # Actually the parser label_pattern includes PAID
    assert result["amount"] == 200.0
    assert result["transaction_type"] == "expense"
    assert result["balance"] == 200.0

def test_ocr_service_integration():
    engine = MockOCREngine(mock_text=["STORE", "TOTAL 500", "18/09/2026"])
    parser = OCRParser()
    service = OCRService(engine, parser)
    
    result = service.process_receipt(b"fake_image_bytes")
    assert result["amount"] == 500.0
    assert result["date"] == "2026-09-18"
    assert result["transaction_type"] == "expense"

def test_ocr_service_handles_engine_failure():
    class FailingEngine:
        def extract_text(self, b):
            raise Exception("OCR Failed")
            
    service = OCRService(FailingEngine(), OCRParser())
    result = service.process_receipt(b"fail")
    assert result["amount"] is None
    assert result["confidence"] == "low"
    assert result["raw_text"] == ""

from fastapi.testclient import TestClient
from app.api.main import app
import io

client = TestClient(app)

def test_api_ocr_valid_upload():
    # Mocking file upload
    file_content = b"fake image"
    response = client.post(
        "/api/v1/ocr/receipt", 
        files={"file": ("receipt.jpg", io.BytesIO(file_content), "image/jpeg")}
    )
    assert response.status_code == 200
    data = response.json()
    assert "amount" in data
    assert "date" in data
    assert "transaction_type" in data

def test_api_ocr_missing_file():
    response = client.post("/api/v1/ocr/receipt")
    assert response.status_code == 422 # FastAPI validation for missing file

def test_api_ocr_unsupported_format():
    file_content = b"fake pdf"
    response = client.post(
        "/api/v1/ocr/receipt", 
        files={"file": ("receipt.pdf", io.BytesIO(file_content), "application/pdf")}
    )
    assert response.status_code == 400
    assert "JPEG and PNG" in response.json()["detail"]
