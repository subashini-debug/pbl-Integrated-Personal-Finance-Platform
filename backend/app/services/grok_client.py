"""
Thin wrapper around the xAI Grok chat-completions API.

No key is ever committed to the repo. Resolution order per request:
1. An `X-Grok-Key` header sent by the frontend (user pasted their own key
   in Settings -- stored only in their browser, never on the server disk).
2. The server-wide GROK_API_KEY environment variable, if the operator set
   one in their local, git-ignored `.env` file.
3. Neither present -> caller should use the rules-based fallback instead;
   this client raises GrokUnavailable so callers can catch it cleanly.
"""
import os
import requests

GROK_BASE_URL = os.getenv("GROK_BASE_URL", "https://api.x.ai/v1")
GROK_MODEL = os.getenv("GROK_MODEL", "grok-4-fast")
# Empty string, not a placeholder -- an unset key must be falsy.
SERVER_DEFAULT_KEY = os.getenv("GROK_API_KEY", "")

_PLACEHOLDER_VALUES = {"", "your_grok_api_key_here", "your_gemini_api_key_here", "changeme"}


def _resolve_key(request_key: str | None) -> str | None:
    for candidate in (request_key, SERVER_DEFAULT_KEY):
        if candidate and candidate.strip().lower() not in _PLACEHOLDER_VALUES:
            return candidate.strip()
    return None


def is_configured(request_key: str | None = None) -> bool:
    return bool(_resolve_key(request_key))


def chat(messages: list, request_key: str | None = None, max_tokens: int = 400,
         temperature: float = 0.6) -> str:
    key = _resolve_key(request_key)
    if not key:
        raise GrokUnavailable("No Grok API key configured (header or server env).")

    resp = requests.post(
        f"{GROK_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        json={
            "model": GROK_MODEL,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        },
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


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
        return {"ok": False, "message": f"Grok API rejected the key ({e.response.status_code})."}
    except Exception as e:
        return {"ok": False, "message": f"Could not reach Grok API: {e}"}
