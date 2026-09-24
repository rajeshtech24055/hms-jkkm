import io
import os
import json
import time
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
import qrcode
from app.database import get_db
from app.config import settings
from app.security import create_access_token, decode_token, get_password_hash
from app.dependencies import get_current_user, require_roles
from app.models.models import Student, Institution, Department, Room, EntryExitLog, User

router = APIRouter(prefix="/api/students", tags=["Students"])

class StudentCreate(BaseModel):
    reg_no: str
    name: str
    gender: str
    institution_id: int
    dept_id: int
    year: str
    batch: Optional[str] = "2024-2028"
    room_id: Optional[int] = None
    bed_no: Optional[int] = 1
    guardian_name: str
    guardian_phone: str = Field(pattern=r"^[0-9]{10}$")
    guardian_email: Optional[str] = None   # Optional — no input in form
    blood_group: str
    mobile: str = Field(pattern=r"^[0-9]{10}$")
    email: str = Field(pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    dob: Optional[str] = None

    @field_validator('guardian_email', 'email', 'guardian_phone', 'mobile', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        """Convert empty string to None so optional fields don't fail regex validation."""
        if v == '' or v is None:
            return None
        return v

class StudentUpdate(BaseModel):
    reg_no: Optional[str] = None
    name: Optional[str] = None
    gender: Optional[str] = None
    institution_id: Optional[int] = None
    dept_id: Optional[int] = None
    year: Optional[str] = None
    batch: Optional[str] = None
    room_id: Optional[int] = None
    bed_no: Optional[int] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = Field(default=None, pattern=r"^[0-9]{10}$")
    guardian_email: Optional[str] = Field(default=None, pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    blood_group: Optional[str] = None
    mobile: Optional[str] = Field(default=None, pattern=r"^[0-9]{10}$")
    email: Optional[str] = Field(default=None, pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    dob: Optional[str] = None  # Format: YYYY-MM-DD (HTML date input)

    @field_validator('guardian_email', 'email', 'guardian_phone', 'mobile', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v
class PromoteRequest(BaseModel):
    batch: Optional[str] = None
    from_year: Optional[str] = None
    to_year: str

class RoomAssign(BaseModel):
    room_id: Optional[int] = None

@router.get("")
def get_students(
    institution_id: Optional[int] = None,
    dept_id: Optional[int] = None,
    gender: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(
        Student,
        Institution.name.label("institution_name"),
        Institution.code.label("institution_code"),
        Department.name.label("dept_name"),
        Room.room_no,
        Room.block
    ).outerjoin(Institution, Student.institution_id == Institution.id)\
     .outerjoin(Department, Student.dept_id == Department.id)\
     .outerjoin(Room, Student.room_id == Room.id)\
     .order_by(Student.id.asc())

    if institution_id:
        query = query.filter(Student.institution_id == institution_id)
    if dept_id:
        query = query.filter(Student.dept_id == dept_id)
    if gender:
        query = query.filter(Student.gender == gender)

    # Tutor/HOD filtering
    if current_user["role"] == "TUTOR" and current_user.get("dept_id"):
        query = query.filter(Student.dept_id == current_user["dept_id"])
        if current_user.get("year"):
            query = query.filter(Student.year == current_user["year"])
    elif current_user["role"] == "HOD" and current_user.get("dept_id"):
        query = query.filter(Student.dept_id == current_user["dept_id"])
    elif current_user["role"] == "WARDEN" and current_user.get("gender"):
        query = query.filter(Student.gender == current_user["gender"])

    results = query.all()
    output = []
    for r in results:
        student, inst_name, inst_code, dept_name, room_no, block = r
        # Find last log direction
        last_log = db.query(EntryExitLog).filter(
            EntryExitLog.student_id == student.id,
            EntryExitLog.flagged == 0
        ).order_by(EntryExitLog.id.desc()).first()

        last_dir = last_log.direction if last_log else "IN"

        s_dict = {
            "id": student.id,
            "reg_no": student.reg_no,
            "name": student.name,
            "gender": student.gender,
            "institution_id": student.institution_id,
            "institution_name": inst_name,
            "institution_code": inst_code,
            "dept_id": student.dept_id,
            "dept_name": dept_name,
            "year": student.year,
            "batch": student.batch,
            "room_id": student.room_id,
            "room_no": room_no,
            "block": block,
            "bed_no": student.bed_no,
            "guardian_name": student.guardian_name,
            "guardian_phone": student.guardian_phone,
            "guardian_email": student.guardian_email,
            "blood_group": student.blood_group,
            "mobile": student.mobile,
            "email": student.email,
            "dob": student.dob,
            "photo_url": student.photo_url,
            "qr_token": student.qr_token,
            "active": student.active,
            "last_direction": last_dir
        }
        output.append(s_dict)
    return output

@router.get("/{student_id}")
def get_student(
    student_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    r = db.query(
        Student,
        Institution.name.label("institution_name"),
        Institution.code.label("institution_code"),
        Department.name.label("dept_name"),
        Room.room_no,
        Room.block
    ).outerjoin(Institution, Student.institution_id == Institution.id)\
     .outerjoin(Department, Student.dept_id == Department.id)\
     .outerjoin(Room, Student.room_id == Room.id)\
     .order_by(Student.id.asc())\
     .filter(Student.id == student_id).first()

    if not r:
        raise HTTPException(status_code=404, detail="Student not found")

    student, inst_name, inst_code, dept_name, room_no, block = r
    last_log = db.query(EntryExitLog).filter(
        EntryExitLog.student_id == student.id,
        EntryExitLog.flagged == 0
    ).order_by(EntryExitLog.id.desc()).first()

    return {
        "id": student.id,
        "reg_no": student.reg_no,
        "name": student.name,
        "gender": student.gender,
        "institution_id": student.institution_id,
        "institution_name": inst_name,
        "institution_code": inst_code,
        "dept_id": student.dept_id,
        "dept_name": dept_name,
        "year": student.year,
        "batch": student.batch,
        "room_id": student.room_id,
        "room_no": room_no,
        "block": block,
        "bed_no": student.bed_no,
        "guardian_name": student.guardian_name,
        "guardian_phone": student.guardian_phone,
        "guardian_email": student.guardian_email,
        "blood_group": student.blood_group,
        "mobile": student.mobile,
        "email": student.email,
        "dob": student.dob,
        "qr_token": student.qr_token,
        "photo_url": student.photo_url,
        "current_status": last_log.direction if last_log else "IN",
        "active": student.active
    }

@router.post("")
def create_student(
    data: StudentCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    qr_token = f"QR{data.reg_no.upper()}"

    # Default password = DOB in DDMMYYYY format, fallback to admin123
    default_password = "admin123"
    if data.dob:
        try:
            parts = data.dob.split("-")  # YYYY-MM-DD
            if len(parts) == 3:
                default_password = parts[2] + parts[1] + parts[0]  # DDMMYYYY
        except:
            pass
            
    if data.room_id:
        room = db.query(Room).filter(Room.id == data.room_id).first()
        if room:
            occupied = db.query(Student).filter(Student.room_id == data.room_id, Student.active == 1).count()
            if occupied >= room.capacity:
                raise HTTPException(status_code=400, detail=f"Room {room.room_no} is already full ({occupied}/{room.capacity})")

    student = Student(
        reg_no=data.reg_no.upper(),
        name=data.name,
        gender=data.gender,
        institution_id=data.institution_id,
        dept_id=data.dept_id,
        year=data.year,
        batch=data.batch,
        room_id=data.room_id,
        bed_no=data.bed_no or 1,
        guardian_name=data.guardian_name,
        guardian_phone=data.guardian_phone,
        guardian_email=data.guardian_email,
        blood_group=data.blood_group,
        mobile=data.mobile,
        email=data.email,
        dob=data.dob,
        qr_token=qr_token,
        active=1
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    # Create login account with DOB as password
    hashed_pwd = get_password_hash(default_password)
    user_acc = User(
        name=data.name,
        email=data.email,
        password_hash=hashed_pwd,
        role="STUDENT",
        institution_id=data.institution_id,
        dept_id=data.dept_id,
        year=data.year,
        gender=data.gender,
        phone=data.mobile
    )
    db.add(user_acc)
    db.commit()

    return {"id": student.id, "message": f"Student created. Default password: {default_password}"}

@router.put("/{student_id}")
def update_student(
    student_id: int,
    data: StudentUpdate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if data.room_id and data.room_id != student.room_id:
        room = db.query(Room).filter(Room.id == data.room_id).first()
        if room:
            occupied = db.query(Student).filter(Student.room_id == data.room_id, Student.active == 1).count()
            if occupied >= room.capacity:
                raise HTTPException(status_code=400, detail=f"Room {room.room_no} is already full ({occupied}/{room.capacity})")

    if data.reg_no is not None: student.reg_no = data.reg_no.upper()
    if data.name is not None: student.name = data.name
    if data.gender is not None: student.gender = data.gender
    if data.institution_id is not None: student.institution_id = data.institution_id
    if data.dept_id is not None: student.dept_id = data.dept_id
    if data.year is not None: student.year = data.year
    if data.batch is not None: student.batch = data.batch
    if data.room_id is not None: student.room_id = data.room_id
    if data.bed_no is not None: student.bed_no = data.bed_no
    if data.guardian_name is not None: student.guardian_name = data.guardian_name
    if data.guardian_phone is not None: student.guardian_phone = data.guardian_phone
    if data.guardian_email is not None: student.guardian_email = data.guardian_email
    if data.blood_group is not None: student.blood_group = data.blood_group
    if data.mobile is not None: student.mobile = data.mobile
    if data.email is not None: student.email = data.email
    if data.dob is not None: student.dob = data.dob

    # Sync User Account if it exists
    user_acc = db.query(User).filter(User.email == student.email, User.role == "STUDENT").first()
    if user_acc:
        user_acc.name = student.name
        user_acc.email = student.email
        user_acc.gender = student.gender
        user_acc.phone = student.mobile
        user_acc.institution_id = student.institution_id
        user_acc.dept_id = student.dept_id

    db.commit()
    return {"success": True, "message": "Student updated successfully"}

@router.delete("/{student_id}")
def delete_student(
    student_id: int,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    # Delete associated User account if it exists
    user_acc = db.query(User).filter(User.email == student.email, User.role == "STUDENT").first()
    if user_acc:
        db.delete(user_acc)
        
    db.delete(student)
    db.commit()
    return {"success": True, "message": "Student deleted successfully"}

@router.put("/{student_id}/room")
def assign_room(
    student_id: int,
    data: RoomAssign,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    if data.room_id:
        room = db.query(Room).filter(Room.id == data.room_id).first()
        if room:
            occupied = db.query(Student).filter(Student.room_id == data.room_id, Student.active == 1).count()
            if occupied >= room.capacity:
                raise HTTPException(status_code=400, detail=f"Room {room.room_no} is already full ({occupied}/{room.capacity})")
                
    student.room_id = data.room_id
    db.commit()
    return {"success": True, "message": "Room updated"}

@router.post("/{student_id}/vacate")
def vacate_student(
    student_id: int,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    student.active = 0
    student.room_id = None
    db.commit()
    return {"success": True, "message": "Student vacated"}

@router.post("/{student_id}/reactivate")
def reactivate_student(
    student_id: int,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    student.active = 1
    db.commit()
    return {"success": True, "message": "Student reactivated"}

@router.post("/promote")
def promote_students(
    req: PromoteRequest,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    query = db.query(Student).filter(Student.active == 1)
    if req.batch:
        query = query.filter(Student.batch == req.batch)
    if req.from_year:
        query = query.filter(Student.year == req.from_year)

    students = query.all()
    count = 0
    for s in students:
        s.year = req.to_year
        count += 1

    db.commit()
    return {"success": True, "promoted_count": count, "message": f"Promoted {count} students to {req.to_year}"}

@router.get("/{student_id}/qr")
def get_student_qr(
    student_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # DYNAMIC QR: 60-second JWT token
    dynamic_token = create_access_token(
        {"id": student.id, "reg_no": student.reg_no, "type": "GATE_PASS"}
    )
    qr_payload = json.dumps({"id": student.id, "reg": student.reg_no, "token": dynamic_token})

    # Generate QR Code image Base64/DataURL
    qr_img = qrcode.make(qr_payload)
    buffer = io.BytesIO()
    qr_img.save(buffer, "PNG")
    import base64
    b64_str = base64.b64encode(buffer.getvalue()).decode()
    data_url = f"data:image/png;base64,{b64_str}"

    return {"qr": data_url, "expiresAt": int(time.time() * 1000) + 60000}

@router.post("/{student_id}/photo")
def upload_student_photo(
    student_id: int, 
    photo: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    
    # Delete old photo if it exists
    if student.photo_url:
        old_file_name = student.photo_url.split("/")[-1]
        old_file_path = os.path.join(upload_dir, old_file_name)
        if os.path.exists(old_file_path):
            os.remove(old_file_path)
            
    file_extension = photo.filename.split(".")[-1]
    new_filename = f"student_{student_id}_{int(time.time())}.{file_extension}"
    file_path = os.path.join(upload_dir, new_filename)
    
    with open(file_path, "wb") as f:
        f.write(photo.file.read())
        
    student.photo_url = f"/uploads/{new_filename}"
    db.commit()
    return {"success": True, "photo_url": student.photo_url, "message": "Photo uploaded successfully"}
