from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import SosIncident, Student
from app.socket import sio

router = APIRouter(prefix="/api/sos", tags=["SOS Emergency"])

class SosCreate(BaseModel):
    room_no: Optional[str] = None

class SosStatusUpdate(BaseModel):
    status: str # 'ACKNOWLEDGED' | 'RESOLVED'

@router.get("")
def get_sos_incidents(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    incidents = db.query(SosIncident).order_by(SosIncident.id.desc()).limit(50).all()
    return incidents

@router.post("/trigger")
def trigger_sos(
    data: SosCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    incident = SosIncident(
        student_id=current_user["id"],
        student_name=current_user["name"],
        room_no=data.room_no or "N/A",
        status="OPEN",
        created_at=datetime.utcnow().isoformat()
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    
    # Emit socket event
    background_tasks.add_task(
        sio.emit, 
        "sos_alert", 
        {"student_name": current_user["name"], "room_no": incident.room_no, "incident_id": incident.id}
    )
    
    return {
        "success": True,
        "incident_id": incident.id,
        "message": "SOS Emergency triggered. Wardens notified!"
    }

@router.put("/{incident_id}/status")
def update_sos_status(
    incident_id: int,
    data: SosStatusUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    incident = db.query(SosIncident).filter(SosIncident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    incident.status = data.status
    if data.status == "RESOLVED":
        incident.resolved_by = current_user["id"]
        incident.resolved_at = datetime.utcnow().isoformat()
        
    db.commit()
    return {"success": True, "status": incident.status}
