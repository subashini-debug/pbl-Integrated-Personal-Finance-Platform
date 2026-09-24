from fastapi import APIRouter, Header

from ..schemas import GrokKeyTest
from ..services import gemini_client, grok_client

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/grok-status")
def grok_status(x_grok_key: str | None = Header(default=None, alias="X-Grok-Key")):
    configured = gemini_client.is_configured(x_grok_key) or grok_client.is_configured(x_grok_key)
    using_server_default = bool(gemini_client._resolve_key()) and not x_grok_key
    return {
        "configured": configured,
        "using_server_default": using_server_default,
    }


@router.post("/test-grok-key")
def test_grok_key(payload: GrokKeyTest):
    res_gemini = gemini_client.test_key(payload.api_key)
    if res_gemini.get("ok"):
        return res_gemini
    return grok_client.test_key(payload.api_key)
