import whisper
import warnings

# Suppress FP16 warning on CPU
warnings.filterwarnings("ignore", message="FP16 is not supported on CPU; using FP32 instead")

# Load tiny model once at module level to avoid reloading on each request
_model = None

def get_model():
    global _model
    if _model is None:
        _model = whisper.load_model("tiny")
    return _model

def transcribe_audio(audio_path: str) -> str:
    model = get_model()
    result = model.transcribe(audio_path)
    return result["text"].strip()
