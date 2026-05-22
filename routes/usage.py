from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from database import get_db
from models import TokenLog, User
from utils import decode_access_token
import jwt

router = APIRouter(prefix="/api", tags=["analytics"])

def get_current_user(authorization: str = None, db: Session = None) -> User:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Missing authorization header"
            )
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Invalid authorization scheme"
                )
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail=str(e)
            )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found")
    return user

@router.get("/analytics/summary")
def get_analytics_summary(
    days: int = 30, 
    authorization: str = None, 
    db: Session = Depends(get_db)):
    user = get_current_user(authorization, db)
    start_date = datetime.utcnow() - timedelta(days=days)
    logs = db.query(TokenLog).filter(TokenLog.user_id == user.id, TokenLog.timestamp >= start_date).all()
    total_tokens = sum(log.tokens_used for log in logs)
    total_cost = sum(float(log.cost_estimate or 0) for log in logs)
    breakdown = {}
    for log in logs:
        api = log.api_name
        if api not in breakdown:
            breakdown[api] = {"tokens": 0, "cost": 0.0}
        breakdown[api]["tokens"] += log.tokens_used
        breakdown[api]["cost"] += float(log.cost_estimate or 0)
    return {"total_tokens": total_tokens, "total_cost": round(total_cost, 6), "breakdown_by_api": breakdown, "period_days": days}

@router.get("/analytics/timeline")
def get_analytics_timeline(
    days: int = 30, 
    authorization: str = None, 
    db: Session = Depends(get_db)
    ):
    user = get_current_user(authorization, db)
    start_date = datetime.utcnow() - timedelta(days=days)
    logs = db.query(func.date(TokenLog.timestamp).label("date"), 
                    func.sum(TokenLog.tokens_used).label("tokens"), 
                    func.sum(TokenLog.cost_estimate).label("cost")).filter(TokenLog.user_id == user.id, TokenLog.timestamp >= start_date).group_by(func.date(TokenLog.timestamp)).order_by("date").all()
    timeline = [{"date": str(log.date), 
                 "tokens": log.tokens or 0, 
                 "cost": round(float(log.cost or 0), 6)} for log in logs]
    return timeline

@router.get("/user/profile")
def get_user_profile(
    authorization: str = None, db: Session = Depends(get_db)):
    user = get_current_user(authorization, db)
    return {
            "id": user.id, 
            "email": user.email, 
            "tier": user.tier, 
            "created_at": user.created_at
            }