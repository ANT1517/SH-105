# Interaction Service

This is the Interaction Service for Dev A's workstream in the SAATHI project.

## Phase 2

In Phase 2, we implement Voice STT with Whisper:
- Incoming Twilio WhatsApp messages are checked for media (`NumMedia` > 0).
- If an audio message is detected (`MediaUrl0`, `MediaContentType0`), the audio is safely downloaded to a temporary file.
- The `openai-whisper` library (using the `tiny` model) is used to transcribe the audio locally.
- A Normalized Input object is generated, mapped as `input_type="voice"`, preserving the transcript as `raw_text` and `normalized_text`.
- The temporary audio file is deleted immediately.
- The user is replied to with "I heard: <transcript>".

### Expected Environment Variables (Optional)
If your Twilio webhook media URLs require authentication, create a `.env` file from the `.env.example`:

1. Copy `.env.example` to `.env`
2. Add your Twilio credentials to the `.env` file:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_API_KEY`
   - `TWILIO_API_SECRET`
3. Never commit the `.env` file to version control.
4. The application automatically loads `.env` locally using `python-dotenv`.

### Getting Started

Install dependencies (ensure `ffmpeg` is installed on your system for Whisper):
```bash
pip install -r requirements.txt
```

Run tests:
```bash
python -m pytest -q
```

Run service:
```bash
uvicorn app.main:app --reload --port 8001
```

### Endpoints

- `GET /health`
- `GET /mock/normalized-input`
- `POST /webhooks/whatsapp`

### Local Testing (ngrok)

To test Twilio webhooks locally:
1. Start your local server (`uvicorn app.main:app --reload --port 8001`)
2. Start ngrok on the same port: `ngrok http 8001`
3. Configure your Twilio WhatsApp Sandbox webhook URL to point to `https://<ngrok-id>.ngrok-free.app/webhooks/whatsapp` (ensure POST is selected).
4. Send an audio voice note to your sandbox number to see it transcribed.
