# Interaction Service

This is the Interaction Service for Dev A's workstream in the SAATHI project.

## Phase 0

In Phase 0, this service is a mock. It does not implement Twilio, Whisper, PostgreSQL, or an LLM. It simply provides the defined `/mock/normalized-input` endpoint returning a pre-defined fixture for downstream services to consume.

### Getting Started

Install dependencies:
```bash
pip install -r requirements.txt
```

Run tests:
```bash
pytest tests/
```

Run service:
```bash
uvicorn app.main:app --reload --port 8001
```

### Endpoints
- `GET /health`
- `GET /mock/normalized-input`
