from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import Notice
from app.utils.push import notify_role

router = APIRouter(prefix="/api/notices", tags=["Notices"])

class NoticeCreate(BaseModel):
    title: str
    content: str
    category: Optional[str] = "General"

@router.get("")
def get_notices(db: Session = Depends(get_db)):
    return db.query(Notice).order_by(Notice.id.desc()).all()

@router.post("")
def create_notice(
    data: NoticeCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN", "WARDEN")),
    db: Session = Depends(get_db)
):
    n = Notice(
        posted_by=current_user["id"],
        title=data.title,
        content=data.content,
        category=data.category or "General",
        created_at=datetime.utcnow().isoformat()
    )
    db.add(n)
    db.commit()
    
    notify_role(db, "STUDENT", "New Notice Posted", data.title, {"type": "notice"})
    
    return {"id": n.id, "message": "Notice posted successfully"}
