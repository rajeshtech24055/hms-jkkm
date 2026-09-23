from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.models import AssetInventoryItem, AssetTransaction, AssetAssignment, PurchaseOrder
import json

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

class AdjustQty(BaseModel):
    qty: int
    reason: str

class AssignAsset(BaseModel):
    item_id: int
    assigned_to_type: str
    assigned_to_id: str
    qty: int

class POCreate(BaseModel):
    vendor_name: str
    total_amount: float
    items_json: str

class POUpdate(BaseModel):
    status: str

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

@router.put("/{item_id}")
def update_asset(
    item_id: int,
    data: AssetCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "INVENTORY_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    item = db.query(AssetInventoryItem).filter(AssetInventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    item.name = data.name
    item.category = data.category
    item.qty = data.qty
    item.min_qty = data.min_qty or 5
    item.unit = data.unit or "nos"
    item.unit_price = data.unit_price or 0.0
    item.total_price = (data.qty or 0) * (data.unit_price or 0.0)
    item.vendor = data.vendor
    item.purchase_date = data.purchase_date
    item.location = data.location
    item.condition_status = data.condition_status or "Good"
    item.asset_code = data.asset_code
    item.serial_no = data.serial_no
    item.warranty_expiry = data.warranty_expiry
    item.notes = data.notes
    item.updated_at = datetime.utcnow().isoformat()
    
    db.commit()
    return {"success": True, "message": "Asset updated"}

@router.delete("/{item_id}")
def delete_asset(
    item_id: int,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "INVENTORY_ADMIN")),
    db: Session = Depends(get_db)
):
    item = db.query(AssetInventoryItem).filter(AssetInventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    db.delete(item)
    db.commit()
    return {"success": True, "message": "Asset deleted"}

@router.get("/transactions")
def get_asset_transactions(db: Session = Depends(get_db)):
    return db.query(AssetTransaction).order_by(AssetTransaction.id.desc()).limit(100).all()

@router.get("/assignments")
def get_asset_assignments(db: Session = Depends(get_db)):
    return db.query(AssetAssignment).order_by(AssetAssignment.id.desc()).all()

@router.patch("/{item_id}/adjust")
def adjust_qty(
    item_id: int,
    data: AdjustQty,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "INVENTORY_ADMIN")),
    db: Session = Depends(get_db)
):
    item = db.query(AssetInventoryItem).filter(AssetInventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    diff = data.qty - item.qty
    item.qty = data.qty
    item.total_price = item.qty * (item.unit_price or 0.0)
    
    tx = AssetTransaction(
        item_id=item_id,
        type="ADJUST",
        qty=diff,
        reason=data.reason,
        logged_by=str(current_user["id"])
    )
    db.add(tx)
    db.commit()
    return {"success": True, "new_qty": item.qty}

@router.post("/assign")
def assign_asset(
    data: AssignAsset,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "INVENTORY_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    item = db.query(AssetInventoryItem).filter(AssetInventoryItem.id == data.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item.qty < data.qty:
        raise HTTPException(status_code=400, detail="Insufficient quantity")
        
    item.qty -= data.qty
    item.total_price = item.qty * (item.unit_price or 0.0)
    
    assignment = AssetAssignment(
        item_id=data.item_id,
        assigned_to_type=data.assigned_to_type,
        assigned_to_id=data.assigned_to_id,
        qty=data.qty,
        assigned_by=str(current_user["id"])
    )
    tx = AssetTransaction(
        item_id=data.item_id,
        type="OUT",
        qty=-data.qty,
        reason=f"Assigned to {data.assigned_to_type} {data.assigned_to_id}",
        logged_by=str(current_user["id"])
    )
    db.add(assignment)
    db.add(tx)
    db.commit()
    return {"success": True, "message": "Asset assigned"}

@router.put("/assignments/{id}/return")
def return_asset(
    id: int,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "INVENTORY_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    assignment = db.query(AssetAssignment).filter(AssetAssignment.id == id).first()
    if not assignment or assignment.status == "Returned":
        raise HTTPException(status_code=400, detail="Invalid assignment")
        
    item = db.query(AssetInventoryItem).filter(AssetInventoryItem.id == assignment.item_id).first()
    if item:
        item.qty += assignment.qty
        item.total_price = item.qty * (item.unit_price or 0.0)
        
    assignment.status = "Returned"
    assignment.returned_at = datetime.utcnow().isoformat()
    
    tx = AssetTransaction(
        item_id=assignment.item_id,
        type="IN",
        qty=assignment.qty,
        reason=f"Returned from {assignment.assigned_to_type} {assignment.assigned_to_id}",
        logged_by=str(current_user["id"])
    )
    db.add(tx)
    db.commit()
    return {"success": True, "message": "Asset returned"}

# --- Purchase Orders ---
@router.get("/purchase-orders")
def get_pos(db: Session = Depends(get_db)):
    return db.query(PurchaseOrder).order_by(PurchaseOrder.id.desc()).all()

@router.post("/purchase-orders")
def create_po(
    data: POCreate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "INVENTORY_ADMIN")),
    db: Session = Depends(get_db)
):
    import uuid
    po_no = f"PO-{uuid.uuid4().hex[:6].upper()}"
    po = PurchaseOrder(
        po_number=po_no,
        vendor_name=data.vendor_name,
        items_json=data.items_json,
        total_amount=data.total_amount,
        created_by=str(current_user["id"])
    )
    db.add(po)
    db.commit()
    return {"success": True, "po_number": po_no}

@router.put("/purchase-orders/{id}")
def update_po_status(
    id: int,
    data: POUpdate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "INVENTORY_ADMIN")),
    db: Session = Depends(get_db)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
        
    po.status = data.status
    db.commit()
    return {"success": True, "message": f"PO Status updated to {data.status}"}
