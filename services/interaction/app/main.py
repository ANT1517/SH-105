import json
import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException, Form, Request, Response
from twilio.twiml.messaging_response import MessagingResponse
import httpx
import os
from .media import download_twilio_media
from .transcription import transcribe_audio
from .transaction_parser import parse_transaction, normalize_text
from .person_b import forward_to_person_b
from .person_c import ask_person_c, looks_suspicious
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("interaction")

# Load environment variables robustly
current_file = Path(__file__).resolve()
service_dir = current_file.parent.parent
env_path = service_dir / ".env"
load_dotenv(dotenv_path=env_path)

# Validate and log configuration securely
has_api_key = bool(os.environ.get("TWILIO_API_KEY"))
has_api_secret = bool(os.environ.get("TWILIO_API_SECRET"))
has_account_sid = bool(os.environ.get("TWILIO_ACCOUNT_SID"))

logger.info(f"TWILIO_ACCOUNT_SID configured: {has_account_sid}")
logger.info(f"TWILIO_API_KEY configured: {has_api_key}")
logger.info(f"TWILIO_API_SECRET configured: {has_api_secret}")

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

async def route_message(normalized: dict) -> tuple[str, bool]:
    """Decide who handles a normalized message. Returns (reply_text, was_recorded_as_transaction).

    Order matters: the safety check runs FIRST. A message that trips the safety trigger goes to Person C's
    /api/v1/safety/check and is never forwarded to Person B, even if it also parses as a valid transaction
    ("paid 500 to verify your KYC now" must not be recorded as an expense). Then transactions go to Person B;
    anything else (questions) goes to Person C guidance.
    """
    if looks_suspicious(normalized["raw_text"]):
        return await ask_person_c(normalized), False
    recorded = await forward_to_person_b(normalized)
    if recorded:
        return recorded, True
    return await ask_person_c(normalized), False


@app.post("/webhooks/whatsapp")
async def webhook_whatsapp(request: Request):
    form = await request.form()
    From = form.get("From", "")
    Body = form.get("Body", "")
    MessageSid = form.get("MessageSid", "")
    NumMedia = form.get("NumMedia", "0")
    
    # Log incoming message details (excluding secrets and audio contents)
    logger.info(f"Incoming WhatsApp message - MessageSid: {MessageSid}, From: {From}, NumMedia: {NumMedia}")

    response = MessagingResponse()
    
    try:
        num_media_int = int(NumMedia)
    except ValueError:
        num_media_int = 0
        
    if num_media_int > 0:
        media_url = form.get("MediaUrl0")
        content_type = form.get("MediaContentType0", "")
        
        logger.info(f"Media details - MediaContentType0: {content_type}")
        
        if not media_url:
            response.message("I couldn't access that voice message. Please try sending it again.")
            return Response(content=str(response), media_type="application/xml")
            
        if not content_type.startswith("audio/"):
            response.message("Saathi currently supports voice messages. Please send an audio message.")
            return Response(content=str(response), media_type="application/xml")
            
        # Download and transcribe
        audio_path = None
        try:
            audio_path = download_twilio_media(media_url)
            transcript = transcribe_audio(audio_path)
            
            if not transcript:
                response.message("I couldn't hear any speech clearly. Please try again.")
                return Response(content=str(response), media_type="application/xml")
                
            # Create normalized input
            norm_text = normalize_text(transcript)
            parsed_tx = parse_transaction(norm_text)
            
            normalized = {
                "user_id": From,
                "channel": "whatsapp",
                "input_type": "voice",
                "raw_text": transcript,
                "normalized_text": norm_text,
                "parsed_transaction": parsed_tx,
                "confidence": 0.95 if parsed_tx else 0.0
            }
            logger.info(f"Normalized Input: {json.dumps(normalized)}")
            
            reply, _ = await route_message(normalized)
            response.message(f"I heard: {transcript}\n{reply}")
            
        except httpx.HTTPError:
            response.message("I couldn't download your voice message. Please try again.")
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            response.message("I couldn't understand that voice message. Please try again.")
        finally:
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)
                
        return Response(content=str(response), media_type="application/xml")

    # Phase 3 text handling
    if not Body or not Body.strip():
        response.message("Saathi received your message. Please send some text.")
    else:
        norm_text = normalize_text(Body)
        parsed_tx = parse_transaction(norm_text)
        
        normalized = {
            "user_id": From,
            "channel": "whatsapp",
            "input_type": "text",
            "raw_text": Body,
            "normalized_text": norm_text,
            "parsed_transaction": parsed_tx,
            "confidence": 0.95 if parsed_tx else 0.0
        }
        logger.info(f"Normalized Input: {json.dumps(normalized)}")
        
        reply, was_recorded = await route_message(normalized)
        response.message(f"Saathi received: {Body}\n{reply}" if was_recorded else reply)

    return Response(content=str(response), media_type="application/xml")
