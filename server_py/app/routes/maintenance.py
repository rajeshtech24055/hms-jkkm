from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import MaintenanceRequest, Complaint, User, Student

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
    if current_user["role"] == "MAINTENANCE":
        query = query.filter(
            (MaintenanceRequest.assigned_to == current_user["id"]) | (MaintenanceRequest.status == "pending")
        )
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
    return {"id": req.id, "message": "Maintenance request submitted"}

@router.put("/api/maintenance/{req_id}")
def update_maintenance_request(
    req_id: int,
    status: Optional[str] = None,
    remarks: Optional[str] = None,
    assigned_to: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if status: req.status = status
    if remarks: req.remarks = remarks
    if assigned_to: req.assigned_to = assigned_to
    if status == "completed": req.resolved_at = datetime.utcnow().isoformat()
    db.commit()
    return {"success": True}

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
    query = db.query(Complaint)
    if current_user["role"] == "STUDENT":
        query = query.filter(Complaint.student_id == current_user["id"])
    return query.order_by(Complaint.id.desc()).all()

@router.get("/api/complaints/stats")
def get_complaints_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    open_count = db.query(Complaint).filter(Complaint.status == "open").count()
    resolved_count = db.query(Complaint).filter(Complaint.status == "resolved").count()
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
    return {"id": c.id, "message": "Complaint submitted successfully"}
