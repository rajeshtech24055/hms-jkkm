from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import Room, Student, Institution, Department, EntryExitLog, Hostel

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])


class RoomCreate(BaseModel):
    room_no: str
    block: Optional[str] = None
    floor: Optional[int] = 1
    capacity: Optional[int] = 4
    gender: str
    hostel_id: Optional[int] = None
    institution_id: Optional[int] = None  # kept for student assignment compatibility


@router.get("")
def get_rooms(
    hostel_id: Optional[int] = None,
    block: Optional[str] = None,
    floor: Optional[int] = None,
    gender: Optional[str] = None,
    institution_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(
        Room,
        Institution.name.label("institution_name"),
        Institution.code.label("institution_code"),
        Hostel.name.label("hostel_name"),
        Hostel.gender.label("hostel_gender"),
        func.count(Student.id).label("occupied")
    ).outerjoin(Institution, Room.institution_id == Institution.id)\
     .outerjoin(Hostel, Room.hostel_id == Hostel.id)\
     .outerjoin(Student, (Student.room_id == Room.id) & (Student.active == 1))\
     .group_by(Room.id, Institution.name, Institution.code, Hostel.name, Hostel.gender)\
     .order_by(Room.hostel_id.asc(), Room.block.asc(), Room.floor.asc(), Room.room_no.asc())

    if hostel_id:
        query = query.filter(Room.hostel_id == hostel_id)
    if block:
        query = query.filter(Room.block == block)
    if floor is not None:
        query = query.filter(Room.floor == floor)
    if institution_id:
        query = query.filter(Room.institution_id == institution_id)
    if gender:
        query = query.filter(Room.gender == gender)
        
    if current_user["role"] not in ["SUPER_ADMIN", "HOSTEL_ADMIN"]:
        if current_user.get("institution_id"):
            query = query.filter((Room.institution_id == current_user["institution_id"]) | (Room.institution_id == None))
        if current_user.get("gender") and current_user["role"] == "WARDEN":
            query = query.filter(Room.gender == current_user["gender"])

    results = query.all()
    output = []
    for r in results:
        room, inst_name, inst_code, hostel_name, hostel_gender, occupied = r
        output.append({
            "id": room.id,
            "room_no": room.room_no,
            "block": room.block,
            "floor": room.floor,
            "capacity": room.capacity,
            "gender": room.gender,
            "hostel_id": room.hostel_id,
            "hostel_name": hostel_name,
            "hostel_gender": hostel_gender,
            "institution_id": room.institution_id,
            "institution_name": inst_name,
            "institution_code": inst_code,
            "occupied": occupied or 0
        })
    return output


@router.get("/{room_id}/students")
def get_room_students(
    room_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(
        Student,
        Institution.code.label("institution_code"),
        Department.name.label("dept_name")
    ).outerjoin(Institution, Student.institution_id == Institution.id)\
     .outerjoin(Department, Student.dept_id == Department.id)\
     .filter(Student.room_id == room_id, Student.active == 1)

    if current_user["role"] not in ["SUPER_ADMIN", "HOSTEL_ADMIN"] and current_user.get("institution_id"):
        query = query.filter(Student.institution_id == current_user["institution_id"])

    students = query.all()

    output = []
    for r in students:
        student, inst_code, dept_name = r
        last_log = db.query(EntryExitLog).filter(
            EntryExitLog.student_id == student.id,
            EntryExitLog.flagged == 0
        ).order_by(EntryExitLog.id.desc()).first()

        last_dir = last_log.direction if last_log else "IN"

        output.append({
            "id": student.id,
            "reg_no": student.reg_no,
            "name": student.name,
            "gender": student.gender,
            "institution_code": inst_code,
            "dept_name": dept_name,
            "year": student.year,
            "bed_no": student.bed_no,
            "mobile": student.mobile,
            "guardian_phone": student.guardian_phone,
            "last_direction": last_dir
        })
    return output


@router.post("")
def create_room(
    data: RoomCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    room = Room(
        room_no=data.room_no,
        block=data.block,
        floor=data.floor,
        capacity=data.capacity,
        gender=data.gender,
        hostel_id=data.hostel_id,
        institution_id=data.institution_id
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return {"id": room.id, "message": "Room created successfully"}


@router.put("/{room_id}")
def update_room(
    room_id: int,
    data: RoomCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    try:
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        room.room_no = data.room_no
        room.block = data.block
        room.floor = data.floor
        room.capacity = data.capacity
        room.gender = data.gender
        room.hostel_id = data.hostel_id
        room.institution_id = data.institution_id
        db.commit()
        return {"success": True, "message": "Room updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{room_id}")
def delete_room(
    room_id: int,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    try:
        # Unassign students
        db.query(Student).filter(Student.room_id == room_id).update({"room_id": None})
        room = db.query(Room).filter(Room.id == room_id).first()
        if room:
            db.delete(room)
            db.commit()
        return {"success": True, "message": "Room deleted and students unassigned"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
