import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import User, Student
from app.security import verify_password

engine = create_engine('postgresql://postgres:Thedevil1817%40rdj@db.bchujwojzalibbsnzvee.supabase.co:5432/postgres')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Check all non-super-admin users
emails_to_check = [
    ('admin.eng@jkkm.edu', 'admin123'),
    ('food@jkkm.edu', 'admin123'),
    ('mess@jkkm.edu', 'admin123'),
    ('inventory@jkkm.edu', 'admin123'),
    ('gate@jkkm.edu', 'admin123'),
    ('hodcse@gmail.com', 'admin123'),
    ('sridharan123@gmail.com', 'admin123'),
    ('prashanth123@gmail.com', 'admin123'),
    ('murugashankar123@gmail.com', 'admin123'),
    ('vijayaraghavan34@gmail.com', 'admin123'),
]

for email, pw in emails_to_check:
    u = db.query(User).filter(User.email == email).first()
    if u:
        result = verify_password(pw, u.password_hash or '')
        print(f"{email}: verify '{pw}' = {result}, hash prefix: {u.password_hash[:15] if u.password_hash else 'NULL'}")
    else:
        print(f"{email}: NOT FOUND")

db.close()
