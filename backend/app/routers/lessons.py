from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Transaction, User, Lesson
from ..schemas import LessonOut
from ..services.triggers import detect_triggers
from ..services.lesson_engine import generate_lesson
from ..services.auth import get_current_user

router = APIRouter(prefix="/api/lessons", tags=["lessons"])


@router.get("", response_model=list[LessonOut])
def list_lessons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Lesson)
        .filter(Lesson.user_id == current_user.id)
        .order_by(Lesson.created_at.desc())
        .all()
    )


@router.post("/generate", response_model=list[LessonOut])
def generate_lessons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_grok_key: str | None = Header(default=None, alias="X-Grok-Key"),
):
    """
    Re-scans all of the current user's transactions for behavioral triggers
    and (re)generates lessons for any that don't already have one.
    """
    txns = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    triggers = detect_triggers(txns)

    existing = {
        (l.trigger_type, l.related_transaction_id)
        for l in db.query(Lesson).filter(Lesson.user_id == current_user.id).all()
    }

    created = []
    for trigger in triggers:
        key = (trigger["trigger_type"], trigger.get("transaction_id"))
        if key in existing:
            continue
        content = generate_lesson(trigger, request_key=x_grok_key)
        lesson = Lesson(
            user_id=current_user.id,
            trigger_type=content["trigger_type"],
            title=content["title"],
            body=content["body"],
            opportunity_cost=content["opportunity_cost"],
            related_transaction_id=content["related_transaction_id"],
            source=content["source"],
        )
        db.add(lesson)
        created.append(lesson)

    db.commit()
    for l in created:
        db.refresh(l)

    return (
        db.query(Lesson)
        .filter(Lesson.user_id == current_user.id)
        .order_by(Lesson.created_at.desc())
        .all()
    )
