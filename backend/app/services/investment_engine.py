"""
Investment roadmap engine.

Risk appetite is inferred from trailing 90-day cash-flow volatility instead
of a static onboarding quiz, per the problem statement's differentiation
claim. All money math here is deterministic plain Python -- an LLM never
touches these numbers, only explains them afterwards.
"""
import statistics
from typing import List

from ..models import Transaction

# Blended nominal annual return assumptions used for the projection line.
# Conservative real-world figures, not marketing numbers.
ASSET_RETURNS = {
    "equity": 0.12,
    "debt": 0.07,
    "gold": 0.08,
    "cash": 0.035,
}


def compute_monthly_surplus(transactions: List[Transaction], monthly_income: float) -> float:
    if not transactions:
        return 0.0
    total_spend = sum(-t.amount for t in transactions if t.amount < 0)
    days = max(1, (max(t.date for t in transactions) - min(t.date for t in transactions)).days)
    months = max(1, days / 30)
    avg_monthly_spend = total_spend / months
    return round(monthly_income - avg_monthly_spend, 2)


def compute_volatility_score(transactions: List[Transaction]) -> float:
    """
    Returns 0-100 volatility score derived from the coefficient of variation
    of daily net cash flow. Higher volatility -> lower risk tolerance
    recommended (income/spend instability means less room to absorb
    market drawdowns), which is the inverse of naive "spends more = riskier"
    intuition and is intentional.
    """
    if len(transactions) < 5:
        return 50.0

    daily_totals = {}
    for t in transactions:
        key = t.date.date()
        daily_totals[key] = daily_totals.get(key, 0.0) + t.amount

    values = list(daily_totals.values())
    if len(values) < 2:
        return 50.0

    mean = statistics.mean(values)
    stdev = statistics.stdev(values)
    if mean == 0:
        cv = 1.0
    else:
        cv = abs(stdev / mean)

    # Normalize into a 0-100 volatility score (empirically calibrated band)
    score = min(100.0, max(0.0, cv * 40))
    return round(score, 1)


def infer_risk_profile(transactions: List[Transaction], monthly_income: float) -> dict:
    volatility = compute_volatility_score(transactions)
    surplus = compute_monthly_surplus(transactions, monthly_income)
    surplus_ratio = max(0.0, min(1.0, surplus / monthly_income)) if monthly_income else 0.0

    # Risk score: higher surplus ratio + lower volatility => higher risk tolerance
    risk_score = round(max(5.0, min(95.0, (surplus_ratio * 100 * 0.6) + ((100 - volatility) * 0.4))), 1)

    if risk_score >= 70:
        label = "Growth-Oriented"
        alloc = {"equity": 65, "debt": 20, "gold": 10, "cash": 5}
    elif risk_score >= 45:
        label = "Balanced"
        alloc = {"equity": 50, "debt": 30, "gold": 12, "cash": 8}
    else:
        label = "Capital-Protective"
        alloc = {"equity": 30, "debt": 45, "gold": 15, "cash": 10}

    return {
        "risk_score": risk_score,
        "risk_label": label,
        "monthly_surplus": surplus,
        "equity_pct": alloc["equity"],
        "debt_pct": alloc["debt"],
        "gold_pct": alloc["gold"],
        "cash_pct": alloc["cash"],
        "volatility_score": volatility,
    }


def blended_annual_return(alloc: dict) -> float:
    return (
        alloc["equity_pct"] / 100 * ASSET_RETURNS["equity"]
        + alloc["debt_pct"] / 100 * ASSET_RETURNS["debt"]
        + alloc["gold_pct"] / 100 * ASSET_RETURNS["gold"]
        + alloc["cash_pct"] / 100 * ASSET_RETURNS["cash"]
    )


def project_growth(monthly_contribution: float, years: int, annual_return: float) -> list:
    """Standard SIP future-value compounding, year by year."""
    monthly_rate = annual_return / 12
    points = []
    balance = 0.0
    invested = 0.0
    months_total = years * 12
    for m in range(1, months_total + 1):
        balance = balance * (1 + monthly_rate) + monthly_contribution
        invested += monthly_contribution
        if m % 12 == 0:
            points.append({
                "year": m // 12,
                "invested": round(invested, 2),
                "projected_value": round(balance, 2),
            })
    return points


def opportunity_cost(amount: float, years: int = 10, annual_return: float = 0.12) -> float:
    """What a single spent amount would be worth today if invested instead."""
    return round(abs(amount) * ((1 + annual_return) ** years), 2)
