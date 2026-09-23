from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Transaction, User, InvestmentProfile, Goal
from ..schemas import InvestmentProfileOut, ProjectionRequest, ProjectionPoint, GoalCreate, GoalOut
from ..services.investment_engine import (
    infer_risk_profile,
    blended_annual_return,
    project_growth,
    goal_progress,
)
from ..services.auth import get_current_user

router = APIRouter(prefix="/api/investments", tags=["investments"])


def _current_profile(db: Session, current_user: User) -> dict:
    """Recompute the risk-derived allocation from live transactions -- the
    same inference used by GET /profile -- so goal maths always uses the
    user's latest surplus/return rather than a possibly-stale stored row."""
    txns = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    return infer_risk_profile(txns, current_user.monthly_income)


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


def _to_goal_out(goal: Goal, inferred: dict) -> dict:
    annual_return = blended_annual_return(inferred)
    progress = goal_progress(goal.target_amount, goal.target_years, annual_return, inferred["monthly_surplus"])
    return {
        "id": goal.id,
        "name": goal.name,
        "target_amount": goal.target_amount,
        "target_years": goal.target_years,
        "required_monthly_sip": progress["required_monthly_sip"],
        "on_track": progress["on_track"],
        "projection": progress["projection_at_current_surplus"],
        "created_at": goal.created_at,
    }


@router.post("/goals", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(
    req: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = Goal(
        user_id=current_user.id,
        name=req.name,
        target_amount=req.target_amount,
        target_years=req.target_years,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)

    inferred = _current_profile(db, current_user)
    return _to_goal_out(goal, inferred)


@router.get("/goals", response_model=list[GoalOut])
def list_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goals = (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id)
        .order_by(Goal.created_at.asc())
        .all()
    )
    inferred = _current_profile(db, current_user)
    return [_to_goal_out(g, inferred) for g in goals]


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == current_user.id).first()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found.")
    db.delete(goal)
    db.commit()
    return None
