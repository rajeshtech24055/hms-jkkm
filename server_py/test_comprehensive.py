import sys
import os

# Add server_py to path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, SessionLocal
from app.models.models import User, Student, Hostel, Room, Institution

client = TestClient(app)

def test_all():
    print("Starting Comprehensive Tests...")
    
    # 1. Test Auth Login (we'll try to find an existing admin user, or mock one)
    db = SessionLocal()
    admin = db.query(User).filter(User.role == "SUPER_ADMIN").first()
    if not admin:
        print("No SUPER_ADMIN found in DB, skipping tests requiring auth.")
        return
        
    print(f"Found Admin: {admin.email}")
    
    # We can mock get_current_user dependency to bypass password
    from app.dependencies import get_current_user
    def override_get_current_user():
        return {
            "id": admin.id,
            "role": admin.role,
            "email": admin.email,
            "institution_id": admin.institution_id,
            "gender": admin.gender
        }
        
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    endpoints_to_test = [
        ("/api/dashboard", "GET"),
        ("/api/analytics/overview", "GET"),
        ("/api/hostels", "GET"),
        ("/api/rooms", "GET"),
        ("/api/students", "GET"),
        ("/api/leaves", "GET"),
        ("/api/gate/log", "GET"),
        ("/api/maintenance", "GET"),
        ("/api/materials_tools", "GET"),
        ("/api/mess_inventory", "GET"),
        ("/api/menu", "GET"),
        ("/api/notifications", "GET"),
        ("/api/notices", "GET"),
        ("/api/complaints", "GET"),
        ("/api/forecast/occupancy", "GET"),
    ]
    
    for endpoint, method in endpoints_to_test:
        print(f"Testing {method} {endpoint}...", end=" ")
        try:
            if method == "GET":
                response = client.get(endpoint)
            
            if response.status_code == 200:
                print("OK")
            else:
                print(f"FAILED (Status: {response.status_code})")
                print(f"Details: {response.text[:200]}")
        except Exception as e:
            import traceback
            print(f"EXCEPTION: {e}")
            traceback.print_exc()
            
    app.dependency_overrides.clear()
    db.close()
    print("Tests Completed.")

if __name__ == "__main__":
    test_all()
