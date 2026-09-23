from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import (
    MessItem, MessUsageLog, MessMealsServed, MessFoodWastage, Student
)

router = APIRouter(prefix="/api/mess_analytics", tags=["Mess Analytics"])

class DailyLogSave(BaseModel):
    date: Optional[str] = None
    prepared_qty: str
    consumed_qty: Optional[str] = ""
    wasted_qty: str
    unit: Optional[str] = "kg"
    reason: Optional[str] = "Daily Operations"

@router.get("/today")
def get_mess_today(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_date = date or datetime.utcnow().strftime("%Y-%m-%d")
    
    # Active students count
    active_cnt = db.query(Student).filter(Student.active == 1).count()
    students_served = active_cnt if active_cnt > 0 else 680
    total_meals = students_served * 3

    # Food Cost
    logs = db.query(
        MessUsageLog.qty_used,
        MessItem.unit_price
    ).join(MessItem, MessUsageLog.item_id == MessItem.id)\
     .filter(MessUsageLog.date == target_date).all()

    total_cost = sum([l.qty_used * (l.unit_price or 0.0) for l in logs])
    cost_per_student = round(total_cost / students_served, 2) if students_served > 0 else 0.0
    cost_per_meal = round(total_cost / total_meals, 2) if total_meals > 0 else 0.0

    # Wastage
    w_record = db.query(
        func.sum(MessFoodWastage.prepared_qty).label("p"),
        func.sum(MessFoodWastage.consumed_qty).label("c"),
        func.sum(MessFoodWastage.wasted_qty).label("w")
    ).filter(MessFoodWastage.date == target_date).first()

    prep_qty = float(w_record.p or 0.0)
    cons_qty = float(w_record.c or 0.0)
    wast_qty = float(w_record.w or 0.0)
    wast_pct = round((wast_qty / prep_qty * 100), 2) if prep_qty > 0 else 0.0

    return {
        "date": target_date,
        "studentsServed": students_served,
        "mealsServed": total_meals,
        "totalFoodCost": total_cost,
        "costPerStudent": cost_per_student,
        "costPerMeal": cost_per_meal,
        "preparedQuantity": prep_qty,
        "consumedQuantity": cons_qty,
        "wastedQuantity": wast_qty,
        "wastagePercentage": wast_pct
    }

@router.get("/daily_log")
def get_daily_log(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_date = date or datetime.utcnow().strftime("%Y-%m-%d")
    record = db.query(MessFoodWastage).filter(MessFoodWastage.date == target_date).order_by(MessFoodWastage.id.desc()).first()
    if record:
        return {
            "date": target_date,
            "prepared_qty": str(record.prepared_qty or ""),
            "consumed_qty": str(record.consumed_qty or ""),
            "wasted_qty": str(record.wasted_qty or ""),
            "unit": record.unit or "kg",
            "reason": record.reason or ""
        }
    return {
        "date": target_date,
        "prepared_qty": "",
        "consumed_qty": "",
        "wasted_qty": "",
        "unit": "kg",
        "reason": ""
    }

@router.post("/daily_log")
def save_daily_log(
    data: DailyLogSave,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "FOOD_ADMIN", "HOSTEL_ADMIN", "PRINCIPAL")),
    db: Session = Depends(get_db)
):
    target_date = data.date or datetime.utcnow().strftime("%Y-%m-%d")
    p = float(data.prepared_qty or 0.0)
    w = float(data.wasted_qty or 0.0)
    c = float(data.consumed_qty) if data.consumed_qty != "" and data.consumed_qty is not None else max(0.0, p - w)

    # Clear existing log for this date
    db.query(MessFoodWastage).filter(MessFoodWastage.date == target_date).delete()

    record = MessFoodWastage(
        date=target_date,
        category="General",
        prepared_qty=p,
        consumed_qty=c,
        wasted_qty=w,
        unit=data.unit or "kg",
        reason=data.reason or "Daily Operations"
    )
    db.add(record)
    db.commit()
    return {"message": "Daily food log updated successfully"}

