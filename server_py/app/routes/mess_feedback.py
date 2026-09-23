from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import MessFeedback
from datetime import datetime

router = APIRouter(prefix="/api/mess", tags=["Mess"])

class FeedbackCreate(BaseModel):
    rating: int
    meal_type: str
    dish_name: str
    comment: str

@router.get("/feedback/stats")
def get_feedback_stats(db: Session = Depends(get_db)):
    feedbacks = db.query(MessFeedback).all()
    if not feedbacks:
        return {"average_rating": 0, "total_feedback": 0}
    
    total = sum(f.rating for f in feedbacks)
    avg = total / len(feedbacks)
    return {"average_rating": avg, "total_feedback": len(feedbacks)}

@router.post("/feedback")
def submit_feedback(
    data: FeedbackCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    fb = MessFeedback(
        student_id=current_user["id"],
        student_name=current_user["name"],
        rating=data.rating,
        meal_type=data.meal_type,
        dish_name=data.dish_name,
        comment=data.comment
    )
    db.add(fb)
    db.commit()
    return {"success": True, "message": "Feedback submitted successfully"}
