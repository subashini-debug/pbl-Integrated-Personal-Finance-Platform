from fastapi import APIRouter, Header

from ..schemas import GrokKeyTest, GeminiKeyTest
from ..services import grok_client, gemini_client

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/grok-status")
def grok_status(x_grok_key: str | None = Header(default=None, alias="X-Grok-Key")):
    return {
        "configured": grok_client.is_configured(x_grok_key),
        "using_server_default": bool(grok_client.SERVER_DEFAULT_KEY) and not x_grok_key,
    }


@router.post("/test-grok-key")
def test_grok_key(payload: GrokKeyTest):
    return grok_client.test_key(payload.api_key)


@router.get("/gemini-status")
def gemini_status(x_gemini_key: str | None = Header(default=None, alias="X-Gemini-Key")):
    return {
        "configured": gemini_client.is_configured(x_gemini_key),
        "using_server_default": bool(gemini_client.SERVER_DEFAULT_KEY) and not x_gemini_key,
    }


@router.post("/test-gemini-key")
def test_gemini_key(payload: GeminiKeyTest):
    return gemini_client.test_key(payload.api_key)
