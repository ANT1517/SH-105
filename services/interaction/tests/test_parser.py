import pytest
from app.transaction_parser import parse_transaction, normalize_text, extract_amount

def test_normalize_text():
    assert normalize_text("  I earned   800  \n ") == "I earned 800"

def test_extract_amount():
    cases = ["800", "₹800", "Rs 800", "Rs. 800", "800 rupees", "₹ 800"]
    for c in cases:
        assert extract_amount(c) == 800.0

def test_income_extraction():
    assert parse_transaction("I earned 800 from tailoring today") == {"type": "income", "amount": 800.0, "category": "tailoring"}
    assert parse_transaction("I got 1500 from stitching") == {"type": "income", "amount": 1500.0, "category": "stitching"}
    assert parse_transaction("₹800 from tailoring") == {"type": "income", "amount": 800.0, "category": "tailoring"}

def test_expense_extraction():
    assert parse_transaction("I spent 200 on vegetables") == {"type": "expense", "amount": 200.0, "category": "vegetables"}
    assert parse_transaction("I paid 500 for electricity") == {"type": "expense", "amount": 500.0, "category": "electricity"}

def test_saving_extraction():
    assert parse_transaction("I saved 500 today") == {"type": "saving", "amount": 500.0, "category": "saving"}

def test_commitment_extraction():
    assert parse_transaction("I paid 2000 for my chit") == {"type": "commitment", "amount": 2000.0, "category": "chit"}
    assert parse_transaction("My chit payment is 2000") == {"type": "commitment", "amount": 2000.0, "category": "chit"}

def test_business_extraction():
    assert parse_transaction("I sold 10 pickle bottles for 1000") == {"type": "business", "amount": 1000.0, "category": "pickles"}

def test_non_transactions():
    assert parse_transaction("How much should I save?") is None
    assert parse_transaction("Can I take a loan?") is None
    assert parse_transaction("I need money for school fees") is None
    assert parse_transaction("I had a good day") is None
