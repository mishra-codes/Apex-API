from fastapi import APIRouter, Depends, HTTPException, status , Header
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from database import get_db
from models import TokenLog, User
from schemas import TokenLogCreate, TokenLogResponse
from utils import decode_access_token
import jwt

router = APIRouter(prefix="/api", tags=["token_logs"])

def get_current_user(authorization: str = None, db: Session = None) -> User:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header")
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
            detail="User not found"
            )
    return user

@router.post("/token-logs", response_model=TokenLogResponse)
def log_token_usage(
    log_data: TokenLogCreate, 
    authorization: str = Header(None), 
    db: Session = Depends(get_db)
    ):

    user = get_current_user(authorization, db)
    token_log = TokenLog(
        user_id=user.id, 
        api_name=log_data.api_name, 
        tokens_used=log_data.tokens_used, 
        model_used=log_data.model_used, 
        cost_estimate=log_data.cost_estimate, 
        timestamp=log_data.timestamp or datetime.utcnow()
        )
    
    db.add(token_log)
    db.commit()
    db.refresh(token_log)
    return token_log

@router.get("/token-logs")
def get_token_logs(
    days: int = 7, 
    authorization: str = Header(None), 
    db: Session = Depends(get_db)
    ):

    user = get_current_user(authorization, db)
    start_date = datetime.utcnow() - timedelta(days=days)
    logs = db.query(TokenLog).filter(
        TokenLog.user_id == user.id, 
        TokenLog.timestamp >= start_date).order_by(TokenLog.timestamp.desc()).all()
    return logs