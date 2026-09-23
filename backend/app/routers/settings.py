from fastapi import APIRouter, Header

from ..schemas import GrokKeyTest
from ..services import grok_client

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
