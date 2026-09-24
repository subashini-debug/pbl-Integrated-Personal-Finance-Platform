"""
Thin wrapper around the Google Gemini `generateContent` REST API.

Mirrors grok_client.py's contract exactly (same is_configured()/chat()
shape, same key-resolution order) so agent.py and lesson_engine.py can
treat Grok and Gemini as interchangeable providers. No key is ever
committed to the repo. Resolution order per request:
1. An `X-Gemini-Key` header sent by the frontend (user pasted their own
   key in Settings -- stored only in their browser, never on the server
   disk).
2. The server-wide GEMINI_API_KEY environment variable, if the operator
   set one in their local, git-ignored `.env` file.
3. Neither present (or the value is an obvious placeholder) -> caller
   should use the rules-based fallback instead; this client raises
   GeminiUnavailable so callers can catch it cleanly.

Note: `backend/.env` is only picked up if something calls load_dotenv()
before this module is first imported (see app/main.py) -- otherwise
GEMINI_API_KEY here always reads as unset even if it's in the file.
"""
import os
import requests

GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

# Empty string, not a placeholder -- an unset key must be falsy. (A truthy
# placeholder default was a real bug in the Grok client this mirrors: it
# made the app think a server key existed when none had actually been set.)
SERVER_DEFAULT_KEY = os.getenv("GEMINI_API_KEY", "")

_PLACEHOLDER_VALUES = {"", "your_gemini_api_key_here", "changeme"}


class GeminiUnavailable(Exception):
    pass


def _resolve_key(request_key: str | None) -> str | None:
    for candidate in (request_key, SERVER_DEFAULT_KEY):
        if candidate and candidate.strip().lower() not in _PLACEHOLDER_VALUES:
            return candidate.strip()
    return None


def is_configured(request_key: str | None = None) -> bool:
    return bool(_resolve_key(request_key))


def _to_gemini_contents(messages: list) -> tuple[str | None, list]:
    """
    Gemini's REST API doesn't take an OpenAI-style flat `messages` list --
    system text is a separate `systemInstruction` field, and turns are
    `{"role": "user"|"model", "parts": [{"text": ...}]}`. Converting here
    (rather than pushing this shape onto every caller) is what lets
    agent.py and lesson_engine.py send the exact same `messages` list to
    either grok_client.chat() or gemini_client.chat().
    """
    system_text = None
    contents = []
    for m in messages:
        role = m.get("role")
        content = m.get("content", "")
        if role == "system":
            system_text = f"{system_text}\n\n{content}" if system_text else content
            continue
        contents.append({"role": "model" if role == "assistant" else "user", "parts": [{"text": content}]})
    return system_text, contents


def chat(messages: list, request_key: str | None = None, max_tokens: int = 400,
         temperature: float = 0.6) -> str:
    key = _resolve_key(request_key)
    if not key:
        raise GeminiUnavailable("No Gemini API key configured (header or server env).")

    system_text, contents = _to_gemini_contents(messages)
    if not contents:
        raise GeminiUnavailable("No user/assistant content to send to Gemini.")

    body = {
        "contents": contents,
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": temperature},
    }
    if system_text:
        body["systemInstruction"] = {"parts": [{"text": system_text}]}

    resp = requests.post(
        f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent",
        params={"key": key},
        json=body,
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()

    candidates = data.get("candidates") or []
    if not candidates:
        # e.g. blocked by a safety filter -- promptFeedback carries the reason
        reason = (data.get("promptFeedback") or {}).get("blockReason", "no candidates returned")
        raise GeminiUnavailable(f"Gemini returned nothing usable ({reason}).")

    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        raise GeminiUnavailable("Gemini returned an empty response.")
    return text


def test_key(api_key: str) -> dict:
    try:
        reply = chat(
            [{"role": "user", "content": "Reply with exactly: OK"}],
            request_key=api_key,
            max_tokens=10,
            temperature=0,
        )
        return {"ok": True, "message": reply}
    except requests.HTTPError as e:
        return {"ok": False, "message": f"Gemini API rejected the key ({e.response.status_code})."}
    except GeminiUnavailable as e:
        return {"ok": False, "message": str(e)}
    except Exception as e:
        return {"ok": False, "message": f"Could not reach Gemini API: {e}"}
