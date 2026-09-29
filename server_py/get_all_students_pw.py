import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Student, User

engine = create_engine('postgresql://postgres:Thedevil1817%40rdj@db.bchujwojzalibbsnzvee.supabase.co:5432/postgres')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

students = db.query(Student).all()
print("NAME | EMAIL (USERNAME) | EXPECTED DEFAULT PASSWORD")
print("-" * 60)
for s in students:
    default_pw = "admin123"
    if s.dob:
        parts = s.dob.split('-')
        if len(parts) == 3:
            default_pw = parts[2] + parts[1] + parts[0]
            
    print(f"{s.name} | {s.email} | {default_pw}")

db.close()
