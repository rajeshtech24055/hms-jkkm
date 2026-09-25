from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from datetime import datetime

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("")
def get_notifications(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.models import User, NotificationLog
    user_id = current_user.get("id")
    role = current_user.get("role")
    user = db.query(User).filter(User.id == user_id).first()
    
    query = db.query(NotificationLog).order_by(NotificationLog.id.desc()).limit(20)
    
    if user_id:
        logs = query.filter(NotificationLog.user_id == user_id).all()
    else:
        logs = []
        
    return [
        {
            "id": log.id,
            "title": log.type or "Alert",
            "message": log.message,
            "read": log.status == "READ",
            "time": log.sent_at
        } for log in logs
    ]
    
@router.post("/{notif_id}/read")
def mark_read(
    notif_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.models import NotificationLog
    log = db.query(NotificationLog).filter(NotificationLog.id == notif_id).first()
    if log:
        log.status = "READ"
        db.commit()
    return {"success": True}
