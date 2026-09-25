from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import (
    LeaveApplication, LeaveApproval, Student, User,
    Institution, Department, NotificationLog, EntryExitLog
)
from app.utils.push import notify_role, notify_user

router = APIRouter(prefix="/api/leaves", tags=["Leaves"])

LEVEL_ROLE_LABEL = {
    1: ("Warden",    "WARDEN"),
    2: ("Tutor",     "TUTOR"),
    3: ("HOD",       "HOD"),
    4: ("Principal", "PRINCIPAL"),
}

def _get_approver_phone(db: Session, role: str, student: Student) -> str:
    """Find phone number of the relevant staff for the student's institution/dept/gender."""
    query = db.query(User).filter(
        User.role == role,
        User.active == 1,
        User.institution_id == student.institution_id
    )
    if role in ("TUTOR", "HOD") and student.dept_id:
        query = query.filter(User.dept_id == student.dept_id)
    if role == "WARDEN" and student.gender:
        query = query.filter(User.gender == student.gender)
    user = query.first()
    return user.phone if (user and user.phone) else "N/A"

def _notify_parent(db: Session, student: Student, notif_type: str, message: str):
    """Create a NotificationLog entry for the parent/guardian."""
    guardian_phone = student.guardian_phone or student.mobile
    if not guardian_phone:
        return
    db.add(NotificationLog(
        recipient_phone=guardian_phone,
        student_id=student.id,
        student_name=student.name,
        type=notif_type,
        message=message,
        status="SENT",
        sent_at=datetime.utcnow().isoformat()
    ))


class LeaveCreate(BaseModel):
    student_id: int
    type: str
    reason: str
    from_dt: str
    to_dt: str
    place: str
    is_emergency: Optional[int] = 0

class ApprovalDecision(BaseModel):
    decision: str  # 'approve' | 'reject'
    reason: Optional[str] = None



