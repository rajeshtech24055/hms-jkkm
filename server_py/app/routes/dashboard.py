from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import (
    Student, LeaveApplication, EntryExitLog, Room, Complaint,
    MaintenanceRequest, SosIncident, DailySnapshot
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("")
def get_dashboard_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    total_students = db.query(Student).filter(Student.active == 1).count()
    now_str = datetime.utcnow().isoformat()

    # Leaves on-going
    on_leave = db.query(LeaveApplication).filter(
        LeaveApplication.status == "approved",
        LeaveApplication.from_dt <= now_str,
        LeaveApplication.to_dt >= now_str
    ).count()

    # Students outside count
    students = db.query(Student).filter(Student.active == 1).all()
    outside_cnt = 0
    for s in students:
        last_log = db.query(EntryExitLog).filter(
            EntryExitLog.student_id == s.id
        ).order_by(EntryExitLog.id.desc()).first()
        if last_log and last_log.direction == "OUT":
            outside_cnt += 1

    open_complaints = db.query(Complaint).filter(Complaint.status.in_(["open", "in_progress"])).count()
    open_tickets = db.query(MaintenanceRequest).filter(MaintenanceRequest.status.in_(["pending", "in_progress"])).count()
    active_sos = db.query(SosIncident).filter(SosIncident.status == "OPEN").count()

    total_rooms = db.query(Room).count()
    occupied_students = db.query(Student).filter(Student.active == 1, Student.room_id.isnot(None)).count()

    return {
        "stats": {
            "total_students": total_students,
            "on_leave": on_leave,
            "outside_now": outside_cnt,
            "inside_now": max(0, total_students - on_leave - outside_cnt),
            "open_complaints": open_complaints,
            "open_tickets": open_tickets,
            "active_sos": active_sos,
            "total_rooms": total_rooms,
            "occupied_students": occupied_students,
            "occupancy_rate_pct": round((occupied_students / (total_rooms * 4 or 1)) * 100, 1)
        }
    }
