from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, ForeignKey, DateTime, func, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class Hostel(Base):
    __tablename__ = "hostels"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    gender = Column(String, nullable=False)  # 'Male' or 'Female'
    description = Column(String, nullable=True)

    rooms = relationship("Room", back_populates="hostel")

class Institution(Base):
    __tablename__ = "institutions"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False)

    departments = relationship("Department", back_populates="institution")
    rooms = relationship("Room", back_populates="institution")
    students = relationship("Student", back_populates="institution")
    users = relationship("User", back_populates="institution")

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    institution_id = Column(Integer, ForeignKey("institutions.id"))

    institution = relationship("Institution", back_populates="departments")
    students = relationship("Student", back_populates="department")
    users = relationship("User", back_populates="department")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    dept_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    year_id = Column(Integer, nullable=True)
    year = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    active = Column(Integer, default=1)

    institution = relationship("Institution", back_populates="users")
    department = relationship("Department", back_populates="users")

class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_no = Column(String, nullable=False)
    block = Column(String, nullable=True)
    floor = Column(Integer, default=1)
    capacity = Column(Integer, default=4)
    gender = Column(String, nullable=False)
    hostel_id = Column(Integer, ForeignKey("hostels.id"), nullable=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True)

    hostel = relationship("Hostel", back_populates="rooms")
    institution = relationship("Institution", back_populates="rooms")
    students = relationship("Student", back_populates="room")

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    reg_no = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    gender = Column(String, nullable=False)
    institution_id = Column(Integer, ForeignKey("institutions.id"))
    dept_id = Column(Integer, ForeignKey("departments.id"))
    year = Column(String, nullable=True)
    batch = Column(String, nullable=True) # e.g. "2024-2028"
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    bed_no = Column(Integer, default=1)
    guardian_name = Column(String, nullable=True)
    guardian_phone = Column(String, nullable=True)
    guardian_email = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)
    mobile = Column(String, nullable=True)
    email = Column(String, nullable=True)
    dob = Column(String, nullable=True)  # Date of Birth — used as default password (DDMMYYYY)
    qr_token = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    active = Column(Integer, default=1)

    institution = relationship("Institution", back_populates="students")
    department = relationship("Department", back_populates="students")
    room = relationship("Room", back_populates="students")
    entry_logs = relationship("EntryExitLog", back_populates="student")
    leaves = relationship("LeaveApplication", back_populates="student")

class EntryExitLog(Base):
    __tablename__ = "entry_exit_logs"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    direction = Column(String, nullable=False) # 'IN' or 'OUT'
    authorized = Column(Integer, default=1)
    flagged = Column(Integer, default=0)
    flag_reason = Column(String, nullable=True)
    verification_method = Column(String, default="QR") # 'QR' | 'RFID' | 'Manual'
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

    student = relationship("Student", back_populates="entry_logs")

class LeaveApplication(Base):
    __tablename__ = "leave_applications"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    type = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    from_dt = Column(String, nullable=True)
    to_dt = Column(String, nullable=True)
    place = Column(String, nullable=True)
    is_emergency = Column(Integer, default=0)
    status = Column(String, default="pending")
    current_level = Column(Integer, default=1)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

    student = relationship("Student", back_populates="leaves")
    approvals = relationship("LeaveApproval", back_populates="application")

class LeaveApproval(Base):
    __tablename__ = "leave_approvals"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    application_id = Column(Integer, ForeignKey("leave_applications.id"))
    approver_id = Column(Integer, nullable=True)
    level = Column(Integer, nullable=True)
    decision = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

    application = relationship("LeaveApplication", back_populates="approvals")

