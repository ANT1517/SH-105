import httpx
import tempfile
import os
import uuid

def download_twilio_media(media_url: str) -> str:
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    api_key = os.environ.get("TWILIO_API_KEY")
    api_secret = os.environ.get("TWILIO_API_SECRET")
    
    if not api_key or not api_secret:
        raise ValueError("Missing TWILIO_API_KEY or TWILIO_API_SECRET for media download authentication.")
    
    auth = (api_key, api_secret)
    
    temp_dir = tempfile.gettempdir()
    file_path = os.path.join(temp_dir, f"twilio_media_{uuid.uuid4().hex}.ogg")
    
    with httpx.stream("GET", media_url, auth=auth, follow_redirects=True, timeout=30.0) as response:
        response.raise_for_status()
        with open(file_path, "wb") as f:
            for chunk in response.iter_bytes():
                f.write(chunk)
                
    return file_path
