import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import User, Student
from app.security import verify_password

engine = create_engine('postgresql://postgres:Thedevil1817%40rdj@db.bchujwojzalibbsnzvee.supabase.co:5432/postgres')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

u = db.query(User).filter(User.email == 'rajeshrcb1817@gmail.com').first()
s = db.query(Student).filter(Student.email == 'rajeshrcb1817@gmail.com').first()
if u:
    print(f"User ID: {u.id}, Email: {u.email}, Role: {u.role}")
    print(f"Verify 'admin123': {verify_password('admin123', u.password_hash)}")
    if s and s.dob:
        parts = s.dob.split('-')
        if len(parts) == 3:
            dob_pw = parts[2] + parts[1] + parts[0]
            print(f"Student DOB: {s.dob}")
            print(f"Verify '{dob_pw}': {verify_password(dob_pw, u.password_hash)}")
else:
    print("User not found")
db.close()
