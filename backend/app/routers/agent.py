from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AgentMessage, Transaction, User
from ..schemas import AgentChatRequest, AgentChatResponse, AgentMessageOut
from ..services import agent as agent_service
from ..services.auth import get_current_user

router = APIRouter(prefix="/api/agent", tags=["agent"])

HISTORY_WINDOW = 12  # turns of prior conversation sent to the model as context
HISTORY_DISPLAY_LIMIT = 100  # turns returned to the frontend on load


@router.get("/history", response_model=list[AgentMessageOut])
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(AgentMessage)
        .filter(AgentMessage.user_id == current_user.id)
        .order_by(AgentMessage.created_at.asc())
        .limit(HISTORY_DISPLAY_LIMIT)
        .all()
    )


@router.post("/chat", response_model=AgentChatResponse)
def chat(
    payload: AgentChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_grok_key: str | None = Header(default=None, alias="X-Grok-Key"),
):
    prior = (
        db.query(AgentMessage)
        .filter(AgentMessage.user_id == current_user.id)
        .order_by(AgentMessage.created_at.desc())
        .limit(HISTORY_WINDOW)
        .all()
    )
    history = [{"role": m.role, "content": m.content} for m in reversed(prior)]

    txns = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()

    result = agent_service.reply(
        message=payload.message,
        history=history,
        db_transactions=txns,
        user=current_user,
        request_key=x_grok_key,
    )

    db.add(AgentMessage(user_id=current_user.id, role="user", content=payload.message, source="user"))
    db.add(AgentMessage(
        user_id=current_user.id,
        role="assistant",
        content=result["reply"],
        source=result["source"],
    ))
    db.commit()

    return AgentChatResponse(reply=result["reply"], source=result["source"], context_used=result["context_used"])


@router.delete("/history", status_code=204)
def clear_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(AgentMessage).filter(AgentMessage.user_id == current_user.id).delete()
    db.commit()
    return None
