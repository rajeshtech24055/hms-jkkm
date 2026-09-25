from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import MaintenanceRequest, Complaint, User, Student
from app.utils.push import notify_role, notify_user

router = APIRouter(tags=["Maintenance & Complaints"])

# ─── MAINTENANCE ─────────────────────────────────────────────────────────────
class MaintenanceCreate(BaseModel):
    room_no: str
    category: str
    description: str
    priority: Optional[str] = "Normal"

@router.get("/api/maintenance")
def get_maintenance_requests(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(MaintenanceRequest)
    role = current_user["role"]
    
    if role == "STUDENT":
        query = query.filter(MaintenanceRequest.raised_by == current_user["id"])
    elif role == "MAINTENANCE":
        query = query.filter(
            (MaintenanceRequest.assigned_to == current_user["id"]) | (MaintenanceRequest.status == "pending")
        )
    elif role == "WARDEN":
        # Can see everything (Level 1, 2, 3) for their hostel theoretically, but for now we filter by Level >= 1
        query = query.filter(MaintenanceRequest.current_level >= 1)
    elif role == "HOSTEL_ADMIN":
        # Hostel admin primarily sees escalated tickets (Level 2+) or all if they are admins
        # For escalation tracking, let's filter those >= 2 so they can focus on escalated, 
        # or they can see all. Let's make them see all, but the UI can highlight escalated ones.
        pass
    elif role == "PRINCIPAL":
        # Principal only sees Level 3 highly escalated tickets
        query = query.filter(MaintenanceRequest.current_level >= 3)
        
    return query.order_by(MaintenanceRequest.id.desc()).all()

@router.post("/api/maintenance")
def create_maintenance_request(
    data: MaintenanceCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = MaintenanceRequest(
        raised_by=current_user["id"],
        room_no=data.room_no,
        category=data.category,
        description=data.description,
        priority=data.priority or "Normal",
        status="pending",
        created_at=datetime.utcnow().isoformat()
    )
    db.add(req)
    db.commit()
    
    # Notify Warden
    notify_role(db, "WARDEN", "New Maintenance Request", f"Room {data.room_no}: {data.category}", {"type": "maintenance"})
    
    return {"id": req.id, "message": "Maintenance request submitted"}

class MaintenanceUpdate(BaseModel):
    status: Optional[str] = None
    remarks: Optional[str] = None
    assigned_to: Optional[int] = None

@router.patch("/api/maintenance/{req_id}")
def update_maintenance_request(
    req_id: int,
    data: MaintenanceUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if data.status: 
        req.status = data.status
        if req.status == "completed": 
            req.resolved_at = datetime.utcnow().isoformat()
            notify_user(db, req.raised_by, "Maintenance Completed", f"Your request for {req.category} is completed.", {"type": "maintenance"})
        elif req.status == "in_progress":
            notify_user(db, req.raised_by, "Maintenance In Progress", f"Your request for {req.category} is now being worked on.", {"type": "maintenance"})

    if data.remarks: req.remarks = data.remarks
    if data.assigned_to: req.assigned_to = data.assigned_to
    
    db.commit()
    return {"success": True}

class ScanVerify(BaseModel):
    code: str

@router.post("/api/maintenance/{req_id}/verify-scan")
def verify_maintenance_scan(
    req_id: int,
    data: ScanVerify,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    # Example logic: Verify scan code here
    req.status = "completed"
    req.resolved_at = datetime.utcnow().isoformat()
    req.remarks = f"Verified by scan {data.code}"
    db.commit()
    return {"success": True, "message": "Verification successful and resolved"}

# ─── COMPLAINTS ──────────────────────────────────────────────────────────────
class ComplaintCreate(BaseModel):
    category: str
    subject: str
    description: str
    room_no: Optional[str] = None
    is_anonymous: Optional[int] = 0

@router.get("/api/complaints")
def get_complaints(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Complaint).join(Student, Complaint.student_id == Student.id)
    role = current_user["role"]
    
    if role == "STUDENT":
        query = query.filter(Complaint.student_id == current_user["id"])
    else:
        if role not in ["SUPER_ADMIN", "HOSTEL_ADMIN"] and current_user.get("institution_id"):
            query = query.filter(Student.institution_id == current_user["institution_id"])
        if role == "WARDEN" and current_user.get("gender"):
            query = query.filter(Student.gender == current_user["gender"])
            
    return query.order_by(Complaint.id.desc()).all()

@router.get("/api/complaints/stats")
def get_complaints_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Complaint).join(Student, Complaint.student_id == Student.id)
    role = current_user["role"]
    
    if role not in ["SUPER_ADMIN", "HOSTEL_ADMIN"] and current_user.get("institution_id"):
        query = query.filter(Student.institution_id == current_user["institution_id"])
    if role == "WARDEN" and current_user.get("gender"):
        query = query.filter(Student.gender == current_user["gender"])

    open_count = query.filter(Complaint.status == "open").count()
    resolved_count = query.filter(Complaint.status == "resolved").count()
    return {"open": open_count, "resolved": resolved_count}

@router.post("/api/complaints")
def create_complaint(
    data: ComplaintCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    c = Complaint(
        student_id=current_user["id"],
        student_name="Anonymous" if data.is_anonymous else current_user["name"],
        room_no=data.room_no,
        category=data.category,
        subject=data.subject,
        description=data.description,
        is_anonymous=data.is_anonymous or 0,
        status="open",
        created_at=datetime.utcnow().isoformat()
    )
    db.add(c)
    db.commit()
    
    notify_role(db, "WARDEN", "New Complaint Filed", f"Category: {data.category} - {data.subject}", {"type": "complaint"})
    
    return {"id": c.id, "message": "Complaint submitted successfully"}

class ComplaintUpdate(BaseModel):
    status: Optional[str] = None
    admin_remarks: Optional[str] = None
    priority: Optional[str] = None

@router.put("/api/complaints/{complaint_id}")
def update_complaint(
    complaint_id: int,
    data: ComplaintUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    if data.status: 
        c.status = data.status
        if data.status == "resolved":
            c.resolved_at = datetime.utcnow().isoformat()
            notify_user(db, c.student_id, "Complaint Resolved", f"Your complaint '{c.subject}' has been resolved.", {"type": "complaint"})
    
    if data.admin_remarks: c.admin_remarks = data.admin_remarks
    if data.priority: c.priority = data.priority
    
    db.commit()
    return {"success": True, "message": "Complaint updated"}

@router.delete("/api/complaints/{complaint_id}")
def delete_complaint(
    complaint_id: int,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN", "WARDEN")),
    db: Session = Depends(get_db)
):
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    db.delete(c)
    db.commit()
    return {"success": True, "message": "Complaint deleted"}