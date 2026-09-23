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
    # Dummy notifications for now
    return [
        {
            "id": 1, 
            "title": "Welcome to HMS", 
            "message": "Hostel Management System is now live", 
            "read": False, 
            "time": "Just now"
        }
    ]
    
@router.post("/{notif_id}/read")
def mark_read(
    notif_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return {"success": True}
