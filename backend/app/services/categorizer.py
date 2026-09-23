"""
Keyword-based merchant -> category classifier.

This stands in for the scikit-learn spending-pattern classifier called for
in the original tech stack. The keyword table below is the Review-1
foundation; swapping this function's body for a trained sklearn model
(same input/output contract: merchant string -> category string) is a
drop-in Review-2 upgrade with no changes needed anywhere else in the app.
"""

CATEGORY_KEYWORDS = {
    "Food & Dining": ["swiggy", "zomato", "starbucks", "dominos", "mcdonald", "cafe", "restaurant", "pizza"],
    "Groceries": ["bigbasket", "blinkit", "zepto", "dmart", "grocery", "instamart"],
    "Subscriptions": ["netflix", "spotify", "amazon prime", "hotstar", "youtube premium", "icloud", "gym membership"],
    "Transport": ["uber", "ola", "rapido", "petrol", "fuel", "metro card", "irctc"],
    "Shopping": ["amazon", "flipkart", "myntra", "ajio", "nykaa"],
    "Bills & Utilities": ["electricity board", "broadband", "mobile recharge", "water bill", "gas bill", "dth"],
    "Rent & Housing": ["rent", "landlord", "society maintenance"],
    "Health": ["pharmacy", "apollo", "hospital", "clinic", "diagnostics"],
    "Entertainment": ["bookmyshow", "pvr", "inox", "concert"],
    "Salary": ["salary", "payroll"],
    "Transfer": ["upi transfer", "neft", "imps", "atm withdrawal"],
    "Investment": ["mutual fund", "sip", "zerodha", "groww", "stocks"],
}


def categorize(merchant: str) -> str:
    m = merchant.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(k in m for k in keywords):
            return category
    return "Other"


def is_subscription_merchant(merchant: str) -> bool:
    return categorize(merchant) == "Subscriptions"
