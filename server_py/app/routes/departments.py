from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import Institution, Department

router = APIRouter(tags=["Institutions & Departments"])

class DeptCreate(BaseModel):
    name: str
    institution_id: int

@router.get("/api/institutions")
def get_institutions(db: Session = Depends(get_db)):
    return db.query(Institution).all()

@router.get("/api/departments")
def get_departments(
    institution_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(
        Department,
        Institution.name.label("institution_name"),
        Institution.code.label("institution_code")
    ).outerjoin(Institution, Department.institution_id == Institution.id)

    if institution_id:
        query = query.filter(Department.institution_id == institution_id)

    results = query.all()
    output = []
    for r in results:
        dept, inst_name, inst_code = r
        output.append({
            "id": dept.id,
            "name": dept.name,
            "institution_id": dept.institution_id,
            "institution_name": inst_name,
            "institution_code": inst_code
        })
    return output

@router.post("/api/departments")
def create_department(
    data: DeptCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    dept = Department(name=data.name, institution_id=data.institution_id)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return {"id": dept.id, "message": "Department created"}

@router.put("/api/departments/{dept_id}")
def update_department(
    dept_id: int,
    data: DeptCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.name = data.name
    dept.institution_id = data.institution_id
    db.commit()
    return {"success": True, "message": "Department updated"}

@router.delete("/api/departments/{dept_id}")
def delete_department(
    dept_id: int,
    current_user: dict = Depends(require_roles("SUPER_ADMIN")),
    db: Session = Depends(get_db)
):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    db.delete(dept)
    db.commit()
    return {"success": True, "message": "Department deleted"}
