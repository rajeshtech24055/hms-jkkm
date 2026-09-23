from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.database import get_db
from app.security import get_password_hash
from app.dependencies import get_current_user, require_roles
from app.models.models import User, Institution, Department

router = APIRouter(prefix="/api/users", tags=["Users"])

class UserCreate(BaseModel):
    name: str
    email: str = Field(pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    password: str
    role: str
    institution_id: Optional[int] = None
    dept_id: Optional[int] = None
    year: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = Field(default=None, pattern=r"^[0-9]{10}$")

class UserUpdate(BaseModel):
    name: str
    email: str = Field(pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    password: Optional[str] = None
    role: str
    institution_id: Optional[int] = None
    dept_id: Optional[int] = None
    year: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = Field(default=None, pattern=r"^[0-9]{10}$")

@router.get("")
def get_users(
    role: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(
        User,
        Institution.name.label("institution_name"),
        Department.name.label("dept_name")
    ).outerjoin(Institution, User.institution_id == Institution.id)\
     .outerjoin(Department, User.dept_id == Department.id)

    if role:
        query = query.filter(User.role == role)

    users = query.all()
    output = []
    for u in users:
        usr, inst_name, dept_name = u
        output.append({
            "id": usr.id,
            "name": usr.name,
            "email": usr.email,
            "role": usr.role,
            "institution_id": usr.institution_id,
            "institution_name": inst_name,
            "dept_id": usr.dept_id,
            "dept_name": dept_name,
            "year": usr.year,
            "gender": usr.gender,
            "phone": usr.phone,
            "active": usr.active
        })
    return output

@router.get("/staff")
def get_staff_users(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    staff = db.query(User).filter(
        User.role.in_(["MAINTENANCE", "MESS_WORKER", "GATE_STAFF", "WARDEN"])
    ).all()
    return [{"id": u.id, "name": u.name, "role": u.role} for u in staff]

@router.post("")
def create_user(
    data: UserCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=data.name,
        email=data.email,
        password_hash=get_password_hash(data.password),
        role=data.role,
        institution_id=data.institution_id,
        dept_id=data.dept_id,
        year=data.year,
        gender=data.gender,
        phone=data.phone,
        active=1
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "message": "User created successfully"}

@router.put("/{user_id}")
def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.name = data.name
    user.email = data.email
    if data.password:
        user.password_hash = get_password_hash(data.password)
    user.role = data.role
    user.institution_id = data.institution_id
    user.dept_id = data.dept_id
    user.year = data.year
    user.gender = data.gender
    user.phone = data.phone
    
    db.commit()
    return {"success": True, "message": "User updated successfully"}

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.delete(user)
    db.commit()
    return {"success": True, "message": "User deleted"}
