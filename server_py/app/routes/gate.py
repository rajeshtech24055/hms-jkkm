from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.security import decode_token
from app.dependencies import get_current_user, require_roles
from app.models.models import Student, EntryExitLog, LeaveApplication, NotificationLog, Institution, Department
from app.socket import sio
from app.utils.push import notify_user

router = APIRouter(prefix="/api/gate", tags=["Gate Scanner"])

class ScanRequest(BaseModel):
    reg_no: str
    token: Optional[str] = None

@router.get("/log")
def get_gate_logs(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logs = db.query(
        EntryExitLog,
        Student.name,
        Student.reg_no,
        Student.gender,
        Institution.code.label("institution_code"),
        Department.name.label("dept_name")
    ).join(Student, EntryExitLog.student_id == Student.id)\
     .outerjoin(Institution, Student.institution_id == Institution.id)\
     .outerjoin(Department, Student.dept_id == Department.id)\
     .order_by(EntryExitLog.id.desc()).limit(100).all()

    output = []
    for l in logs:
        log, name, reg_no, gender, inst_code, dept_name = l
        output.append({
            "id": log.id,
            "student_id": log.student_id,
            "direction": log.direction,
            "authorized": log.authorized,
            "flagged": log.flagged,
            "flag_reason": log.flag_reason,
            "verification_method": log.verification_method or "QR",
            "created_at": log.created_at,
            "name": name,
            "reg_no": reg_no,
            "gender": gender,
            "institution_code": inst_code,
            "dept_name": dept_name
        })
    return output

@router.post("/scan")
def scan_gate(
    req: ScanRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "GATE_STAFF")),
    db: Session = Depends(get_db)
):
    reg_no = req.reg_no.strip().upper()
    token = req.token

    # 1. DYNAMIC QR VERIFICATION
    if token:
        decoded = decode_token(token)
        if not decoded or decoded.get("type") != "GATE_PASS" or decoded.get("reg_no", "").upper() != reg_no:
            return {"success": False, "reason": "QR Code tampered, expired or mismatch."}

    # 2. Find Student by reg_no or qr_token
    student = db.query(Student).filter(
        (func.upper(Student.reg_no) == reg_no) | (Student.qr_token == reg_no),
        Student.active == 1
    ).first()

    if not student:
        return {"success": False, "reason": "Student not found", "student": None}

    # 3. Determine Direction (IN vs OUT)
    last_log = db.query(EntryExitLog).filter(
        EntryExitLog.student_id == student.id,
        EntryExitLog.flagged == 0
    ).order_by(EntryExitLog.id.desc()).first()

    direction = "OUT" if (not last_log or last_log.direction == "IN") else "IN"
    
    from datetime import timedelta, datetime
    ist_now = datetime.utcnow() + timedelta(hours=5, minutes=30)
    now_str = ist_now.isoformat() # For saving precise logs with seconds
    cmp_str = ist_now.strftime("%Y-%m-%dT%H:%M") # For exact string comparison with leaves

    active_leave = None
    if direction == "OUT":
        # Check approved leave
        active_leave = db.query(LeaveApplication).filter(
            LeaveApplication.student_id == student.id,
            LeaveApplication.status == "approved",
            LeaveApplication.from_dt <= cmp_str,
            LeaveApplication.to_dt >= cmp_str
        ).first()

        if not active_leave:
            # Unauthorized exit attempt -> flag it
            log = EntryExitLog(
                student_id=student.id,
                direction="OUT",
                authorized=0,
                flagged=1,
                flag_reason="No approved leave",
                verification_method="QR",
                created_at=now_str
            )
            db.add(log)
            db.commit()
            
            # Emit flagged realtime update
            background_tasks.add_task(
                sio.emit,
                "gate_scan",
                {
                    "student_name": student.name,
                    "reg_no": student.reg_no,
                    "direction": "OUT",
                    "authorized": 0,
                    "dept_name": student.department.name if student.department else "",
                    "flag_reason": "No approved leave"
                }
            )
            
            # Send push notification to student phone
            notify_user(db, student.id, "Gate Scan Failed", "Unauthorized exit attempted - No approved leave.", {"type": "gate_scan"})
            
            
            return {
                "success": False,
                "reason": "No approved leave — Gate remains closed",
                "student": {"name": student.name, "reg_no": student.reg_no},
                "direction": "OUT"
            }

    # Record valid exit/entry
    log = EntryExitLog(
        student_id=student.id,
        direction=direction,
        authorized=1,
        flagged=0,
        verification_method="QR",
        created_at=now_str
    )
    db.add(log)

    notification_sent = None
    if direction == "OUT" and active_leave:
        active_leave.status = "used"
        parent_phone = student.guardian_phone or student.mobile or "9876501000"
        msg = f"ALERT: Your ward {student.name} ({student.reg_no}) checked OUT of JKKM Hostel."
        db.add(NotificationLog(
            recipient_phone=parent_phone,
            student_id=student.id,
            student_name=student.name,
            type="GATE_OUT",
            message=msg,
            status="SENT",
            sent_at=now_str
        ))
        notification_sent = {"recipient": parent_phone, "message": msg}
    elif direction == "IN":
        used_leave = db.query(LeaveApplication).filter(
            LeaveApplication.student_id == student.id,
            LeaveApplication.status == "used"
        ).order_by(LeaveApplication.id.desc()).first()
        if used_leave:
            used_leave.status = "completed"

    db.commit()
    
    # Notify Student
    if direction == "OUT":
        notify_user(db, student.id, "Checked Out", "You have successfully scanned OUT of the hostel.", {"type": "gate_scan"})
    else:
        notify_user(db, student.id, "Checked In", "You have successfully scanned IN to the hostel.", {"type": "gate_scan"})


    # Emit realtime update to dashboard
    background_tasks.add_task(
        sio.emit,
        "gate_scan",
        {
            "student_name": student.name,
            "reg_no": student.reg_no,
            "direction": direction,
            "authorized": 1,
            "dept_name": student.department.name if student.department else ""
        }
    )

    return {
        "success": True,
        "direction": direction,
        "student": {
            "id": student.id,
            "name": student.name,
            "reg_no": student.reg_no,
            "dept_name": student.department.name if student.department else ""
        },
        "notificationSent": notification_sent
    }

@router.get("/outside")
def get_outside_students(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find students whose latest log is OUT
    students = db.query(Student).filter(Student.active == 1).all()
    output = []
    for s in students:
        last_log = db.query(EntryExitLog).filter(
            EntryExitLog.student_id == s.id
        ).order_by(EntryExitLog.id.desc()).first()

        if last_log and last_log.direction == "OUT":
            output.append({
                "student_id": s.id,
                "name": s.name,
                "reg_no": s.reg_no,
                "dept_name": s.department.name if s.department else "",
                "guardian_phone": s.guardian_phone,
                "out_since": last_log.created_at,
                "flagged": last_log.flagged
            })
    return output
