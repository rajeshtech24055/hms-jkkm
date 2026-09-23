from typing import Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import WeeklyMenu

router = APIRouter(prefix="/api/menu", tags=["Menu"])

class DayMenuUpdate(BaseModel):
    breakfast: str = ""
    lunch: str = ""
    snacks: str = ""
    dinner: str = ""

@router.get("")
def get_full_menu(db: Session = Depends(get_db)):
    all_menus = db.query(WeeklyMenu).all()
    result = []
    
    # Initialize days
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    for day in days:
        day_menu = {"day": day, "breakfast": "", "lunch": "", "snacks": "", "dinner": ""}
        for m in all_menus:
            if m.day == day and m.meal_type in day_menu:
                day_menu[m.meal_type] = m.items_description or ""
        result.append(day_menu)
            
    return result

@router.put("/{day}")
def update_day_menu(
    day: str,
    data: DayMenuUpdate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "FOOD_ADMIN")),
    db: Session = Depends(get_db)
):
    valid_days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    if day not in valid_days:
        raise HTTPException(status_code=400, detail="Invalid day")
        
    meals = {
        "breakfast": data.breakfast,
        "lunch": data.lunch,
        "snacks": data.snacks,
        "dinner": data.dinner
    }
    
    for m_type, desc in meals.items():
        existing = db.query(WeeklyMenu).filter(WeeklyMenu.day == day, WeeklyMenu.meal_type == m_type).first()
        if existing:
            existing.items_description = desc
        else:
            new_item = WeeklyMenu(day=day, meal_type=m_type, items_description=desc)
            db.add(new_item)
            
    db.commit()
    return {"success": True, "message": f"Menu for {day} updated successfully"}
