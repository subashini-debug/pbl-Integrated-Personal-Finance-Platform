"""
Turns a trigger fact into a lesson (title + body + opportunity-cost number).

All numbers are computed here in plain Python via investment_engine before
anything reaches the LLM. Grok (if configured) is only asked to phrase the
explanation -- it receives the pre-computed facts as constraints, so it
cannot invent numbers that disagree with what's on screen. If Grok isn't
configured or the call fails, a deterministic rules-based template is used
instead so the product works fully offline.
"""
from . import grok_client
from .investment_engine import opportunity_cost

RULES_TEMPLATES = {
    "overdraft_risk": {
        "title": "Your balance dipped dangerously low",
        "body": (
            "After your {merchant} transaction, your estimated balance fell to "
            "roughly ₹{balance_estimate:,.0f}. Repeated dips like this often lead to "
            "overdraft fees or missed payments. A simple fix: keep a buffer worth "
            "1 month of essential expenses in a separate account you don't touch "
            "for discretionary spending."
        ),
    },
    "subscription_stacking": {
        "title": "You're paying for {count} overlapping subscriptions",
        "body": (
            "Between {merchant}, you're spending an estimated ₹{monthly_cost_estimate:,.0f} "
            "every month on subscriptions. Multiply that by 12 and it's real money. "
            "Try a 'subscription audit': cancel anything you haven't opened in the "
            "last 30 days."
        ),
    },
    "impulse_repeat_spend": {
        "title": "3 visits to {merchant} in a few days",
        "body": (
            "You spent ₹{total_amount:,.0f} at {merchant} across {count} visits in "
            "under a week. That's not a budget line item, that's a habit forming in "
            "real time. Try the 24-hour rule: wait a day before the next non-essential "
            "purchase there."
        ),
    },
    "large_discretionary_spend": {
        "title": "A large one-off purchase at {merchant}",
        "body": (
            "You spent ₹{amount_abs:,.0f} at {merchant} -- about {multiple:.1f}x your "
            "typical discretionary transaction. Occasional big purchases are fine, but "
            "it's worth asking: was this planned, or impulsive? Either way, here's what "
            "that amount could have become instead."
        ),
    },
}


def _fallback_lesson(trigger: dict) -> dict:
    t = RULES_TEMPLATES.get(trigger["trigger_type"])
    if not t:
        return {"title": "Spending insight", "body": "We noticed a change in your spending pattern."}

    ctx = dict(trigger)
    ctx["amount_abs"] = abs(trigger.get("amount", 0))
    if trigger.get("average_spend"):
        ctx["multiple"] = abs(trigger["amount"]) / max(1, trigger["average_spend"])

    try:
        title = t["title"].format(**ctx)
        body = t["body"].format(**ctx)
    except (KeyError, ValueError):
        title, body = t["title"], t["body"]

    return {"title": title, "body": body}


def _grok_lesson(trigger: dict, opp_cost: float | None, request_key: str | None) -> dict:
    fallback = _fallback_lesson(trigger)
    facts_summary = ", ".join(f"{k}={v}" for k, v in trigger.items() if k not in ("date",))
    opp_line = f" The opportunity cost, if invested for 10 years at ~12% annual return, is ₹{opp_cost:,.0f}." if opp_cost else ""

    prompt = (
        "You are a friendly, concise personal-finance micro-lesson writer for an Indian audience. "
        "Given these computed facts about a real transaction pattern, write a short lesson. "
        "Do NOT invent or alter any numbers -- only use the numbers given. "
        f"Facts: {facts_summary}.{opp_line} "
        "Respond in exactly two lines: line 1 is a short punchy title (max 8 words), "
        "line 2 is a 2-3 sentence lesson body, encouraging but direct, no fluff, no emoji."
    )
    try:
        reply = grok_client.chat(
            [{"role": "system", "content": "You write short, factual, encouraging financial micro-lessons."},
             {"role": "user", "content": prompt}],
            request_key=request_key,
        )
        lines = [l.strip() for l in reply.split("\n") if l.strip()]
        if len(lines) >= 2:
            return {"title": lines[0].lstrip("#").strip(), "body": " ".join(lines[1:])}
        return {"title": fallback["title"], "body": reply}
    except Exception:
        return fallback


def generate_lesson(trigger: dict, request_key: str | None = None) -> dict:
    opp_cost = None
    if trigger["trigger_type"] in ("large_discretionary_spend", "impulse_repeat_spend"):
        amt = abs(trigger.get("amount") or trigger.get("total_amount") or 0)
        opp_cost = opportunity_cost(amt)

    if grok_client.is_configured(request_key):
        content = _grok_lesson(trigger, opp_cost, request_key)
        source = "grok"
    else:
        content = _fallback_lesson(trigger)
        source = "rules"

    return {
        "trigger_type": trigger["trigger_type"],
        "title": content["title"],
        "body": content["body"],
        "opportunity_cost": opp_cost,
        "related_transaction_id": trigger.get("transaction_id"),
        "source": source,
    }
