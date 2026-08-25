"""
The FinTrack AI Agent.

This is a conversational layer on top of the same "facts computed in Python,
narrated by an LLM" philosophy the rest of the app uses (see lesson_engine.py
and investment_engine.py). Before every reply, the agent:

1. Pulls the user's real transactions, spend summary, and investment profile
   from the database and reduces them to a compact "facts" block.
2. Sends those facts + the recent conversation history to Grok as a system
   prompt, explicitly instructing it to reason ONLY over the given numbers
   and never invent figures.
3. Falls back to a deterministic, rules-based responder if no Grok key is
   configured or the API call fails, so the agent still answers sensibly
   with zero network dependency (judges' wifi problem, again).

The agent is intentionally scoped to personal-finance coaching grounded in
*this user's own data* -- it is not a general-purpose chatbot.
"""
import re
from collections import defaultdict
from typing import List

from . import grok_client
from .investment_engine import infer_risk_profile
from ..models import Transaction, User

SYSTEM_PROMPT = (
    "You are the FinTrack AI Agent, a personal-finance coach embedded inside "
    "the FinTrack app. You help the user understand their own spending, "
    "savings, and investment posture. Rules you must always follow:\n"
    "1. Use ONLY the numbers given to you in the 'Known facts about this "
    "user' block below -- never invent, estimate, or round differently.\n"
    "2. If a question needs a number you were not given, say so plainly and "
    "suggest which FinTrack tab (Ledger, Learn, or Invest) has it, instead "
    "of guessing.\n"
    "3. Be concise: 2-5 sentences unless the user asks for a list.\n"
    "4. Be warm but direct. No emoji, no filler disclaimers on every message.\n"
    "5. You are not a licensed financial advisor and this is not regulated "
    "investment advice -- keep that in mind for anything resembling a "
    "specific buy/sell recommendation, but you don't need to repeat this "
    "disclaimer every turn."
)


def _build_facts(db_transactions: List[Transaction], user: User) -> dict:
    txns = sorted(db_transactions, key=lambda t: t.date)
    total_spend = round(sum(-t.amount for t in txns if t.amount < 0), 2)
    total_income = round(sum(t.amount for t in txns if t.amount > 0), 2)

    by_category = defaultdict(float)
    for t in txns:
        if t.amount < 0:
            by_category[t.category] += -t.amount
    top_categories = sorted(by_category.items(), key=lambda kv: -kv[1])[:5]

    subs = [t for t in txns if t.is_subscription]
    sub_monthly_estimate = round(sum(-t.amount for t in subs) / max(1, len(subs)) * len({t.merchant for t in subs}), 2) if subs else 0.0

    profile = infer_risk_profile(txns, user.monthly_income) if txns else None

    facts = {
        "user_name": user.name,
        "monthly_income": user.monthly_income,
        "transactions_on_record": len(txns),
        "total_spend_period": total_spend,
        "total_income_period": total_income,
        "net_period": round(total_income - total_spend, 2),
        "top_spend_categories": [{"category": c, "amount": round(a, 2)} for c, a in top_categories],
        "distinct_subscriptions": len({t.merchant for t in subs}),
        "estimated_monthly_subscription_spend": sub_monthly_estimate,
    }
    if profile:
        facts.update({
            "risk_label": profile["risk_label"],
            "risk_score": profile["risk_score"],
            "monthly_surplus": profile["monthly_surplus"],
            "recommended_allocation": {
                "equity_pct": profile["equity_pct"],
                "debt_pct": profile["debt_pct"],
                "gold_pct": profile["gold_pct"],
                "cash_pct": profile["cash_pct"],
            },
        })
    return facts


def _facts_to_prompt_block(facts: dict) -> str:
    lines = [f"- {k}: {v}" for k, v in facts.items()]
    return "Known facts about this user (from real transaction data, not estimates):\n" + "\n".join(lines)


