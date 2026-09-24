from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import Hostel, Room, Student

router = APIRouter(prefix="/api/hostels", tags=["Hostels"])


class HostelCreate(BaseModel):
    name: str
    gender: str          # 'Male' or 'Female'
    description: Optional[str] = None


@router.get("")
def get_hostels(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all hostels with room/bed summary stats."""
    hostels = db.query(Hostel).order_by(Hostel.id.asc()).all()
    output = []
    for h in hostels:
        rooms = db.query(Room).filter(Room.hostel_id == h.id).all()
        total_beds = sum(r.capacity for r in rooms)
        occupied = db.query(func.count(Student.id)).filter(
            Student.room_id.in_([r.id for r in rooms]),
            Student.active == 1
        ).scalar() or 0
        output.append({
            "id": h.id,
            "name": h.name,
            "gender": h.gender,
            "description": h.description,
            "total_rooms": len(rooms),
            "total_beds": total_beds,
            "occupied": occupied,
            "available": total_beds - occupied,
            # Distinct blocks in this hostel
            "blocks": sorted(list(set(r.block for r in rooms if r.block))),
        })
    return output


@router.post("")
def create_hostel(
    data: HostelCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    hostel = Hostel(
        name=data.name,
        gender=data.gender,
        description=data.description
    )
    db.add(hostel)
    db.commit()
    db.refresh(hostel)
    return {"id": hostel.id, "message": "Hostel created successfully"}


@router.put("/{hostel_id}")
def update_hostel(
    hostel_id: int,
    data: HostelCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    hostel = db.query(Hostel).filter(Hostel.id == hostel_id).first()
    if not hostel:
        raise HTTPException(status_code=404, detail="Hostel not found")
    hostel.name = data.name
    hostel.gender = data.gender
    hostel.description = data.description
    db.commit()
    return {"success": True, "message": "Hostel updated successfully"}


@router.delete("/{hostel_id}")
def delete_hostel(
    hostel_id: int,
    current_user: dict = Depends(require_roles("SUPER_ADMIN")),
    db: Session = Depends(get_db)
):
    # Unlink rooms from this hostel (don't delete them)
    db.query(Room).filter(Room.hostel_id == hostel_id).update({"hostel_id": None})
    hostel = db.query(Hostel).filter(Hostel.id == hostel_id).first()
    if not hostel:
        raise HTTPException(status_code=404, detail="Hostel not found")
    db.delete(hostel)
    db.commit()
    return {"success": True, "message": "Hostel deleted and rooms unlinked"}
