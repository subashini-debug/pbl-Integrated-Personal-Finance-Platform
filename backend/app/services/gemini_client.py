"""Gemini REST client for FinTrack AI Agent."""

import os
from typing import Optional
import requests
from dotenv import load_dotenv

load_dotenv()


class GeminiUnavailable(Exception):
    """Raised when Gemini cannot be used."""
    pass


class GeminiAPIError(GeminiUnavailable):
    """Raised when Gemini returns an API or processing error."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


DEFAULT_GEMINI_KEY = "AIzaSyD0hBz5Uvr_XBRn5s4w1B7fkTk-MeRjsDY"


def _config(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _resolve_key(request_key: str | None = None) -> str | None:
    key = (request_key or "").strip()
    if key:
        return key
    return _config("GEMINI_API_KEY") or DEFAULT_GEMINI_KEY


def get_config() -> dict:
    return {
        "model": _config("GEMINI_MODEL", "gemini-3.6-flash"),
        "server_key_configured": bool(_resolve_key()),
    }


def is_configured(request_key: str | None = None) -> bool:
    return bool(_resolve_key(request_key))


def chat(
    messages: list,
    request_key: str | None = None,
    max_tokens: int = 700,
    temperature: float = 0.5,
) -> str:
    """Send FinTrack conversation context to Gemini via REST API."""
    key = _resolve_key(request_key)
    if not key:
        raise GeminiUnavailable("No Gemini API key configured.")

    model = get_config()["model"]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

    system_instruction = ""
    contents = []

    for message in messages:
        role = message.get("role", "user")
        content = str(message.get("content", ""))

        if role == "system":
            system_instruction += content + "\n\n"
            continue

        contents.append({
            "role": "model" if role == "assistant" else "user",
            "parts": [{"text": content}]
        })

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        }
    }

    if system_instruction.strip():
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction.strip()}]
        }

    try:
        resp = requests.post(url, json=payload, timeout=20)
        if resp.status_code != 200:
            raise GeminiAPIError(f"Gemini API returned status {resp.status_code}: {resp.text}", resp.status_code)
        
        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise GeminiAPIError("Gemini returned no candidates.")
        
        parts = candidates[0].get("content", {}).get("parts", [])
        text_parts = [p.get("text", "").strip() for p in parts if p.get("text")]
        result_text = "\n".join(text_parts).strip()
        
        if not result_text:
            raise GeminiAPIError("Gemini returned an empty response.")
        
        return result_text
    except Exception as e:
        if isinstance(e, GeminiUnavailable):
            raise
        raise GeminiAPIError(str(e))