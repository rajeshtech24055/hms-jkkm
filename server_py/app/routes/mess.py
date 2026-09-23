from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import (
    MessItem, MessUsageLog, MessMealsServed, MessFoodWastage, WeeklyMenu, MessFeedback
)

router = APIRouter(prefix="/api/mess_inventory", tags=["Mess Inventory ERP"])

class MessItemCreate(BaseModel):
    name: str
    category: Optional[str] = "Grains"
    unit: str
    current_stock: float
    reorder_level: float
    reorder_qty: float
    lead_time_days: Optional[int] = 3
    supplier: Optional[str] = None
    unit_price: Optional[float] = 0.0

class UsageLogCreate(BaseModel):
    item_id: int
    qty_used: float
    date: Optional[str] = None

class MealsServedCreate(BaseModel):
    date: str
    students_served: int
    breakfast_count: int
    lunch_count: int
    snacks_count: int
    dinner_count: int

class WastageCreate(BaseModel):
    date: str
    category: str
    prepared_qty: float
    consumed_qty: float
    wasted_qty: float
    unit: Optional[str] = "kg"
    reason: Optional[str] = None

class MenuUpdate(BaseModel):
    day: str
    meal_type: str
    items_description: str

@router.get("")
def get_mess_items(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    items = db.query(MessItem).all()
    return items

@router.post("")
def create_mess_item(
    data: MessItemCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "FOOD_ADMIN", "INVENTORY_ADMIN")),
    db: Session = Depends(get_db)
):
    item = MessItem(
        name=data.name,
        category=data.category,
        unit=data.unit,
        current_stock=data.current_stock,
        reorder_level=data.reorder_level,
        reorder_qty=data.reorder_qty,
        lead_time_days=data.lead_time_days or 3,
        supplier=data.supplier,
        unit_price=data.unit_price or 0.0,
        created_at=datetime.utcnow().isoformat()
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "message": "Mess item created"}

@router.put("/{item_id}")
def update_mess_item(
    item_id: int,
    data: MessItemCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "FOOD_ADMIN", "INVENTORY_ADMIN")),
    db: Session = Depends(get_db)
):
    item = db.query(MessItem).filter(MessItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Mess item not found")
    
    item.name = data.name
    item.category = data.category
    item.unit = data.unit
    item.current_stock = data.current_stock
    item.reorder_level = data.reorder_level
    item.reorder_qty = data.reorder_qty
    item.lead_time_days = data.lead_time_days or 3
    item.supplier = data.supplier
    item.unit_price = data.unit_price or 0.0
    item.updated_at = datetime.utcnow().isoformat()
    
    db.commit()
    return {"success": True, "message": "Mess item updated"}

@router.delete("/{item_id}")
def delete_mess_item(
    item_id: int,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "FOOD_ADMIN")),
    db: Session = Depends(get_db)
):
    item = db.query(MessItem).filter(MessItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Mess item not found")
    
    db.delete(item)
    db.commit()
    return {"success": True, "message": "Mess item deleted"}

class MessRestock(BaseModel):
    qty: float
    unit_price: Optional[float] = None
    batch_no: Optional[str] = None
    mfg_date: Optional[str] = None
    exp_date: Optional[str] = None
    bill_image: Optional[str] = None

class MessUse(BaseModel):
    qty: float

@router.post("/{item_id}/restock")
def restock_mess_item(
    item_id: int,
    data: MessRestock,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "FOOD_ADMIN")),
    db: Session = Depends(get_db)
):
    item = db.query(MessItem).filter(MessItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    item.current_stock += data.qty
    if data.unit_price is not None:
        item.unit_price = data.unit_price
        
    db.commit()
    return {"success": True, "message": "Restocked successfully", "new_stock": item.current_stock}

@router.post("/{item_id}/use")
def use_mess_item(
    item_id: int,
    data: MessUse,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "FOOD_ADMIN", "MESS_WORKER")),
    db: Session = Depends(get_db)
):
    item = db.query(MessItem).filter(MessItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.current_stock < data.qty:
        raise HTTPException(status_code=400, detail="Insufficient stock")
        
    item.current_stock -= data.qty
    
    log = MessUsageLog(
        item_id=item_id,
        qty_used=data.qty,
        date=datetime.utcnow().strftime("%Y-%m-%d"),
        logged_by=current_user["id"]
    )
    db.add(log)
    db.commit()
    return {"success": True, "new_stock": item.current_stock}

@router.get("/usage")
def get_mess_usage(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(MessUsageLog).order_by(MessUsageLog.id.desc()).limit(100).all()

@router.get("/prediction")
def get_mess_prediction(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Stubbed prediction data
    return [
        {"item": "Rice", "predicted_usage": 150, "unit": "kg", "confidence": 92},
        {"item": "Dal", "predicted_usage": 45, "unit": "kg", "confidence": 88}
    ]

@router.get("/expiry-alerts")
def get_expiry_alerts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Just returning all items that have an exp_date for now as a stub
    items = db.query(MessItem).filter(MessItem.exp_date != None).all()
    return [{"id": i.id, "name": i.name, "exp_date": i.exp_date} for i in items]

@router.get("/meals-served")
def get_meals_served(db: Session = Depends(get_db)):
    return db.query(MessMealsServed).order_by(MessMealsServed.id.desc()).limit(30).all()

@router.post("/meals-served")
def log_meals_served(
    data: MealsServedCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "FOOD_ADMIN", "MESS_WORKER")),
    db: Session = Depends(get_db)
):
    record = db.query(MessMealsServed).filter(MessMealsServed.date == data.date).first()
    if not record:
        record = MessMealsServed(date=data.date)
        db.add(record)

    record.students_served = data.students_served
    record.breakfast_count = data.breakfast_count
    record.lunch_count = data.lunch_count
    record.snacks_count = data.snacks_count
    record.dinner_count = data.dinner_count

    db.commit()
    return {"success": True, "message": "Meals served log updated"}

@router.get("/wastage")
def get_wastage(db: Session = Depends(get_db)):
    return db.query(MessFoodWastage).order_by(MessFoodWastage.id.desc()).limit(30).all()

@router.post("/wastage")
def log_wastage(
    data: WastageCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "FOOD_ADMIN", "MESS_WORKER")),
    db: Session = Depends(get_db)
):
    w = MessFoodWastage(
        date=data.date,
        category=data.category,
        prepared_qty=data.prepared_qty,
        consumed_qty=data.consumed_qty,
        wasted_qty=data.wasted_qty,
        unit=data.unit or "kg",
        reason=data.reason
    )
    db.add(w)
    db.commit()
    return {"success": True, "id": w.id}

@router.get("/menu")
def get_weekly_menu(db: Session = Depends(get_db)):
    return db.query(WeeklyMenu).all()

@router.post("/menu")
def update_weekly_menu(
    data: MenuUpdate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "FOOD_ADMIN")),
    db: Session = Depends(get_db)
):
    item = db.query(WeeklyMenu).filter(
        WeeklyMenu.day == data.day,
        WeeklyMenu.meal_type == data.meal_type
    ).first()
    if not item:
        item = WeeklyMenu(day=data.day, meal_type=data.meal_type)
        db.add(item)
    item.items_description = data.items_description
    db.commit()
    return {"success": True, "message": "Weekly menu item updated"}
