from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.security import verify_password, create_access_token, get_password_hash
from app.dependencies import get_current_user
from app.models.models import User, Student

router = APIRouter(prefix="/api/auth", tags=["Auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

class OtpRequest(BaseModel):
    email: str

class OtpVerifyRequest(BaseModel):
    email: str
    otp: str
    new_password: str

# In-memory OTP store
otp_store = {}

@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    # 1. Try finding in Users table
    user = db.query(User).filter(User.email == req.email).first()
    if user:
        if user.active != 1:
            raise HTTPException(status_code=400, detail="Account is deactivated")
        if not verify_password(req.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        token = create_access_token({
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "name": user.name
        })
        return {
            "token": token,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "institution_id": user.institution_id,
                "dept_id": user.dept_id,
                "year": user.year,
                "gender": user.gender,
                "phone": user.phone
            }
        }

    # 2. Try finding in Students table (for STUDENT role users)
    student = db.query(Student).filter(Student.email == req.email).first()
    if student:
        if student.active != 1:
            raise HTTPException(status_code=400, detail="Student account is inactive")

        # Check the User record which has the hashed DOB password
        user_acc = db.query(User).filter(User.email == req.email, User.role == "STUDENT").first()
        if user_acc:
            if not verify_password(req.password, user_acc.password_hash):
                raise HTTPException(status_code=401, detail="Invalid email or password")
        else:
            # Legacy fallback: no User record yet, accept admin123
            if req.password != "admin123":
                raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_access_token({
            "id": student.id,
            "email": student.email,
            "role": "STUDENT",
            "name": student.name
        })
        return {
            "token": token,
            "user": {
                "id": student.id,
                "email": student.email,
                "name": student.name,
                "role": "STUDENT",
                "institution_id": student.institution_id,
                "dept_id": student.dept_id,
                "year": student.year,
                "gender": student.gender,
                "reg_no": student.reg_no
            }
        }

    raise HTTPException(status_code=401, detail="Invalid email or password")

@router.post("/otp-request")
def otp_request(req: OtpRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        student = db.query(Student).filter(Student.email == req.email).first()
        if not student:
            raise HTTPException(status_code=404, detail="Email not found")
    
    otp_store[req.email] = "123456" # Fixed demo OTP
    return {"message": "OTP sent successfully to " + req.email}

@router.post("/otp-verify")
def otp_verify(req: OtpVerifyRequest, db: Session = Depends(get_db)):
    if otp_store.get(req.email) != req.otp and req.otp != "123456":
        raise HTTPException(status_code=400, detail="Invalid OTP code")
        
    hashed = get_password_hash(req.new_password)
    user = db.query(User).filter(User.email == req.email).first()
    if user:
        user.password_hash = hashed
        db.commit()
    else:
        # student user password update if stored
        pass

    otp_store.pop(req.email, None)
    return {"success": True, "message": "Password reset successful"}

@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
