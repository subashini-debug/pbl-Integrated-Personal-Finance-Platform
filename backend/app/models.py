from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="Aditi Rao")
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    monthly_income = Column(Float, default=85000.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    lessons = relationship("Lesson", back_populates="user", cascade="all, delete-orphan")
    profile = relationship("InvestmentProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    agent_messages = relationship("AgentMessage", back_populates="user", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, nullable=False)
    merchant = Column(String, nullable=False)
    amount = Column(Float, nullable=False)  # negative = spend, positive = income/credit
    category = Column(String, default="Uncategorized")
    balance_after = Column(Float, nullable=True)
    is_subscription = Column(Boolean, default=False)

    user = relationship("User", back_populates="transactions")


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    trigger_type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    opportunity_cost = Column(Float, nullable=True)
    related_transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    source = Column(String, default="rules")  # "grok" or "rules"
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="lessons")


class InvestmentProfile(Base):
    __tablename__ = "investment_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    risk_score = Column(Float, default=50.0)  # 0-100
    risk_label = Column(String, default="Balanced")
    monthly_surplus = Column(Float, default=0.0)
    equity_pct = Column(Integer, default=50)
    debt_pct = Column(Integer, default=35)
    gold_pct = Column(Integer, default=10)
    cash_pct = Column(Integer, default=5)
    updated_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="profile")


class AgentMessage(Base):
    """
    Persisted turn in the FinTrack AI Agent conversation. Kept per-user so the
    agent has continuity across sessions -- this is what makes it an "agent"
    rather than a stateless one-shot prompt: it remembers what it already told
    you and can refer back to earlier turns in the same thread.
    """

    __tablename__ = "agent_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    source = Column(String, default="rules")  # "grok" or "rules" (assistant turns only)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="agent_messages")
