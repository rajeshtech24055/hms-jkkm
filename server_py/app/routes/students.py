import io
import os
import json
import time
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
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
    guardian_phone: str
    guardian_email: str
    blood_group: str
    mobile: str
    email: str
    dob: Optional[str] = None  # Format: YYYY-MM-DD (HTML date input)

class PromoteRequest(BaseModel):
    batch: Optional[str] = None
    from_year: Optional[str] = None
    to_year: str

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
     .outerjoin(Room, Student.room_id == Room.id)

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
            "photo_url": student.photo_url,
            "qr_token": student.qr_token,
            "active": student.active,
            "last_direction": last_dir
        }
        output.append(s_dict)
    return output

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
    data: StudentCreate,
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

    student.reg_no = data.reg_no.upper()
    student.name = data.name
    student.gender = data.gender
    student.institution_id = data.institution_id
    student.dept_id = data.dept_id
    student.year = data.year
    if data.batch: student.batch = data.batch
    student.room_id = data.room_id
    student.bed_no = data.bed_no or 1
    student.guardian_name = data.guardian_name
    student.guardian_phone = data.guardian_phone
    student.guardian_email = data.guardian_email
    student.blood_group = data.blood_group
    student.mobile = data.mobile
    student.email = data.email
    if data.dob: student.dob = data.dob

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
