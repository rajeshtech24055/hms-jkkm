import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import User

engine = create_engine('postgresql://postgres:Thedevil1817%40rdj@db.bchujwojzalibbsnzvee.supabase.co:5432/postgres')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

user = db.query(User).filter(User.name == 'Super Admin').first()
if user:
    print(f"Name: {user.name}, Email: {user.email}, Role: {user.role}, Inst_ID: {user.institution_id}")
else:
    print("User 'Super Admin' not found by name.")

db.close()
