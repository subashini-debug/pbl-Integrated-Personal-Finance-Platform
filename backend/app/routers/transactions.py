import csv
import io
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Transaction, User
from ..schemas import TransactionOut, TransactionCreate, TransactionImportSummary, SpendSummary
from ..services.auth import get_current_user
from ..services.ledger import build_transaction, recompute_running_balance

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


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    req: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = build_transaction(
        current_user.id, req.date, req.merchant, req.amount, req.category, req.is_subscription
    )
    db.add(txn)
    db.commit()
    recompute_running_balance(db, current_user.id)
    db.refresh(txn)
    return txn


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.")
    db.delete(txn)
    db.commit()
    recompute_running_balance(db, current_user.id)
    return None


@router.post("/import", response_model=TransactionImportSummary)
async def import_transactions(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bulk-import a bank/card statement CSV. Expected columns
    (case-insensitive, any order): date, merchant, amount[, category].
    `amount` must already be signed (negative = spend, positive = credit);
    if a target bank instead exports separate debit/credit columns, that
    normalization belongs in a pre-processing step before this endpoint,
    not inside it.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file.")

    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(raw))
    reader.fieldnames = [f.strip().lower() for f in (reader.fieldnames or [])]

    required = {"date", "merchant", "amount"}
    if not required.issubset(reader.fieldnames or []):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must have columns: {', '.join(sorted(required))}. Found: {reader.fieldnames}",
        )

    imported, errors = 0, []
    for i, row in enumerate(reader, start=2):  # row 1 is the header
        try:
            date = datetime.fromisoformat(row["date"].strip())
            merchant = row["merchant"].strip()
            amount = float(row["amount"])
            category = (row.get("category") or "").strip() or None
            if not merchant:
                raise ValueError("empty merchant")
            db.add(build_transaction(current_user.id, date, merchant, amount, category))
            imported += 1
        except Exception as e:  # one bad row shouldn't sink the whole import
            errors.append(f"Row {i}: {e}")

    db.commit()
    recompute_running_balance(db, current_user.id)
    return TransactionImportSummary(imported=imported, skipped=len(errors), errors=errors[:20])


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
