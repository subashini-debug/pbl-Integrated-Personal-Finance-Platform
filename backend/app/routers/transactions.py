from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Transaction, User
from ..schemas import TransactionOut, SpendSummary
from ..services.auth import get_current_user

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.date.desc())
        .all()
    )


@router.get("/summary", response_model=SpendSummary)
def spend_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.date.asc())
        .all()
    )

    total_spend = sum(-t.amount for t in txns if t.amount < 0)
    total_income = sum(t.amount for t in txns if t.amount > 0)

    by_category = defaultdict(float)
    for t in txns:
        if t.amount < 0:
            by_category[t.category] += -t.amount

    running = 0.0
    daily = {}
    for t in txns:
        running += t.amount
        daily[t.date.date().isoformat()] = round(running, 2)
    daily_balance = [{"date": d, "balance": b} for d, b in sorted(daily.items())]

    return SpendSummary(
        total_spend=round(total_spend, 2),
        total_income=round(total_income, 2),
        net=round(total_income - total_spend, 2),
        by_category={k: round(v, 2) for k, v in by_category.items()},
        daily_balance=daily_balance,
    )