@router.get("")
def get_leaves(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(
        LeaveApplication,
        Student.name.label("student_name"),
        Student.reg_no,
        Student.gender,
        Student.year,
        Department.name.label("dept_name"),
        Institution.code.label("institution_code")
    ).join(Student, LeaveApplication.student_id == Student.id)\
     .outerjoin(Department, Student.dept_id == Department.id)\
     .outerjoin(Institution, Student.institution_id == Institution.id)

    if status:
        query = query.filter(LeaveApplication.status == status)

    role = current_user["role"]
    
    # Institution isolation (except for super/hostel admins)
    if role not in ["SUPER_ADMIN", "HOSTEL_ADMIN"] and current_user.get("institution_id"):
        query = query.filter(Student.institution_id == current_user["institution_id"])

    if role == "STUDENT":
        query = query.filter(LeaveApplication.student_id == current_user["id"])
    elif role == "TUTOR" and current_user.get("dept_id"):
        query = query.filter(Student.dept_id == current_user["dept_id"])
        if current_user.get("year"):
            query = query.filter(Student.year == current_user["year"])
    elif role == "HOD" and current_user.get("dept_id"):
        query = query.filter(Student.dept_id == current_user["dept_id"])
    elif role == "WARDEN" and current_user.get("gender"):
        query = query.filter(Student.gender == current_user["gender"])

    results = query.order_by(LeaveApplication.id.desc()).all()
    output = []
    for r in results:
        leave, name, reg_no, gender, year, dept_name, inst_code = r
        approvals = db.query(LeaveApproval).filter(LeaveApproval.application_id == leave.id).all()
        output.append({
            "id": leave.id,
            "student_id": leave.student_id,
            "student_name": name,
            "reg_no": reg_no,
            "gender": gender,
            "year": year,
            "dept_name": dept_name,
            "institution_code": inst_code,
            "type": leave.type,
            "reason": leave.reason,
            "from_dt": leave.from_dt,
            "to_dt": leave.to_dt,
            "place": leave.place,
            "is_emergency": leave.is_emergency,
            "status": leave.status,
            "current_level": leave.current_level,
            "created_at": leave.created_at,
            "approvals": [
                {"level": a.level, "decision": a.decision, "reason": a.reason}
                for a in approvals
            ]
        })
    return output


@router.post("")
def apply_leave(
    data: LeaveCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Check if student is currently outside
    last_log = db.query(EntryExitLog).filter(
        EntryExitLog.student_id == student.id,
        EntryExitLog.flagged == 0
    ).order_by(EntryExitLog.id.desc()).first()
    
    if last_log and last_log.direction == "OUT":
        raise HTTPException(status_code=400, detail="You cannot apply for a leave while you are currently outside the hostel.")

    leave = LeaveApplication(
        student_id=data.student_id,
        type=data.type,
        reason=data.reason,
        from_dt=data.from_dt,
        to_dt=data.to_dt,
        place=data.place,
        is_emergency=data.is_emergency or 0,
        status="pending",
        current_level=1,  # Starts at Warden
        created_at=datetime.utcnow().isoformat()
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)

    # ── Parent notification on submission ─────────────────────────────────
    warden_phone = _get_approver_phone(db, "WARDEN", student)
    emergency_note = "🚨 EMERGENCY LEAVE — " if data.is_emergency else ""
    msg = (
        f"{emergency_note}Dear Parent/Guardian of {student.name},\n\n"
        f"A {data.type} leave application has been submitted by your ward "
        f"{student.name} ({student.reg_no}).\n\n"
        f"  📅 From      : {data.from_dt[:10]}\n"
        f"  📅 To        : {data.to_dt[:10]}\n"
        f"  📍 Destination: {data.place}\n"
        f"  📝 Reason    : {data.reason}\n\n"
        f"This request is now pending Warden approval.\n"
        f"📞 If you have any objection, please call the Warden: {warden_phone}"
    )
    _notify_parent(db, student, "LEAVE_SUBMITTED", msg)

    # Alert warden for emergency
    if data.is_emergency:
        db.add(NotificationLog(
            recipient_phone=warden_phone,
            student_id=student.id,
            student_name=student.name,
            type="EMERGENCY_LEAVE",
            message=f"🚨 EMERGENCY LEAVE requested by {student.name} ({student.reg_no}). Reason: {data.reason}. Immediate review required."
        ))

    # Push Notification to Warden
    notify_role(db, "WARDEN", "Leave Request", f"New leave requested by {student.name}", {"type": "leave"})

    db.commit()
    return {"id": leave.id, "status": leave.status, "message": "Leave submitted. Parent notified."}


@router.post("/{leave_id}/approve")
def approve_leave(
    leave_id: int,
    data: ApprovalDecision,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    leave = db.query(LeaveApplication).filter(LeaveApplication.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave application not found")

    student = db.query(Student).filter(Student.id == leave.student_id).first()

    role = current_user["role"]
    level_map = {"WARDEN": 1, "TUTOR": 2, "HOD": 3, "PRINCIPAL": 4, "SUPER_ADMIN": 4, "HOSTEL_ADMIN": 4}
    level = level_map.get(role, 1)
    approver_label = LEVEL_ROLE_LABEL.get(level, (role, role))[0]
    approver_name = current_user.get("name", approver_label)
    approver_phone = current_user.get("phone") or (_get_approver_phone(db, role, student) if student else "N/A")

    # Record the approval/rejection entry
    approval = LeaveApproval(
        application_id=leave.id,
        approver_id=current_user["id"],
        level=level,
        decision=data.decision,
        reason=data.reason or "",
        created_at=datetime.utcnow().isoformat()
    )
    db.add(approval)

    if data.decision == "reject":
        leave.status = "rejected"

        # ── Notify parent: REJECTED ─────────────────────────────────────
        if student:
            msg = (
                f"❌ Dear Parent/Guardian of {student.name},\n\n"
                f"The leave application for your ward {student.name} ({student.reg_no}) "
                f"has been REJECTED by the {approver_label} ({approver_name}).\n\n"
                f"  📅 {leave.from_dt[:10]} to {leave.to_dt[:10]}\n"
                f"  🗒️ Leave Type: {leave.type}\n"
                f"  ❌ Reason: {data.reason or 'Not specified'}\n\n"
                f"📞 To discuss, contact the {approver_label}: {approver_phone}"
            )
            _notify_parent(db, student, "LEAVE_REJECTED", msg)
        
        # Push notification to student
        notify_user(db, leave.student_id, "Leave Rejected", f"Your leave was rejected by {approver_name}.", {"type": "leave"})

    else:  # approved at this level
        if level >= 4:
            leave.status = "approved"

            # ── Notify parent: FULLY APPROVED ──────────────────────────
            if student:
                msg = (
                    f"✅ Dear Parent/Guardian of {student.name},\n\n"
                    f"The leave application for your ward {student.name} ({student.reg_no}) "
                    f"has been FULLY APPROVED by all authorities.\n\n"
                    f"  📅 From      : {leave.from_dt[:10]}\n"
                    f"  📅 To        : {leave.to_dt[:10]}\n"
                    f"  📍 Destination: {leave.place}\n"
                    f"  🗒️ Leave Type : {leave.type}\n\n"
                    f"If you have any concerns, contact:\n"
                    f"  📞 Warden   : {_get_approver_phone(db, 'WARDEN', student)}\n"
                    f"  📞 Tutor    : {_get_approver_phone(db, 'TUTOR', student)}\n"
                    f"  📞 HOD      : {_get_approver_phone(db, 'HOD', student)}\n"
                    f"  📞 Principal: {_get_approver_phone(db, 'PRINCIPAL', student)}"
                )
                _notify_parent(db, student, "LEAVE_APPROVED", msg)
            
            # Push notification to student
            notify_user(db, leave.student_id, "Leave Fully Approved", f"Your leave has been fully approved.", {"type": "leave"})
            
        else:
            leave.current_level = level + 1
            next_label, next_role = LEVEL_ROLE_LABEL[level + 1]
            
            # Push notification to the next approver
            notify_role(db, next_role, "Leave Request Forwarded", f"Leave forwarded to you for {student.name}", {"type": "leave"})
            next_phone = _get_approver_phone(db, next_role, student) if student else "N/A"

            # ── Notify parent: forwarded to next level ──────────────────
            if student:
                msg = (
                    f"ℹ️ Dear Parent/Guardian of {student.name},\n\n"
                    f"The leave application for your ward {student.name} ({student.reg_no}) "
                    f"has been approved by the {approver_label} and is now forwarded to the {next_label}.\n\n"
                    f"  📅 {leave.from_dt[:10]} to {leave.to_dt[:10]}\n"
                    f"  📍 Destination: {leave.place}\n"
                    f"  🗒️ Type: {leave.type}\n\n"
                    f"⚠️ If you wish to OBJECT to this leave, call NOW:\n"
                    f"  📞 {next_label} (next approver): {next_phone}\n"
                    f"  📞 {approver_label} (approved this level): {approver_phone}"
                )
                _notify_parent(db, student, "LEAVE_FORWARDED", msg)

    db.commit()
    return {"success": True, "status": leave.status}


@router.post("/bulk-approve")
def bulk_approve(
    data: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ids = data.get("ids", [])
    decision = data.get("decision", "approve")
    reason = data.get("reason", "")
    count = 0
    for leave_id in ids:
        try:
            approve_leave(
                leave_id=leave_id,
                data=ApprovalDecision(decision=decision, reason=reason),
                current_user=current_user,
                db=db
            )
            count += 1
        except Exception:
            pass
    return {"success": True, "count": count}



@router.post("/{leave_id}/cancel")
def cancel_leave(
    leave_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    leave = db.query(LeaveApplication).filter(LeaveApplication.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if current_user["role"] == "STUDENT" and leave.student_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    student = db.query(Student).filter(Student.id == leave.student_id).first()
    leave.status = "cancelled"

    if student:
        msg = (
            f"ℹ️ Dear Parent/Guardian of {student.name},\n\n"
            f"The leave application for your ward {student.name} ({student.reg_no}) "
            f"({leave.from_dt[:10]} to {leave.to_dt[:10]}, {leave.type}) "
            f"has been CANCELLED.\n"
            f"Your ward will continue to stay in the hostel."
        )
        _notify_parent(db, student, "LEAVE_CANCELLED", msg)

    db.commit()
    return {"success": True, "message": "Leave cancelled. Parent notified."}
