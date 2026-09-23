"""Gemini client for the FinTrack AI Agent."""

import os
from typing import Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()


class GeminiUnavailable(Exception):
    """Raised when Gemini cannot be used."""


class GeminiAPIError(GeminiUnavailable):
    """Raised when Gemini returns an API or processing error."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


def _config(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _resolve_key(request_key: str | None = None) -> str | None:
    key = (request_key or "").strip()

    if key:
        return key

    return _config("GEMINI_API_KEY") or None


def get_config() -> dict:
    return {
        "model": _config("GEMINI_MODEL", "gemini-3.6-flash"),
        "server_key_configured": bool(_config("GEMINI_API_KEY")),
    }


def is_configured(request_key: str | None = None) -> bool:
    return bool(_resolve_key(request_key))


def _extract_text(response) -> str:
    """Extract only actual answer text from Gemini's response."""

    try:
        text = response.text

        if isinstance(text, str) and text.strip():
            return text.strip()
    except Exception:
        pass

    text_parts = []

    for candidate in getattr(response, "candidates", None) or []:
        content = getattr(candidate, "content", None)

        if not content:
            continue

        for part in getattr(content, "parts", None) or []:
            text = getattr(part, "text", None)

            # Gemini 3 models can return thought parts as well.
            # We only want the final answer.
            if (
                isinstance(text, str)
                and text.strip()
                and not getattr(part, "thought", False)
            ):
                text_parts.append(text.strip())

    return "\n".join(text_parts).strip()


def chat(
    messages: list,
    request_key: str | None = None,
    max_tokens: int = 700,
    temperature: float = 0.5,
) -> str:
    """Send FinTrack conversation context to Gemini."""

    key = _resolve_key(request_key)

    if not key:
        raise GeminiUnavailable(
            "No Gemini API key configured. "
            "Add GEMINI_API_KEY to the backend .env file."
        )

    try:
        client = genai.Client(api_key=key)

        system_instruction = ""
        contents = []

        for message in messages:
            role = message.get("role", "user")
            content = str(message.get("content", ""))

            if role == "system":
                system_instruction += content + "\n\n"
                continue

            contents.append(
                types.Content(
                    role="model" if role == "assistant" else "user",
                    parts=[
                        types.Part.from_text(text=content)
                    ],
                )
            )

        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            thinking_config=types.ThinkingConfig(
                thinking_level="minimal"
            ),
        )

        if system_instruction.strip():
            config.system_instruction = system_instruction.strip()

        response = client.models.generate_content(
            model=get_config()["model"],
            contents=contents,
            config=config,
        )

        text = _extract_text(response)

        if not text:
            raise GeminiAPIError(
                "Gemini returned an empty response."
            )

        return text

    except GeminiUnavailable:
        raise

    except Exception as exc:
        raise GeminiAPIError(
            f"Could not get a response from Gemini: {exc}"
        ) from exc


def test_key(api_key: str) -> dict:
    """Test a Gemini API key."""

    key = (api_key or "").strip()

    if not key:
        return {
            "ok": False,
            "message": "Enter a Gemini API key first.",
        }

    try:
        reply = chat(
            [
                {
                    "role": "user",
                    "content": "Reply with exactly: OK",
                }
            ],
            request_key=key,
            max_tokens=100,
            temperature=0,
        )

        return {
            "ok": True,
            "message": reply,
            "model": get_config()["model"],
        }

    except GeminiAPIError as exc:
        return {
            "ok": False,
            "message": str(exc),
            "status_code": exc.status_code,
            "model": get_config()["model"],
        }

    except GeminiUnavailable as exc:
        return {
            "ok": False,
            "message": str(exc),
            "model": get_config()["model"],
        }