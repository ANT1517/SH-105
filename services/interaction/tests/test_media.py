import pytest
import os
from unittest.mock import patch, MagicMock
from app.media import download_twilio_media

@patch("app.media.httpx.stream")
def test_download_twilio_media_success(mock_stream):
    # Mock environment variables
    with patch.dict(os.environ, {"TWILIO_API_KEY": "test_key", "TWILIO_API_SECRET": "test_secret"}):
        mock_response = MagicMock()
        mock_response.iter_bytes.return_value = [b"chunk1", b"chunk2"]
        # Make the mock stream context manager return the mock response
        mock_stream.return_value.__enter__.return_value = mock_response
        
        file_path = download_twilio_media("http://example.com/media")
        
        # Verify httpx.stream was called with correct auth
        mock_stream.assert_called_once_with(
            "GET", 
            "http://example.com/media", 
            auth=("test_key", "test_secret"), 
            follow_redirects=True, 
            timeout=30.0
        )
        
        # Verify file creation
        assert os.path.exists(file_path)
        with open(file_path, "rb") as f:
            assert f.read() == b"chunk1chunk2"
            
        os.remove(file_path)

def test_download_twilio_media_missing_credentials():
    with patch.dict(os.environ, clear=True):
        with pytest.raises(ValueError, match="Missing TWILIO_API_KEY or TWILIO_API_SECRET"):
            download_twilio_media("http://example.com/media")
