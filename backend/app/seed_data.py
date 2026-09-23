"""
Generates 90 days of realistic mock transactions for the demo user, so the
app has real, working data on first startup without needing a live Plaid
connection. Deterministic seed (random.seed) so the demo is reproducible.
"""
import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .models import User, Transaction
from .services.categorizer import categorize, is_subscription_merchant
from .services.auth import hash_password

random.seed(42)

DEMO_EMAIL = "demo@fintrack.app"
DEMO_PASSWORD = "fintrack-demo"

MERCHANTS_RECURRING = [
    ("Netflix", -499),
    ("Spotify Premium", -119),
    ("Amazon Prime", -299),
    ("Gym Membership", -1500),
    ("iCloud Storage", -75),
]

MERCHANTS_VARIABLE = [
    "Swiggy", "Zomato", "Starbucks", "BigBasket", "Blinkit", "Uber", "Ola",
    "Amazon", "Flipkart", "Myntra", "Petrol Pump", "Electricity Board",
    "Mobile Recharge", "Apollo Pharmacy", "BookMyShow", "DMart", "Zepto",
    "Dominos Pizza", "Cafe Coffee Day", "Metro Card Recharge",
]


def _random_amount(low, high):
    return -round(random.uniform(low, high), 2)


def seed_if_empty(db: Session):
    if db.query(User).filter(User.email == DEMO_EMAIL).first():
        return

    user = User(
        name="Aditi Rao",
        email=DEMO_EMAIL,
        password_hash=hash_password(DEMO_PASSWORD),
        monthly_income=85000.0,
    )
    db.add(user)
    db.flush()

    start_date = datetime.utcnow() - timedelta(days=90)
    balance = 42000.0
    txns = []

    # Monthly salary credits
    for month_offset in range(0, 4):
        pay_date = start_date + timedelta(days=month_offset * 30 + 1)
        if pay_date > datetime.utcnow():
            continue
        balance += user.monthly_income
        txns.append(Transaction(
            user_id=user.id, date=pay_date, merchant="Salary Credit",
            amount=user.monthly_income, category="Salary", balance_after=balance,
        ))

    # Recurring subscriptions, once per month
    for month_offset in range(0, 4):
        for merchant, amt in MERCHANTS_RECURRING:
            txn_date = start_date + timedelta(days=month_offset * 30 + random.randint(2, 5))
            if txn_date > datetime.utcnow():
                continue
            balance += amt
            txns.append(Transaction(
                user_id=user.id, date=txn_date, merchant=merchant, amount=amt,
                category=categorize(merchant), balance_after=balance,
                is_subscription=True,
            ))

    # Daily-ish variable spending, with a deliberate overdraft-risk streak
    # around day 55-60 and a subscription-stacking + impulse-repeat cluster
    # around day 20-25, so the trigger engine has real patterns to catch.
    day = 0
    while day < 90:
        txn_date = start_date + timedelta(days=day)
        if txn_date > datetime.utcnow():
            break

        # normal day: 0-3 transactions
        n = random.choices([0, 1, 2, 3], weights=[10, 40, 35, 15])[0]

        # Impulse repeat-spend cluster: same merchant, 3x in short window
        if 20 <= day <= 23:
            merchant = "Starbucks"
            amt = _random_amount(180, 420)
            balance += amt
            txns.append(Transaction(
                user_id=user.id, date=txn_date, merchant=merchant, amount=amt,
                category=categorize(merchant), balance_after=balance,
            ))

        # Large one-off discretionary spend
        if day == 40:
            amt = -round(random.uniform(8000, 15000), 2)
            balance += amt
            txns.append(Transaction(
                user_id=user.id, date=txn_date, merchant="Flipkart", amount=amt,
                category=categorize("Flipkart"), balance_after=balance,
            ))

        # Overdraft-risk streak: heavier spend, balance trending down hard
        if 55 <= day <= 60:
            n = max(n, 2)

        for _ in range(n):
            merchant = random.choice(MERCHANTS_VARIABLE)
            amt = _random_amount(50, 3500 if 55 <= day <= 60 else 1200)
            balance += amt
            txns.append(Transaction(
                user_id=user.id, date=txn_date, merchant=merchant, amount=amt,
                category=categorize(merchant), balance_after=round(balance, 2),
                is_subscription=is_subscription_merchant(merchant),
            ))

        day += 1

    txns.sort(key=lambda t: t.date)
    db.add_all(txns)
    db.commit()
