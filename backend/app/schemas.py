from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class TransactionOut(BaseModel):
    id: int
    date: datetime
    merchant: str
    amount: float
    category: str
    balance_after: Optional[float] = None
    is_subscription: bool

    class Config:
        from_attributes = True


class SpendSummary(BaseModel):
    total_spend: float
    total_income: float
    net: float
    by_category: dict
    daily_balance: list


class LessonOut(BaseModel):
    id: int
    trigger_type: str
    title: str
    body: str
    opportunity_cost: Optional[float] = None
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class InvestmentProfileOut(BaseModel):
    risk_score: float
    risk_label: str
    monthly_surplus: float
    equity_pct: int
    debt_pct: int
    gold_pct: int
    cash_pct: int

    class Config:
        from_attributes = True


class ProjectionRequest(BaseModel):
    monthly_contribution: float
    years: int = 10
    expected_annual_return: Optional[float] = None


class ProjectionPoint(BaseModel):
    year: int
    invested: float
    projected_value: float


class GrokKeyTest(BaseModel):
    api_key: str


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    monthly_income: float = Field(default=85000.0, ge=0)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    monthly_income: float

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AgentMessageOut(BaseModel):
    id: int
    role: str
    content: str
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class AgentChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class AgentChatResponse(BaseModel):
    reply: str
    source: str  # "grok" or "rules"
    context_used: dict
