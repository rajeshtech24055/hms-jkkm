from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import AuditLog, User
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/audit-logs", tags=["audit"])

def log_audit(db: Session, user_id: int, action: str, entity: str, details: str, ip_address: str = None):
    new_log = AuditLog(
        user_id=user_id,
        action=action,
        entity=entity,
        details=details,
        ip_address=ip_address
    )
    db.add(new_log)
    db.commit()

@router.get("")
def get_audit_logs(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).all()
    
    result = []
    for log in logs:
        user_name = "System"
        if log.user:
            user_name = log.user.name
        
        result.append({
            "id": log.id,
            "user_name": user_name,
            "action": log.action,
            "entity": log.entity,
            "details": log.details,
            "ip_address": log.ip_address,
            "timestamp": log.timestamp
        })
        
    return result
