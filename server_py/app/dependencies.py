from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.security import decode_token
from app.models.models import User, Student

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("id")
    role = payload.get("role", "").upper()
    
    if role == "STUDENT":
        student = db.query(Student).filter(Student.id == user_id).first()
        if not student:
            raise HTTPException(status_code=401, detail="Student user not found")
        # Return dict representation compatible with user payload
        return {
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

    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.active != 1:
        raise HTTPException(status_code=401, detail="User not found or inactive")
        
    return {
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

def require_roles(*allowed_roles: str):
    def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied for role {current_user['role']}"
            )
        return current_user
    return role_checker
