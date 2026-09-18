import json
from pathlib import Path
import pytest
from jsonschema import Draft202012Validator, ValidationError

def get_repo_root() -> Path:
    # Current file is in services/interaction/tests/test_contract.py
    # Root is three levels up
    return Path(__file__).resolve().parent.parent.parent.parent

@pytest.fixture
def schema():
    schema_path = get_repo_root() / "contracts" / "normalized-input.schema.json"
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)

@pytest.fixture
def income_voice_fixture():
    fixture_path = get_repo_root() / "contracts" / "examples" / "income-voice.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        return json.load(f)

def test_income_voice_matches_schema(schema, income_voice_fixture):
    validator = Draft202012Validator(schema)
    try:
        validator.validate(income_voice_fixture)
    except ValidationError as e:
        pytest.fail(f"Fixture failed validation: {e.message}")
