import json
from pathlib import Path
from fastapi import FastAPI, HTTPException

app = FastAPI(title="Interaction Service (Phase 0 Mock)")

def get_fixture_path() -> Path:
    # Resolve the path relative to the root of the repo
    # Current file is in services/interaction/app/main.py
    # Root is three levels up
    current_file = Path(__file__).resolve()
    repo_root = current_file.parent.parent.parent.parent
    fixture_path = repo_root / "contracts" / "examples" / "income-voice.json"
    return fixture_path

@app.get("/health")
def health_check():
    return {
        "service": "interaction",
        "status": "ok"
    }

@app.get("/mock/normalized-input")
def get_normalized_input():
    fixture_path = get_fixture_path()
    try:
        with open(fixture_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail=f"Fixture not found at {fixture_path}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Fixture contains invalid JSON")
