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
    room_label: Optional[str] = None
    student_name: Optional[str] = None
    assigned_qty: float
    assigned_date: Optional[str] = None
    expected_return: Optional[str] = None
    notes: Optional[str] = None

class ReturnAsset(BaseModel):
    condition_on_return: Optional[str] = "Good"

class POCreate(BaseModel):
    item_name: str
    category: Optional[str] = None
    requested_qty: float
    unit_price: Optional[float] = 0.0
    vendor: Optional[str] = None
    notes: Optional[str] = None

class POUpdate(BaseModel):
    status: str
    approved_by: Optional[str] = None
    received_qty: Optional[float] = None

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
    
    item.is_deleted = True
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
    if data.qty < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")
        
    diff = data.qty - item.qty
    item.qty = data.qty
    item.total_price = item.qty * (item.unit_price or 0.0)
    
    tx = AssetTransaction(
        item_id=item_id,
        item_name=item.name,
        category=item.category,
        type="Adjustment",
        qty_change=diff,
        unit=item.unit,
        reason=data.reason,
        done_by=str(current_user["id"])
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
    
    if data.assigned_qty <= 0:
        raise HTTPException(status_code=400, detail="Assigned quantity must be greater than zero")
        
    if item.qty < data.assigned_qty:
        raise HTTPException(status_code=400, detail="Insufficient quantity")
        
    item.qty -= data.assigned_qty
    item.total_price = item.qty * (item.unit_price or 0.0)
    
    assignment = AssetAssignment(
        item_id=data.item_id,
        item_name=item.name,
        category=item.category,
        room_label=data.room_label,
        student_name=data.student_name,
        assigned_qty=data.assigned_qty,
        unit=item.unit,
        assigned_date=data.assigned_date,
        expected_return=data.expected_return,
        notes=data.notes,
        status="Active"
    )
    tx = AssetTransaction(
        item_id=data.item_id,
        item_name=item.name,
        category=item.category,
        type="Issue",
        qty_change=-data.assigned_qty,
        unit=item.unit,
        reason=f"Assigned to {data.room_label or data.student_name}",
        done_by=str(current_user["id"])
    )
    db.add(assignment)
    db.add(tx)
    db.commit()
    return {"success": True, "message": "Asset assigned"}

@router.put("/assignments/{id}/return")
def return_asset(
    id: int,
    data: ReturnAsset,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "INVENTORY_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    assignment = db.query(AssetAssignment).filter(AssetAssignment.id == id).first()
    if not assignment or assignment.status == "Returned":
        raise HTTPException(status_code=400, detail="Invalid assignment")
        
    item = db.query(AssetInventoryItem).filter(AssetInventoryItem.id == assignment.item_id).first()
    if item:
        item.qty += assignment.assigned_qty
        item.total_price = item.qty * (item.unit_price or 0.0)
        
    assignment.status = "Returned"
    assignment.condition_on_return = data.condition_on_return
    assignment.updated_at = datetime.utcnow().isoformat()
    
    tx = AssetTransaction(
        item_id=assignment.item_id,
        item_name=assignment.item_name,
        category=assignment.category,
        type="Return",
        qty_change=assignment.assigned_qty,
        unit=assignment.unit,
        reason=f"Returned from {assignment.room_label or assignment.student_name} (Cond: {data.condition_on_return})",
        done_by=str(current_user["id"])
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
        item_name=data.item_name,
        category=data.category,
        requested_qty=data.requested_qty,
        unit_price=data.unit_price,
        total_amount=float(data.requested_qty) * float(data.unit_price) if data.unit_price else 0.0,
        vendor=data.vendor,
        notes=data.notes,
        requested_by=str(current_user["id"])
    )
    db.add(po)
    db.commit()
    return {"success": True, "po_number": po_no}

@router.put("/purchase-orders/{id}")
def update_po_status(
    id: int,
    data: POUpdate,
    current_user: dict = Depends(require_roles("SUPER_ADMIN", "INVENTORY_ADMIN", "HOSTEL_ADMIN")),
    db: Session = Depends(get_db)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
        
    old_status = po.status
    po.status = data.status
    
    if data.status == "Approved" and old_status != "Approved":
        # Securely record who approved it using the authenticated token, not the client payload
        po.approved_by = str(current_user["id"])
    elif data.approved_by and not po.approved_by:
        po.approved_by = data.approved_by
        
    if data.received_qty is not None:
        po.received_qty = data.received_qty
        
    # Auto-add to inventory if marked as Received
    if data.status == "Received" and old_status != "Received":
        received_qty = data.received_qty if data.received_qty is not None else po.requested_qty
        po.received_qty = received_qty # ensure PO reflects it
        
        # Check if item exists in inventory
        item = db.query(AssetInventoryItem).filter(AssetInventoryItem.name == po.item_name).first()
        if item:
            item.qty = (item.qty or 0) + int(received_qty)
            item.total_price = item.qty * (item.unit_price or 0.0)
        else:
            # Create new inventory item
            new_item = AssetInventoryItem(
                name=po.item_name,
                category=po.category or "Other",
                qty=int(received_qty),
                min_qty=5,
                unit="nos",
                unit_price=po.unit_price,
                total_price=float(received_qty) * float(po.unit_price or 0.0),
                vendor=po.vendor,
                purchase_date=datetime.utcnow().strftime("%Y-%m-%d"),
                location="Store Room",
                condition_status="New"
            )
            db.add(new_item)
            
    db.commit()
    return {"success": True, "message": f"PO Status updated to {data.status}"}