@router.get("/consumption")
def get_mess_consumption(
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    start = startDate or (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
    end = endDate or today_str

    results = db.query(
        MessItem.name.label("itemName"),
        MessItem.unit,
        MessItem.unit_price.label("unitPrice"),
        func.sum(MessUsageLog.qty_used).label("quantity")
    ).join(MessItem, MessUsageLog.item_id == MessItem.id)\
     .filter(MessUsageLog.date >= start, MessUsageLog.date <= end)\
     .group_by(MessItem.id, MessItem.name, MessItem.unit, MessItem.unit_price)\
     .order_by(func.sum(MessUsageLog.qty_used).desc()).all()

    output = []
    for r in results:
        qty = float(r.quantity or 0.0)
        u_price = float(r.unitPrice or 0.0)
        output.append({
            "itemName": r.itemName,
            "unit": r.unit,
            "unitPrice": u_price,
            "quantity": qty,
            "cost": round(qty * u_price, 2)
        })
    return output

@router.get("/trends")
def get_mess_trends(
    days: Optional[int] = 7,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    num_days = days or 7
    days_list = [(datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(num_days - 1, -1, -1)]
    output = []

    for dt in days_list:
        logs = db.query(
            MessUsageLog.qty_used,
            MessItem.unit_price
        ).join(MessItem, MessUsageLog.item_id == MessItem.id)\
         .filter(MessUsageLog.date == dt).all()

        food_cost = sum([l.qty_used * (l.unit_price or 0.0) for l in logs])

        w_record = db.query(
            func.sum(MessFoodWastage.prepared_qty).label("p"),
            func.sum(MessFoodWastage.wasted_qty).label("w")
        ).filter(MessFoodWastage.date == dt).first()

        prep = float(w_record.p or 0.0)
        wast = float(w_record.w or 0.0)
        pct = round((wast / prep * 100), 2) if prep > 0 else 0.0

        output.append({
            "date": dt,
            "foodCost": round(food_cost, 2),
            "wastage": wast,
            "wastagePercentage": pct
        })
    return output

@router.get("/stock-status")
def get_stock_status(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    items = db.query(MessItem).order_by(MessItem.current_stock.desc()).all()
    output = []
    for i in items:
        status = "NORMAL"
        if i.current_stock <= 0:
            status = "OUT OF STOCK"
        elif i.current_stock <= i.reorder_level:
            status = "LOW"

        output.append({
            "itemName": i.name,
            "currentStock": i.current_stock,
            "unit": i.unit,
            "reorderLevel": i.reorder_level,
            "status": status
        })
    return output

@router.get("/insights")
def get_mess_insights(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    insights = []
    
    # 1. Low stock items
    low_items = db.query(MessItem).filter(MessItem.current_stock > 0, MessItem.current_stock <= MessItem.reorder_level).all()
    if low_items:
        names = ", ".join([i.name for i in low_items])
        insights.append(f"⚠️ {names} stock is below reorder level.")

    # 2. Out of stock items
    out_items = db.query(MessItem).filter(MessItem.current_stock <= 0).all()
    if out_items:
        names = ", ".join([i.name for i in out_items])
        insights.append(f"⚠️ {names} is OUT OF STOCK.")

    # 3. Wastage comparison
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    yest_str = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")

    w_today = db.query(func.sum(MessFoodWastage.wasted_qty)).filter(MessFoodWastage.date == today_str).scalar() or 0.0
    w_yest = db.query(func.sum(MessFoodWastage.wasted_qty)).filter(MessFoodWastage.date == yest_str).scalar() or 0.0

    if w_today > w_yest and w_yest > 0:
        insights.append(f"⚠️ Food wastage increased compared to yesterday ({w_today}kg vs {w_yest}kg).")
    elif w_today < w_yest and w_today > 0:
        insights.append("✓ Food wastage decreased compared to yesterday.")

    if not insights:
        insights.append("✓ Mess inventory & wastage levels operating smoothly.")

    return insights
