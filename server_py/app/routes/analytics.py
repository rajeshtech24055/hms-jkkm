from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import (
    Student, LeaveApplication, EntryExitLog, Room, Complaint,
    MaintenanceRequest, MessItem, MessUsageLog, MessFoodWastage,
    Department, Institution
)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/overview")
def get_analytics_overview(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    total_students = db.query(Student).filter(Student.active == 1).count()
    now_str = datetime.utcnow().isoformat()

    # Leaves
    pending_leaves = db.query(LeaveApplication).filter(LeaveApplication.status == "pending").count()
    approved_leaves = db.query(LeaveApplication).filter(
        LeaveApplication.status == "approved",
        LeaveApplication.from_dt <= now_str,
        LeaveApplication.to_dt >= now_str
    ).count()

    # Students outside
    students = db.query(Student).filter(Student.active == 1).all()
    outside_cnt = 0
    for s in students:
        last_log = db.query(EntryExitLog).filter(
            EntryExitLog.student_id == s.id
        ).order_by(EntryExitLog.id.desc()).first()
        if last_log and last_log.direction == "OUT":
            outside_cnt += 1

    total_rooms = db.query(Room).count()
    occupied_students = db.query(Student).filter(Student.active == 1, Student.room_id.isnot(None)).count()
    occ_pct = round((occupied_students / (total_rooms * 4 or 1)) * 100, 1)

    open_complaints = db.query(Complaint).filter(Complaint.status.in_(["open", "in_progress"])).count()
    expiring_items = db.query(MessItem).filter(MessItem.current_stock <= MessItem.reorder_level).count()

    # Leave trends (30 days)
    days_list = [(datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(29, -1, -1)]
    leave_trend = []
    for dt in days_list:
        cnt = db.query(LeaveApplication).filter(
            LeaveApplication.created_at.like(f"{dt}%")
        ).count()
        leave_trend.append({"date": dt, "count": cnt})

    # Complaints breakdown by category
    complaint_cats = db.query(
        Complaint.category,
        func.count(Complaint.id).label("count")
    ).group_by(Complaint.category).all()
    complaints_by_cat = [{"category": c[0], "count": c[1]} for c in complaint_cats]

    # Students by institution
    by_institution = []
    try:
        inst_counts = db.query(
            Institution.code,
            func.count(Student.id).label("count")
        ).join(Department, Department.institution_id == Institution.id
        ).join(Student, Student.department_id == Department.id
        ).filter(Student.active == 1
        ).group_by(Institution.code).all()
        by_institution = [{"code": row[0] or "Unknown", "count": row[1]} for row in inst_counts]
    except Exception:
        by_institution = []

    # Room occupancy by block
    rooms_by_block = []
    try:
        blocks = db.query(
            Room.block,
            func.count(Room.id).label("total_rooms"),
        ).group_by(Room.block).all()
        for block_row in blocks:
            block_name = block_row[0] or "Unknown"
            total = block_row[1]
            occupied = db.query(Student).filter(
                Student.active == 1,
                Student.room_id.isnot(None)
            ).join(Room, Room.id == Student.room_id
            ).filter(Room.block == block_name).count()
            rooms_by_block.append({
                "block": block_name,
                "total_rooms": total * 4,
                "occupied": occupied
            })
    except Exception:
        rooms_by_block = []

    return {
        "totalStudents": total_students,
        "pendingLeaves": pending_leaves,
        "approvedLeaves": approved_leaves,
        "studentsOutside": outside_cnt,
        "occupancyPct": occ_pct,
        "openComplaints": open_complaints,
        "expiringItems": expiring_items,
        "leaveTrend": leave_trend,
        "complaintsByCategory": complaints_by_cat,
        "byInstitution": by_institution,
        "roomsByBlock": rooms_by_block
    }
