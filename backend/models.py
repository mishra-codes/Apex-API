from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, DECIMAL, BigInteger, Date, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    tier = Column(String(20), default="free")
    stripe_customer_id = Column(String(255), unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    token_logs = relationship("TokenLog", back_populates="user", cascade="all, delete-orphan")
    usage_summaries = relationship("UsageSummary", back_populates="user", cascade="all, delete-orphan")

class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    api_name = Column(String(50), nullable=False)
    api_key_encrypted = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="api_keys")

class TokenLog(Base):
    __tablename__ = "token_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    api_name = Column(String(50), nullable=False)
    tokens_used = Column(Integer, nullable=False)
    model_used = Column(String(100), nullable=True)
    cost_estimate = Column(DECIMAL(10, 6), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("ix_user_timestamp", "user_id", "timestamp"),
    )
    
    user = relationship("User", back_populates="token_logs")

class UsageSummary(Base):
    __tablename__ = "usage_summary"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    total_tokens = Column(BigInteger, nullable=False, default=0)
    total_cost = Column(DECIMAL(10, 2), nullable=False, default=0)
    
    __table_args__ = (
        Index("ix_user_date", "user_id", "date", unique=True),
    )
    
    user = relationship("User", back_populates="usage_summaries")