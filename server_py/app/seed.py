from datetime import datetime, timedelta
import random
from sqlalchemy.orm import Session
from app.database import engine, Base, SessionLocal
from app.security import get_password_hash
from app.models.models import (
    Institution, Department, User, Room, Student, EntryExitLog,
    LeaveApplication, MessItem, MessUsageLog, MessMealsServed,
    MessFoodWastage, WeeklyMenu, MessFeedback, AssetInventoryItem,
    MaintenanceRequest, Notice, NotificationLog, DailySnapshot
)

def seed_database():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        if db.query(Institution).count() > 0:
            print("Database already seeded.")
            return

        hash_pwd = get_password_hash("admin123")

        # Institutions
        eng = Institution(name="JKKM College of Engineering", code="ENG")
        agri = Institution(name="JKKM College of Agriculture", code="AGRI")
        pharm = Institution(name="JKKM College of Pharmacy", code="PHARM")
        db.add_all([eng, agri, pharm])
        db.commit()

        # Departments
        cs = Department(name="Computer Science", institution_id=eng.id)
        mech = Department(name="Mechanical Engineering", institution_id=eng.id)
        eee = Department(name="Electrical Engineering", institution_id=eng.id)
        agriSci = Department(name="Agricultural Science", institution_id=agri.id)
        horti = Department(name="Horticulture", institution_id=agri.id)
        pharmSci = Department(name="Pharmaceutical Science", institution_id=pharm.id)
        pharmChem = Department(name="Pharmaceutical Chemistry", institution_id=pharm.id)
        db.add_all([cs, mech, eee, agriSci, horti, pharmSci, pharmChem])
        db.commit()

        # Rooms
        r101 = Room(room_no="101", block="A", floor=1, capacity=4, gender="Male", institution_id=eng.id)
        r102 = Room(room_no="102", block="A", floor=1, capacity=4, gender="Male", institution_id=eng.id)
        r103 = Room(room_no="103", block="A", floor=1, capacity=3, gender="Male", institution_id=eng.id)
        r201 = Room(room_no="201", block="B", floor=2, capacity=4, gender="Female", institution_id=eng.id)
        r202 = Room(room_no="202", block="B", floor=2, capacity=4, gender="Female", institution_id=eng.id)
        r301 = Room(room_no="301", block="C", floor=1, capacity=4, gender="Male", institution_id=agri.id)
        r302 = Room(room_no="302", block="C", floor=1, capacity=4, gender="Female", institution_id=agri.id)
        r401 = Room(room_no="401", block="D", floor=1, capacity=3, gender="Male", institution_id=pharm.id)
        r402 = Room(room_no="402", block="D", floor=1, capacity=3, gender="Female", institution_id=pharm.id)
        db.add_all([r101, r102, r103, r201, r202, r301, r302, r401, r402])
        db.commit()

        # Users
        users = [
            User(name="Super Admin", email="superadmin@jkkm.edu", password_hash=hash_pwd, role="SUPER_ADMIN", phone="9000000001"),
            User(name="ENG Hostel Admin", email="admin.eng@jkkm.edu", password_hash=hash_pwd, role="HOSTEL_ADMIN", institution_id=eng.id, phone="9000000002"),
            User(name="Mr. Rajesh Kumar", email="warden.eng@jkkm.edu", password_hash=hash_pwd, role="WARDEN", institution_id=eng.id, gender="Male", phone="9000000003"),
            User(name="Mrs. Priya Lakshmi", email="warden.eng.g@jkkm.edu", password_hash=hash_pwd, role="WARDEN", institution_id=eng.id, gender="Female", phone="9000000004"),
            User(name="Dr. Anand Venkat", email="tutor.cs@jkkm.edu", password_hash=hash_pwd, role="TUTOR", institution_id=eng.id, dept_id=cs.id, year="2nd", phone="9000000005"),
            User(name="Dr. Karthik Rajan", email="hod.cs@jkkm.edu", password_hash=hash_pwd, role="HOD", institution_id=eng.id, dept_id=cs.id, phone="9000000006"),
            User(name="Dr. S. Muthuraman", email="principal.eng@jkkm.edu", password_hash=hash_pwd, role="PRINCIPAL", institution_id=eng.id, phone="9000000007"),
            User(name="Food Admin", email="food@jkkm.edu", password_hash=hash_pwd, role="FOOD_ADMIN", phone="9000000008"),
            User(name="Mess Worker", email="mess@jkkm.edu", password_hash=hash_pwd, role="MESS_WORKER", phone="9000000009"),
            User(name="Inventory Admin", email="inventory@jkkm.edu", password_hash=hash_pwd, role="INVENTORY_ADMIN", phone="9000000010"),
            User(name="Gate Staff", email="gate@jkkm.edu", password_hash=hash_pwd, role="GATE_STAFF", phone="9000000011")
        ]
        db.add_all(users)
        db.commit()

        # Students
        students_data = [
            Student(reg_no="ENG001", name="Arjun Krishnamurthy", gender="Male", institution_id=eng.id, dept_id=cs.id, year="2nd", batch="2024-2028", room_id=r101.id, bed_no=1, guardian_name="Krishnamurthy S", guardian_phone="9876501001", blood_group="O+", mobile="8765001001", email="arjun@student.jkkm.edu", qr_token="QR001ENG"),
            Student(reg_no="ENG002", name="Vijay Sundaram", gender="Male", institution_id=eng.id, dept_id=cs.id, year="2nd", batch="2024-2028", room_id=r101.id, bed_no=2, guardian_name="Sundaram R", guardian_phone="9876501002", blood_group="A+", mobile="8765001002", email="vijay@student.jkkm.edu", qr_token="QR002ENG"),
            Student(reg_no="ENG003", name="Ramesh Babu", gender="Male", institution_id=eng.id, dept_id=mech.id, year="3rd", batch="2023-2027", room_id=r102.id, bed_no=1, guardian_name="Babu N", guardian_phone="9876501003", blood_group="B+", mobile="8765001003", email="ramesh@student.jkkm.edu", qr_token="QR003ENG"),
            Student(reg_no="ENG004", name="Suresh Natarajan", gender="Male", institution_id=eng.id, dept_id=eee.id, year="1st", batch="2025-2029", room_id=r102.id, bed_no=2, guardian_name="Natarajan K", guardian_phone="9876501004", blood_group="AB+", mobile="8765001004", email="suresh@student.jkkm.edu", qr_token="QR004ENG"),
            Student(reg_no="ENG005", name="Karthik Murugan", gender="Male", institution_id=eng.id, dept_id=cs.id, year="4th", batch="2022-2026", room_id=r103.id, bed_no=1, guardian_name="Murugan A", guardian_phone="9876501005", blood_group="O-", mobile="8765001005", email="karthik@student.jkkm.edu", qr_token="QR005ENG"),
            Student(reg_no="ENG006", name="Priya Devi", gender="Female", institution_id=eng.id, dept_id=cs.id, year="2nd", batch="2024-2028", room_id=r201.id, bed_no=1, guardian_name="Devi S", guardian_phone="9876501006", blood_group="A+", mobile="8765001006", email="priya@student.jkkm.edu", qr_token="QR006ENG"),
            Student(reg_no="ENG007", name="Kavitha Rajan", gender="Female", institution_id=eng.id, dept_id=eee.id, year="3rd", batch="2023-2027", room_id=r201.id, bed_no=2, guardian_name="Rajan M", guardian_phone="9876501007", blood_group="B-", mobile="8765001007", email="kavitha@student.jkkm.edu", qr_token="QR007ENG"),
            Student(reg_no="AGRI001", name="Selvam Palanivel", gender="Male", institution_id=agri.id, dept_id=agriSci.id, year="2nd", batch="2024-2028", room_id=r301.id, bed_no=1, guardian_name="Palanivel G", guardian_phone="9876502001", blood_group="A+", mobile="8765002001", email="selvam@student.jkkm.edu", qr_token="QR001AGRI"),
            Student(reg_no="PHARM001", name="Ravi Chandran", gender="Male", institution_id=pharm.id, dept_id=pharmSci.id, year="2nd", batch="2024-2028", room_id=r401.id, bed_no=1, guardian_name="Chandran V", guardian_phone="9876503001", blood_group="A-", mobile="8765003001", email="ravi@student.jkkm.edu", qr_token="QR001PHARM")
        ]
        db.add_all(students_data)
        db.commit()

        # Student User Login
        db.add(User(name="Arjun Krishnamurthy", email="arjun@student.jkkm.edu", password_hash=hash_pwd, role="STUDENT", institution_id=eng.id, dept_id=cs.id, year="2nd", gender="Male", phone="8765001001"))
        db.commit()

        # Mess Grocery Items
        mess_items = [
            MessItem(name="Rice (Ponni)", category="Grains", unit="kg", current_stock=450.0, reorder_level=100.0, reorder_qty=200.0, lead_time_days=3, supplier="Sri Murugan Traders", unit_price=55.0),
            MessItem(name="Toor Dal", category="Pulses", unit="kg", current_stock=80.0, reorder_level=30.0, reorder_qty=60.0, lead_time_days=4, supplier="Quality Foods", unit_price=140.0),
            MessItem(name="Sunflower Oil", category="Oils", unit="litre", current_stock=25.0, reorder_level=20.0, reorder_qty=50.0, lead_time_days=2, supplier="Gold Drop", unit_price=130.0),
            MessItem(name="Tomatoes", category="Vegetables", unit="kg", current_stock=15.0, reorder_level=20.0, reorder_qty=40.0, lead_time_days=2, supplier="Local Market", unit_price=35.0),
            MessItem(name="Onions", category="Vegetables", unit="kg", current_stock=60.0, reorder_level=25.0, reorder_qty=50.0, lead_time_days=3, supplier="Local Market", unit_price=40.0),
            MessItem(name="Milk", category="Dairy", unit="litre", current_stock=8.0, reorder_level=20.0, reorder_qty=60.0, lead_time_days=1, supplier="Aavin", unit_price=48.0)
        ]
        db.add_all(mess_items)
        db.commit()

        # Backfill 14 Days of Daily Snapshots & Mess Logs
        for i in range(14, -1, -1):
            date_str = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
            total_st = 800
            leaves_cnt = 40 + random.randint(0, 15)
            outside_cnt = 25 + random.randint(0, 10)
            exp_occ = total_st - leaves_cnt
            act_head = exp_occ - outside_cnt + random.randint(-5, 5)
            b_cnt = act_head - random.randint(10, 25)
            l_cnt = act_head - random.randint(5, 15)
            s_cnt = act_head - random.randint(20, 35)
            d_cnt = act_head - random.randint(5, 20)
            cost = act_head * 85.0
            wastage = 12.0 + random.uniform(0.0, 10.0)

            # Insert Daily Snapshot
            db.add(DailySnapshot(
                snapshot_date=date_str,
                total_students=total_st,
                students_on_leave=leaves_cnt,
                students_outside=outside_cnt,
                expected_occupancy=exp_occ,
                actual_headcount=act_head,
                breakfast_count=b_cnt,
                lunch_count=l_cnt,
                snacks_count=s_cnt,
                dinner_count=d_cnt,
                total_food_cost=cost,
                total_wastage_kg=round(wastage, 1),
                open_complaints=random.randint(1, 5),
                open_tickets=random.randint(0, 3)
            ))

            # Insert Mess Meals Served
            db.add(MessMealsServed(
                date=date_str,
                students_served=act_head,
                breakfast_count=b_cnt,
                lunch_count=l_cnt,
                snacks_count=s_cnt,
                dinner_count=d_cnt
            ))

            # Insert Mess Food Wastage
            db.add(MessFoodWastage(
                date=date_str,
                category="General",
                prepared_qty=act_head * 0.45,
                consumed_qty=(act_head * 0.45) - wastage,
                wasted_qty=round(wastage, 1),
                unit="kg",
                reason="Routine Mess Operation"
            ))

        db.commit()
        print("✅ Database successfully seeded with sample data and 14-day AI historical snapshots!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
