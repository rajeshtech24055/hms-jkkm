from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import HostelVacateRequest, Student, Department, Institution
from app.utils.push import notify_role, notify_user

router = APIRouter(prefix="/api/vacate", tags=["Vacate Requests"])

class VacateCreate(BaseModel):
    student_id: int
    reason: str
    vacate_date: str
    parent_phone: Optional[str] = None

class ClearanceAction(BaseModel):
    has_damage: Optional[int] = 0
    damage_description: Optional[str] = None
    fine_amount: Optional[float] = 0.0
    fine_paid: Optional[int] = 0
    remarks: Optional[str] = None

@router.get("")
def get_vacate_requests(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(
        HostelVacateRequest,
        Student.name.label("student_name"),
        Student.reg_no,
        Student.gender,
        Student.mobile,
        Department.name.label("dept_name"),
        Institution.code.label("institution_code")
    ).join(Student, HostelVacateRequest.student_id == Student.id)\
     .outerjoin(Department, Student.dept_id == Department.id)\
     .outerjoin(Institution, Student.institution_id == Institution.id)

    role = current_user["role"]
    if role == "STUDENT":
        query = query.filter(HostelVacateRequest.student_id == current_user["id"])
    elif role == "WARDEN" and current_user.get("gender"):
        query = query.filter(Student.gender == current_user["gender"])

    results = query.order_by(HostelVacateRequest.id.desc()).all()
    output = []
    for r in results:
        v, s_name, reg_no, gender, mobile, dept_name, inst_code = r
        output.append({
            "id": v.id,
            "student_id": v.student_id,
            "student_name": s_name,
            "reg_no": reg_no,
            "gender": gender,
            "mobile": mobile,
            "dept_name": dept_name,
            "institution_code": inst_code,
            "reason": v.reason,
            "vacate_date": v.vacate_date,
            "parent_phone": v.parent_phone,
            "status": v.status,
            "has_damage": v.has_damage,
            "damage_description": v.damage_description,
            "fine_amount": v.fine_amount,
            "fine_paid": v.fine_paid,
            "warden_remarks": v.warden_remarks,
            "principal_remarks": v.principal_remarks,
            "created_at": v.created_at
        })
    return output

@router.post("")
def create_vacate_request(
    data: VacateCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    v = HostelVacateRequest(
        student_id=data.student_id,
        reason=data.reason,
        vacate_date=data.vacate_date,
        parent_phone=data.parent_phone,
        status="PENDING_WARDEN",
        created_at=datetime.utcnow().isoformat()
    )
    db.add(v)
    db.commit()
    
    notify_role(db, "WARDEN", "Vacate Request", "A new hostel vacate request was submitted.", {"type": "vacate"})
    
    return {"id": v.id, "message": "Vacate clearance request submitted"}

@router.post("/{vacate_id}/warden")
def warden_clearance(
    vacate_id: int,
    data: ClearanceAction,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "WARDEN")),
    db: Session = Depends(get_db)
):
    v = db.query(HostelVacateRequest).filter(HostelVacateRequest.id == vacate_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Request not found")

    v.has_damage = data.has_damage or 0
    v.damage_description = data.damage_description
    v.fine_amount = data.fine_amount or 0.0
    v.fine_paid = data.fine_paid or 0
    v.warden_remarks = data.remarks
    v.status = "PENDING_PRINCIPAL"
    db.commit()
    
    notify_role(db, "PRINCIPAL", "Vacate Clearance", "A vacate request requires Principal clearance.", {"type": "vacate"})
    
    return {"success": True, "status": v.status}

@router.post("/{vacate_id}/principal")
def principal_clearance(
    vacate_id: int,
    data: ClearanceAction,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "PRINCIPAL")),
    db: Session = Depends(get_db)
):
    v = db.query(HostelVacateRequest).filter(HostelVacateRequest.id == vacate_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Request not found")

    v.principal_remarks = data.remarks
    v.status = "APPROVED"

    # Vacate the student (mark inactive & unassign room)
    student = db.query(Student).filter(Student.id == v.student_id).first()
    if student:
        student.room_id = None
        student.active = 0

    db.commit()
    
    notify_user(db, v.student_id, "Vacate Approved", "Your hostel vacate request has been fully approved.", {"type": "vacate"})
    
    return {"success": True, "status": v.status}
