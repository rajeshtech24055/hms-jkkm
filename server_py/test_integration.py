import sys
import os

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, SessionLocal
from app.models.models import User, Student, Hostel, Room, LeaveApplication, LeaveApproval, EntryExitLog, Institution

client = TestClient(app)

def run_integration_test():
    print("Starting End-to-End Integration Test...")
    
    db = SessionLocal()
    
    # 1. Setup Mock User Contexts
    admin = db.query(User).filter(User.role == "SUPER_ADMIN").first()
    student = db.query(Student).filter(Student.active == 1).first()
    
    if not admin or not student:
        print("Missing required mock data (admin or student).")
        return

    # Helper to switch users
    def set_current_user(role, user_obj):
        def override_get_current_user():
            return {
                "id": user_obj.id,
                "role": role,
                "email": getattr(user_obj, "email", None),
                "institution_id": getattr(user_obj, "institution_id", None),
                "gender": getattr(user_obj, "gender", None)
            }
        from app.dependencies import get_current_user
        app.dependency_overrides[get_current_user] = override_get_current_user

    def override_get_db():
        try:
            yield db
        finally:
            # We don't rollback automatically here because we want to test state changes across requests.
            # We'll rollback at the very end of the script manually.
            pass
            
    from app.dependencies import get_db as dep_get_db
    app.dependency_overrides[dep_get_db] = override_get_db

    try:
        # Step 1: Student applies for leave
        print("Step 1: Student applying for leave...")
        set_current_user("STUDENT", student)
        leave_payload = {
            "student_id": student.id,
            "type": "Home",
            "reason": "Integration Test Leave",
            "from_dt": "2026-01-01T00:00:00",
            "to_dt": "2030-01-05T00:00:00",
            "place": "Home",
            "is_emergency": 0
        }
        r1 = client.post("/api/leaves", json=leave_payload)
        assert r1.status_code == 200, f"Leave application failed: {r1.text}"
        
        # Get the leave ID
        db.commit() # Commit to make it visible
        leave = db.query(LeaveApplication).filter(LeaveApplication.reason == "Integration Test Leave").order_by(LeaveApplication.id.desc()).first()
        print(f"  -> Leave applied successfully. Leave ID: {leave.id}")
        
        # Step 2: Super Admin Approves Leave (Fully approves at level 4)
        print("Step 2: Super Admin approving the leave...")
        set_current_user("SUPER_ADMIN", admin) # Mocking as SUPER_ADMIN (Level 4)
        
        # Approve level 1
        r2 = client.post(f"/api/leaves/{leave.id}/approve", json={"decision": "approve", "reason": "Approved for testing"})
        assert r2.status_code == 200, f"Leave approval failed: {r2.text}"
        print("  -> Leave approved.")
        
        # Step 3: Gate Scan OUT
        print("Step 3: Student scanning OUT at the gate...")
        set_current_user("GATE_STAFF", admin)
        scan_payload = {"reg_no": student.reg_no}
        
        # Clear existing unclosed gate logs for this student to ensure clean state
        db.query(EntryExitLog).filter(EntryExitLog.student_id == student.id, EntryExitLog.direction == "OUT").delete()
        db.commit()
        
        r3 = client.post("/api/gate/scan", json=scan_payload)
        assert r3.status_code == 200, f"Gate scan OUT failed: {r3.text}"
        print(f"  -> Scan OUT successful. Response: {r3.json()}")
        
        # Verify Analytics / Dashboard Occupancy
        print("Step 4: Verifying Dashboard reflects student is outside...")
        set_current_user("SUPER_ADMIN", admin)
        r4 = client.get("/api/dashboard")
        assert r4.status_code == 200, "Dashboard fetch failed"
        dash_data = r4.json()
        outside_cnt = dash_data["stats"].get("outside_now", 0)
        print(f"  -> Dashboard shows {outside_cnt} students outside.")
        # We can't strictly assert outside_cnt == 1 because other students might be outside, but it should be >= 1.
        assert outside_cnt >= 1, "outside_cnt did not register the scan out"

        # Step 5: Gate Scan IN
        print("Step 5: Student scanning IN at the gate...")
        set_current_user("GATE_STAFF", admin)
        r5 = client.post("/api/gate/scan", json=scan_payload)
        assert r5.status_code == 200, f"Gate scan IN failed: {r5.text}"
        print("  -> Scan IN successful.")

        print("\nINTEGRATION TEST PASSED: Modules successfully communicated!")
        
    except AssertionError as e:
        print(f"\nINTEGRATION TEST FAILED: {e}")
    except Exception as e:
        import traceback
        print(f"\nINTEGRATION TEST ERROR: {e}")
        traceback.print_exc()
    finally:
        # Cleanup
        print("Cleaning up database test data...")
        try:
            db.query(EntryExitLog).filter(EntryExitLog.student_id == student.id).delete()
            if 'leave' in locals() and leave:
                db.query(LeaveApproval).filter(LeaveApproval.application_id == leave.id).delete()
                db.query(LeaveApplication).filter(LeaveApplication.id == leave.id).delete()
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Cleanup failed: {e}")
            
        app.dependency_overrides.clear()
        db.close()

if __name__ == "__main__":
    run_integration_test()
