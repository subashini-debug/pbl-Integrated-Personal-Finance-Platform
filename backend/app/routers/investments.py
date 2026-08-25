from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Transaction, User, InvestmentProfile
from ..schemas import InvestmentProfileOut, ProjectionRequest, ProjectionPoint
from ..services.investment_engine import infer_risk_profile, blended_annual_return, project_growth
from ..services.auth import get_current_user

router = APIRouter(prefix="/api/investments", tags=["investments"])


@router.get("/profile", response_model=InvestmentProfileOut)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    inferred = infer_risk_profile(txns, current_user.monthly_income)

    profile = db.query(InvestmentProfile).filter(InvestmentProfile.user_id == current_user.id).first()
    if not profile:
        profile = InvestmentProfile(user_id=current_user.id)
        db.add(profile)

    profile.risk_score = inferred["risk_score"]
    profile.risk_label = inferred["risk_label"]
    profile.monthly_surplus = inferred["monthly_surplus"]
    profile.equity_pct = inferred["equity_pct"]
    profile.debt_pct = inferred["debt_pct"]
    profile.gold_pct = inferred["gold_pct"]
    profile.cash_pct = inferred["cash_pct"]
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/projection", response_model=list[ProjectionPoint])
def get_projection(
    req: ProjectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    inferred = infer_risk_profile(txns, current_user.monthly_income)

    annual_return = req.expected_annual_return or blended_annual_return(inferred)
    return project_growth(req.monthly_contribution, req.years, annual_return)
