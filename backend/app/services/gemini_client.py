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


def _config(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _resolve_key(request_key: str | None = None) -> str | None:
    key = (request_key or "").strip()
    if key and (key.startswith("AQ") or key.startswith("AIza") or len(key) > 20) and not key.startswith("xai-"):
        return key
    return os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GROK_API_KEY", "").strip()


def get_config() -> dict:
    return {
        "model": _config("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        "server_key_configured": bool(_resolve_key()),
    }


def is_configured(request_key: str | None = None) -> bool:
    return bool(_resolve_key(request_key))


def chat(
    messages: list,
    request_key: str | None = None,
    max_tokens: int = 1500,
    temperature: float = 0.5,
) -> str:
    """Send FinTrack conversation context to Gemini via REST API."""
    key = _resolve_key(request_key)
    if not key:
        raise GeminiUnavailable("No Gemini API key configured.")

    models_to_try = [get_config()["model"], "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash"]
    last_error = None

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

    for model in dict.fromkeys(models_to_try):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        try:
            resp = requests.post(url, json=payload, timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    text_parts = [p.get("text", "").strip() for p in parts if p.get("text")]
                    result_text = "\n".join(text_parts).strip()
                    if result_text:
                        return result_text
            last_error = f"Gemini API ({model}) status {resp.status_code}: {resp.text}"
        except Exception as e:
            last_error = str(e)

    raise GeminiAPIError(last_error or "Gemini API unavailable")


def test_key(api_key: str) -> dict:
    try:
        chat([{"role": "user", "content": "Hi"}], request_key=api_key, max_tokens=300)
        return {"ok": True, "message": "Connection successful! Gemini API key is valid."}
    except Exception as e:
        return {"ok": False, "message": str(e)}