class MessItem(Base):
    __tablename__ = "mess_materials_tools_items"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    unit = Column(String, nullable=True)
    current_stock = Column(Float, default=0.0)
    reorder_level = Column(Float, default=10.0)
    reorder_qty = Column(Float, default=50.0)
    lead_time_days = Column(Integer, default=3)
    supplier = Column(String, nullable=True)
    unit_price = Column(Float, default=0.0)
    batch_no = Column(String, nullable=True)
    mfg_date = Column(String, nullable=True)
    exp_date = Column(String, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(String, nullable=True)

class MessUsageLog(Base):
    __tablename__ = "mess_inventory_usage_logs"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_id = Column(Integer, nullable=True)
    qty_used = Column(Float, default=0.0)
    date = Column(String, nullable=True)
    logged_by = Column(Integer, nullable=True)

class MessMealsServed(Base):
    __tablename__ = "mess_meals_served"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(String, unique=True, nullable=False)
    students_served = Column(Integer, default=0)
    breakfast_count = Column(Integer, default=0)
    lunch_count = Column(Integer, default=0)
    snacks_count = Column(Integer, default=0)
    dinner_count = Column(Integer, default=0)

class MessFoodWastage(Base):
    __tablename__ = "mess_food_wastage"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(String, nullable=True)
    category = Column(String, nullable=True)
    prepared_qty = Column(Float, default=0.0)
    consumed_qty = Column(Float, default=0.0)
    wasted_qty = Column(Float, default=0.0)
    unit = Column(String, default="kg")
    reason = Column(String, nullable=True)

class WeeklyMenu(Base):
    __tablename__ = "weekly_menu"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    day = Column(String, nullable=False)
    meal_type = Column(String, nullable=False)
    items_description = Column(Text, nullable=True)

class MessFeedback(Base):
    __tablename__ = "mess_feedback"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, nullable=True)
    student_name = Column(String, nullable=True)
    rating = Column(Integer, default=5)
    meal_type = Column(String, nullable=True)
    dish_name = Column(String, nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class AssetInventoryItem(Base):
    __tablename__ = "materials_tools_items"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    qty = Column(Integer, default=0)
    min_qty = Column(Integer, default=5)
    unit = Column(String, default="nos")
    unit_price = Column(Float, default=0.0)
    total_price = Column(Float, default=0.0)
    vendor = Column(String, nullable=True)
    purchase_date = Column(String, nullable=True)
    location = Column(String, nullable=True)
    condition_status = Column(String, default="Good")
    asset_code = Column(String, nullable=True)
    serial_no = Column(String, nullable=True)
    warranty_expiry = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    updated_at = Column(String, nullable=True)

class AssetTransaction(Base):
    __tablename__ = "materials_transactions"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_id = Column(Integer, nullable=False)
    type = Column(String, nullable=False)  # "IN" or "OUT" or "ADJUST"
    qty = Column(Integer, nullable=False)
    reason = Column(String, nullable=True)
    logged_by = Column(String, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class AssetAssignment(Base):
    __tablename__ = "materials_assignments"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_id = Column(Integer, nullable=False)
    assigned_to_type = Column(String, nullable=False) # "ROOM", "STAFF", "STUDENT", "DEPT"
    assigned_to_id = Column(String, nullable=False)
    qty = Column(Integer, nullable=False)
    assigned_by = Column(String, nullable=True)
    assigned_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    returned_at = Column(String, nullable=True)
    status = Column(String, default="Active") # "Active", "Returned"

class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    raised_by = Column(Integer, nullable=True)
    room_no = Column(String, nullable=True)
    category = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    priority = Column(String, default="Normal")
    status = Column(String, default="pending")
    assigned_to = Column(Integer, nullable=True)
    remarks = Column(Text, nullable=True)
    verified_by_student_id = Column(Integer, nullable=True)
    verified_at = Column(String, nullable=True)
    resolved_at = Column(String, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class Complaint(Base):
    __tablename__ = "complaints"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, nullable=True)
    student_name = Column(String, nullable=True)
    room_no = Column(String, nullable=True)
    category = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    is_anonymous = Column(Integer, default=0)
    status = Column(String, default="open")
    priority = Column(String, default="medium")
    admin_remarks = Column(Text, nullable=True)
    resolved_by = Column(String, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(String, nullable=True)

class HostelVacateRequest(Base):
    __tablename__ = "hostel_vacate_requests"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    reason = Column(Text, nullable=False)
    vacate_date = Column(String, nullable=False)
    parent_phone = Column(String, nullable=True)
    status = Column(String, default="PENDING_WARDEN")
    has_damage = Column(Integer, default=0)
    damage_description = Column(Text, nullable=True)
    fine_amount = Column(Float, default=0.0)
    fine_paid = Column(Integer, default=0)
    warden_remarks = Column(Text, nullable=True)
    principal_remarks = Column(Text, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(String, nullable=True)

class Notice(Base):
    __tablename__ = "notices"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    posted_by = Column(Integer, nullable=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class NotificationLog(Base):
    __tablename__ = "notification_logs"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    recipient_phone = Column(String, nullable=True)
    student_id = Column(Integer, nullable=True)
    student_name = Column(String, nullable=True)
    type = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    status = Column(String, default="SENT")
    sent_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class SosIncident(Base):
    __tablename__ = "sos_incidents"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, nullable=True)
    student_name = Column(String, nullable=True)
    room_no = Column(String, nullable=True)
    status = Column(String, default="OPEN") # 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
    resolved_by = Column(Integer, nullable=True)
    resolved_at = Column(String, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class DailySnapshot(Base):
    __tablename__ = "daily_snapshots"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    snapshot_date = Column(String, unique=True, nullable=False)
    total_students = Column(Integer, default=0)
    students_on_leave = Column(Integer, default=0)
    students_outside = Column(Integer, default=0)
    expected_occupancy = Column(Integer, default=0)
    actual_headcount = Column(Integer, default=0)
    breakfast_count = Column(Integer, default=0)
    lunch_count = Column(Integer, default=0)
    snacks_count = Column(Integer, default=0)
    dinner_count = Column(Integer, default=0)
    total_food_cost = Column(Float, default=0.0)
    total_wastage_kg = Column(Float, default=0.0)
    open_complaints = Column(Integer, default=0)
    open_tickets = Column(Integer, default=0)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class AssetTransaction(Base):
    __tablename__ = "materials_tools_transactions"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_id = Column(Integer, nullable=False)
    item_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    type = Column(String, nullable=False) # 'Purchase', 'Issue', 'Return', 'Damage', 'Disposal', 'Adjustment'
    qty_change = Column(Float, nullable=False)
    unit = Column(String, default="nos")
    reason = Column(String, nullable=True)
    reference_no = Column(String, nullable=True)
    done_by = Column(String, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class AssetAssignment(Base):
    __tablename__ = "materials_tools_assignments"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_id = Column(Integer, nullable=False)
    item_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    room_label = Column(String, nullable=True)
    student_name = Column(String, nullable=True)
    assigned_qty = Column(Float, default=1)
    unit = Column(String, default="nos")
    assigned_date = Column(String, nullable=True)
    expected_return = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String, default="Active") # 'Active', 'Returned'
    condition_on_return = Column(String, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(String, nullable=True)

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    po_number = Column(String, nullable=False, unique=True)
    item_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    requested_qty = Column(Float, nullable=False)
    received_qty = Column(Float, default=0)
    unit_price = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    vendor = Column(String, nullable=True)
    status = Column(String, default="Pending") # 'Pending', 'Approved', 'Ordered', 'Received', 'Cancelled'
    notes = Column(Text, nullable=True)
    requested_by = Column(String, nullable=True)
    approved_by = Column(String, nullable=True)
    bill_image = Column(Text, nullable=True) # Base64 image
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(String, nullable=True)
