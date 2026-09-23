"""
Ledger helpers shared by manual entry and CSV import: build a Transaction
from raw user input (auto-categorizing when the caller didn't specify one)
and keep balance_after consistent after any insert or delete.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from ..models import Transaction
from .categorizer import categorize, is_subscription_merchant


def build_transaction(
    user_id: int,
    date: datetime,
    merchant: str,
    amount: float,
    category: Optional[str] = None,
    is_subscription: Optional[bool] = None,
) -> Transaction:
    merchant = merchant.strip()
    resolved_category = category or categorize(merchant)
    resolved_is_sub = (
        is_subscription if is_subscription is not None else is_subscription_merchant(merchant)
    )
    return Transaction(
        user_id=user_id,
        date=date,
        merchant=merchant,
        amount=amount,
        category=resolved_category,
        is_subscription=resolved_is_sub,
    )


def recompute_running_balance(db: Session, user_id: int) -> None:
    """
    Walk a user's transactions in date order and rewrite balance_after so
    it's always a true running total. Must be called after any insert,
    delete, or edit -- balance_after is stored, not computed at read time,
    so a manual insert in the middle of the timeline (a backdated CSV row,
    say) would otherwise leave every later row's stored balance stale.
    """
    txns = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.date.asc(), Transaction.id.asc())
        .all()
    )
    running = 0.0
    for t in txns:
        running += t.amount
        t.balance_after = round(running, 2)
    db.commit()
