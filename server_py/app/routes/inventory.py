from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import AssetInventoryItem

router = APIRouter(prefix="/api/materials_tools", tags=["Materials & Tools ERP"])

class AssetCreate(BaseModel):
    name: str
    category: Optional[str] = "Furniture"
    qty: int
    min_qty: Optional[int] = 5
    unit: Optional[str] = "nos"
    unit_price: Optional[float] = 0.0
    vendor: Optional[str] = None
    purchase_date: Optional[str] = None
    location: Optional[str] = "Common Area"
    condition_status: Optional[str] = "Good"
    asset_code: Optional[str] = None
    serial_no: Optional[str] = None
    warranty_expiry: Optional[str] = None
    notes: Optional[str] = None

@router.get("")
def get_assets(
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(AssetInventoryItem)
    if category:
        query = query.filter(AssetInventoryItem.category == category)
    return query.all()

@router.get("/stats")
def get_asset_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    items = db.query(AssetInventoryItem).all()
    total_items = len(items)
    total_value = sum([(i.qty or 0) * (i.unit_price or 0.0) for i in items])
    low_stock = sum([1 for i in items if (i.qty or 0) <= (i.min_qty or 5)])

    return {
        "total_items": total_items,
        "total_value": round(total_value, 2),
        "low_stock_count": low_stock
    }

@router.post("")
def create_asset(
    data: AssetCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "INVENTORY_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    total_p = (data.qty or 0) * (data.unit_price or 0.0)
    item = AssetInventoryItem(
        name=data.name,
        category=data.category,
        qty=data.qty,
        min_qty=data.min_qty or 5,
        unit=data.unit or "nos",
        unit_price=data.unit_price or 0.0,
        total_price=total_p,
        vendor=data.vendor,
        purchase_date=data.purchase_date,
        location=data.location,
        condition_status=data.condition_status or "Good",
        asset_code=data.asset_code,
        serial_no=data.serial_no,
        warranty_expiry=data.warranty_expiry,
        notes=data.notes,
        updated_at=datetime.utcnow().isoformat()
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "message": "Asset item created"}

@router.get("/transactions")
def get_asset_transactions(db: Session = Depends(get_db)):
    return []

@router.get("/assignments")
def get_asset_assignments(db: Session = Depends(get_db)):
    return []
