"""
Behavioral trigger engine.

Watches the transaction stream for four specific patterns (not generic
category nudges) and returns structured "facts" for the lesson engine to
turn into a contextual micro-lesson. This is the core "react to real
behavior" innovation described in the problem statement's response.
"""
from collections import defaultdict
from datetime import timedelta
from typing import List

from ..models import Transaction

OVERDRAFT_THRESHOLD = 2000.0
SUBSCRIPTION_STACK_THRESHOLD = 4
IMPULSE_REPEAT_WINDOW_DAYS = 4
IMPULSE_REPEAT_COUNT = 3
LARGE_SPEND_MULTIPLIER = 3.0  # multiple of the user's average discretionary txn


def detect_triggers(transactions: List[Transaction]) -> List[dict]:
    if not transactions:
        return []

    txns = sorted(transactions, key=lambda t: t.date)
    facts = []

    # 1. Overdraft risk: running balance drops below threshold
    running = 0.0
    for t in txns:
        running += t.amount
        if running < OVERDRAFT_THRESHOLD:
            facts.append({
                "trigger_type": "overdraft_risk",
                "transaction_id": t.id,
                "merchant": t.merchant,
                "amount": t.amount,
                "date": t.date,
                "balance_estimate": round(running, 2),
            })

    # 2. Subscription stacking: count distinct active subscriptions
    subs = [t for t in txns if t.is_subscription]
    distinct_subs = {t.merchant for t in subs}
    if len(distinct_subs) >= SUBSCRIPTION_STACK_THRESHOLD:
        monthly_sub_cost = sum(abs(t.amount) for t in subs) / max(1, (len(txns) and 3))
        facts.append({
            "trigger_type": "subscription_stacking",
            "transaction_id": subs[-1].id if subs else None,
            "merchant": ", ".join(sorted(distinct_subs)),
            "count": len(distinct_subs),
            "monthly_cost_estimate": round(monthly_sub_cost, 2),
            "date": subs[-1].date if subs else None,
        })

    # 3. Impulse repeat-spend: same merchant 3+ times within a short window
    by_merchant = defaultdict(list)
    for t in txns:
        if t.amount < 0:
            by_merchant[t.merchant].append(t)

    for merchant, m_txns in by_merchant.items():
        m_txns.sort(key=lambda t: t.date)
        for i in range(len(m_txns) - IMPULSE_REPEAT_COUNT + 1):
            window = m_txns[i:i + IMPULSE_REPEAT_COUNT]
            if window[-1].date - window[0].date <= timedelta(days=IMPULSE_REPEAT_WINDOW_DAYS):
                facts.append({
                    "trigger_type": "impulse_repeat_spend",
                    "transaction_id": window[-1].id,
                    "merchant": merchant,
                    "count": len(window),
                    "total_amount": round(sum(abs(t.amount) for t in window), 2),
                    "date": window[-1].date,
                })
                break  # one trigger per merchant is enough

    # 4. Large one-off discretionary spend
    discretionary = [t for t in txns if t.amount < 0 and t.category not in
                      ("Rent & Housing", "Bills & Utilities", "Salary", "Investment")]
    if discretionary:
        avg = sum(abs(t.amount) for t in discretionary) / len(discretionary)
        for t in discretionary:
            if abs(t.amount) >= avg * LARGE_SPEND_MULTIPLIER and abs(t.amount) >= 3000:
                facts.append({
                    "trigger_type": "large_discretionary_spend",
                    "transaction_id": t.id,
                    "merchant": t.merchant,
                    "amount": t.amount,
                    "date": t.date,
                    "average_spend": round(avg, 2),
                })

    return facts
