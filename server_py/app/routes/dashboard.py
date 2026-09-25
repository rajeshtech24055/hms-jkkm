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
    # Base query filters
    student_filter = [Student.active == 1]
    room_filter = []
    leave_filter = [LeaveApplication.status == "approved"]
    complaint_filter = [Complaint.status.in_(["open", "in_progress"])]
    ticket_filter = [MaintenanceRequest.status.in_(["pending", "in_progress"])]

    # Institution isolation (except for SUPER_ADMIN / HOSTEL_ADMIN)
    if current_user["role"] not in ["SUPER_ADMIN", "HOSTEL_ADMIN"] and current_user.get("institution_id"):
        student_filter.append(Student.institution_id == current_user["institution_id"])
        room_filter.append(Room.institution_id == current_user["institution_id"])
        
    # Role specific constraints
    if current_user["role"] == "WARDEN" and current_user.get("gender"):
        student_filter.append(Student.gender == current_user["gender"])
        room_filter.append(Room.gender == current_user["gender"])

    total_students_q = db.query(Student).filter(*student_filter)
    total_students = total_students_q.count()
    
    now_str = datetime.utcnow().isoformat()
    leave_filter.extend([LeaveApplication.from_dt <= now_str, LeaveApplication.to_dt >= now_str])
    
    # We should really join LeaveApplication with Student to apply student_filters, but for simplicity:
    on_leave = db.query(LeaveApplication).join(Student).filter(
        *leave_filter, 
        *( [Student.gender == current_user["gender"]] if current_user["role"] == "WARDEN" and current_user.get("gender") else [] ),
        *( [Student.institution_id == current_user["institution_id"]] if current_user["role"] not in ["SUPER_ADMIN", "HOSTEL_ADMIN"] and current_user.get("institution_id") else [] )
    ).count()

    outside_cnt = 0
    for s in total_students_q.all():
        last_log = db.query(EntryExitLog).filter(
            EntryExitLog.student_id == s.id,
            EntryExitLog.flagged == 0
        ).order_by(EntryExitLog.id.desc()).first()
        if last_log and last_log.direction == "OUT":
            outside_cnt += 1

    open_complaints = db.query(Complaint).filter(*complaint_filter).count()
    open_tickets = db.query(MaintenanceRequest).filter(*ticket_filter).count()
    active_sos = db.query(SosIncident).filter(SosIncident.status == "OPEN").count()

    total_rooms = db.query(Room).filter(*room_filter).count()
    total_capacity = db.query(func.sum(Room.capacity)).filter(*room_filter).scalar() or 1
    occupied_students = total_students_q.filter(Student.room_id.isnot(None)).count()

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
            "occupancy_rate_pct": round((occupied_students / total_capacity) * 100, 1)
        }
    }
