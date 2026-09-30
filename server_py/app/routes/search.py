from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import Student

router = APIRouter(prefix="/api/search", tags=["Search"])

@router.get("")
def global_search(
    q: str = "",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not q:
        return []
        
    query = db.query(Student).filter(
        (Student.name.ilike(f"%{q}%")) | 
        (Student.reg_no.ilike(f"%{q}%")) |
        (Student.mobile.ilike(f"%{q}%"))
    )
    
    from app.dependencies import apply_role_filters
    query = apply_role_filters(query, current_user, Student)
    
    students = query.limit(10).all()
    
    results = []
    for s in students:
        results.append({
            "id": s.id,
            "title": s.name,
            "subtitle": f"Reg: {s.reg_no}",
            "link": "/students",
            "type": "Student"
        })
        
    return results