def _fallback_reply(message: str, facts: dict) -> str:
    """Deterministic keyword-routed responder used when Grok is unavailable."""
    m = message.lower()

    if not facts.get("transactions_on_record"):
        return (
            "I don't have any transactions on your account yet, so I can't ground an "
            "answer in real numbers. Once you're on the demo account or have some "
            "activity, ask me again and I'll use your actual spend and surplus."
        )

    if re.search(r"\b(spend|spent|spending|expense)\b", m):
        top = facts.get("top_spend_categories") or []
        if top:
            leader = top[0]
            lines = ", ".join(f"{c['category']} (₹{c['amount']:,.0f})" for c in top[:3])
            return (
                f"Over the period on record you've spent ₹{facts['total_spend_period']:,.0f} in total. "
                f"Your biggest category is {leader['category']} at ₹{leader['amount']:,.0f}. "
                f"Top categories: {lines}."
            )
        return f"Total spend on record is ₹{facts['total_spend_period']:,.0f}."

    if re.search(r"\b(subscription|subscriptions|recurring)\b", m):
        n = facts.get("distinct_subscriptions", 0)
        est = facts.get("estimated_monthly_subscription_spend", 0)
        if n:
            return (
                f"You have roughly {n} recurring subscriptions on record, costing an "
                f"estimated ₹{est:,.0f}/month combined. Check the Learn tab -- subscription "
                f"stacking is one of the four patterns FinTrack watches for."
            )
        return "I don't see any transactions flagged as subscriptions on your account yet."

    if re.search(r"\b(invest|investing|allocation|portfolio|risk)\b", m):
        alloc = facts.get("recommended_allocation")
        if alloc:
            return (
                f"Based on your last 90 days of cash-flow volatility, your inferred profile is "
                f"'{facts['risk_label']}' (score {facts['risk_score']}/100). Suggested mix: "
                f"{alloc['equity_pct']}% equity, {alloc['debt_pct']}% debt, {alloc['gold_pct']}% gold, "
                f"{alloc['cash_pct']}% cash, with an estimated monthly surplus of ₹{facts['monthly_surplus']:,.0f}. "
                f"See the Invest tab for the full compound-growth projection."
            )
        return "I need a bit more transaction history before I can infer a risk profile for you."

    if re.search(r"\b(surplus|save|saving|savings)\b", m):
        surplus = facts.get("monthly_surplus")
        if surplus is not None:
            tone = "healthy" if surplus > 0 else "tight"
            return (
                f"Your estimated monthly surplus is ₹{surplus:,.0f}, which looks {tone} against "
                f"a monthly income of ₹{facts['monthly_income']:,.0f}. That surplus is what feeds "
                f"the SIP projection on the Invest tab."
            )

    if re.search(r"\b(income|earn|salary)\b", m):
        return f"Your recorded monthly income is ₹{facts['monthly_income']:,.0f}."

    # Generic fallback: summarize what we know.
    return (
        f"Here's a quick snapshot: ₹{facts['total_income_period']:,.0f} in, "
        f"₹{facts['total_spend_period']:,.0f} out, net ₹{facts['net_period']:,.0f} over the period on "
        f"record. Ask me about spending, subscriptions, savings, or your investment allocation and "
        f"I'll dig into the specific numbers. (Connect a Grok API key in Settings for richer, "
        f"free-form answers -- right now I'm using the offline rules engine.)"
    )


def reply(
    message: str,
    history: List[dict],
    db_transactions: List[Transaction],
    user: User,
    request_key: str | None = None,
) -> dict:
    """
    Returns {"reply": str, "source": "grok"|"rules", "context_used": dict}.
    `history` is a list of {"role": "user"|"assistant", "content": str}
    already trimmed to a reasonable window by the caller.
    """
    facts = _build_facts(db_transactions, user)

    if grok_client.is_configured(request_key):
        try:
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT + "\n\n" + _facts_to_prompt_block(facts)},
                *history,
                {"role": "user", "content": message},
            ]
            text = grok_client.chat(messages, request_key=request_key, max_tokens=350, temperature=0.5)
            return {"reply": text, "source": "grok", "context_used": facts}
        except Exception:
            pass  # fall through to rules engine

    return {"reply": _fallback_reply(message, facts), "source": "rules", "context_used": facts}
