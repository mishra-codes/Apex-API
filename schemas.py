from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional
from decimal import Decimal

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int

class UserResponse(BaseModel):
    id: int
    email: str
    tier: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class TokenLogCreate(BaseModel):
    api_name: str
    tokens_used: int
    model_used: Optional[str] = None
    cost_estimate: Optional[Decimal] = None
    timestamp: Optional[datetime] = None

class TokenLogResponse(BaseModel):
    id: int
    api_name: str
    tokens_used: int
    model_used: Optional[str]
    cost_estimate: Optional[Decimal]
    timestamp: datetime
    
    class Config:
        from_attributes = True

class UsageResponse(BaseModel):
    date: str
    total_tokens: int
    total_cost: Decimal
    breakdown: dict

class AnalyticsSummary(BaseModel):
    total_tokens: int
    total_cost: Decimal
    breakdown_by_api: dict