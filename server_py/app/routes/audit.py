from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/audit-logs", tags=["Audit"])

@router.get("")
def get_audit_logs(
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Stubbed audit logs to satisfy frontend request
    return [
        {"id": 1, "action": "SYSTEM_START", "user": "System", "timestamp": "2026-09-23T10:00:00Z"},
        {"id": 2, "action": "LOGIN", "user": current_user["name"], "timestamp": "2026-09-23T10:05:00Z"}
    ]
