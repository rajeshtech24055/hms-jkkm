import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Student

engine = create_engine('postgresql://postgres:Thedevil1817%40rdj@db.bchujwojzalibbsnzvee.supabase.co:5432/postgres')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

students = db.query(Student).order_by(Student.id.desc()).limit(5).all()
for s in students:
    print(f"ID: {s.id}, Name: {s.name}, Reg: {s.reg_no}, Inst: {s.institution_id}")

db.close()
