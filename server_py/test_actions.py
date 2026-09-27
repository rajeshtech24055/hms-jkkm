import sys
import os

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, SessionLocal
from app.models.models import User, Student

client = TestClient(app)

def test_actions():
    print("Starting Comprehensive Actions Test...")
    
    db = SessionLocal()
    admin = db.query(User).filter(User.role == "SUPER_ADMIN").first()
    student = db.query(Student).filter(Student.active == 1).first()
    
    if not admin:
        print("No SUPER_ADMIN found in DB, skipping.")
        return
        
    def override_get_current_user():
        return {
            "id": admin.id,
            "role": admin.role,
            "email": admin.email,
            "institution_id": admin.institution_id,
            "gender": admin.gender,
            "name": admin.name
        }
        
    from app.dependencies import get_current_user
    app.dependency_overrides[get_current_user] = override_get_current_user

    # We also need to override get_db to always rollback
    # so we don't mess up the local database with garbage data
    def override_get_db():
        try:
            yield db
        finally:
            db.rollback()
            
    from app.dependencies import get_db as dep_get_db
    app.dependency_overrides[dep_get_db] = override_get_db
    
    from app.dependencies import get_current_user
    app.dependency_overrides[get_current_user] = override_get_current_user

    actions = [
        # Gate Scan
        {"path": "/api/gate/scan", "method": "POST", "json": {"reg_no": student.reg_no if student else "TEST1234", "token": "DUMMY"}},
        
        # Leaves
        {"path": "/api/leaves", "method": "POST", "json": {"student_id": student.id if student else 1, "from_dt": "2026-10-01", "to_dt": "2026-10-02", "reason": "Test", "type": "Home", "place": "Home", "is_emergency": 0}},
        
        # Complaints
        {"path": "/api/complaints", "method": "POST", "json": {"subject": "Test", "description": "Test", "category": "Plumbing", "room_no": "101", "is_anonymous": 0}},
        
        # Notices
        {"path": "/api/notices", "method": "POST", "json": {"title": "Test Notice", "content": "Test Content", "type": "General", "target_roles": ["STUDENT"]}},
        
        # Mess Inventory
        {"path": "/api/mess_inventory", "method": "POST", "json": {"name": "Test Item", "unit": "kg", "current_stock": 10, "reorder_level": 5, "reorder_qty": 5}},
        
    ]
    
    for action in actions:
        print(f"Testing {action['method']} {action['path']}...", end=" ")
        try:
            if action["method"] == "POST":
                response = client.post(action["path"], json=action["json"])
            elif action["method"] == "PUT":
                response = client.put(action["path"], json=action["json"])
                
            if response.status_code in [200, 201]:
                print("OK")
            else:
                print(f"FAILED (Status: {response.status_code}) - {response.text[:200]}")
        except Exception as e:
            import traceback
            print(f"EXCEPTION: {e}")
            traceback.print_exc()
            
    app.dependency_overrides.clear()
    db.close()
    print("Action Tests Completed.")

if __name__ == "__main__":
    test_actions()
