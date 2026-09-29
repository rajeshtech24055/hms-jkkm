import sys
import os

# Add server_py to path to import app modules
sys.path.append(os.path.abspath('server_py'))

from app.database import SessionLocal
from app.models.models import User, Student
from app.security import get_password_hash, verify_password

db = SessionLocal()

print("--- RECENT STAFF USERS ---")
staff = db.query(User).filter(User.role != 'STUDENT', User.role != 'SUPER_ADMIN').order_by(User.id.desc()).limit(5).all()
for u in staff:
    is_valid = verify_password('admin123', u.password_hash)
    print(f"ID: {u.id} | Name: {u.name} | Email: {u.email} | Role: {u.role} | Valid admin123: {is_valid}")

print("\n--- RECENT STUDENTS ---")
student_users = db.query(User).filter(User.role == 'STUDENT').order_by(User.id.desc()).limit(5).all()
for u in student_users:
    student = db.query(Student).filter(Student.email == u.email).first()
    dob_pwd = "UNKNOWN"
    if student and student.dob:
        parts = student.dob.split('-')
        if len(parts) == 3:
            dob_pwd = parts[2] + parts[1] + parts[0]
            
    is_valid_dob = verify_password(dob_pwd, u.password_hash)
    is_valid_admin = verify_password('admin123', u.password_hash)
    print(f"ID: {u.id} | Email: {u.email} | DOB Password: {dob_pwd} | Valid DOB Pwd: {is_valid_dob} | Valid admin123: {is_valid_admin}")
