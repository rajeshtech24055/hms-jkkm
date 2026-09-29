import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Student

engine = create_engine('postgresql://postgres:Thedevil1817%40rdj@db.bchujwojzalibbsnzvee.supabase.co:5432/postgres')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

students = db.query(Student).all()
for s in students:
    if s.name in ["Hari R", "Selvi  S", "Suresh Natarajan", "Pradeep V", "Thirusha P"]:
        print(f"Name: {s.name}, Active: {s.active}, Inst: {s.institution_id}")

db.close()
