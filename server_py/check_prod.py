import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import User

engine = create_engine('postgresql://postgres:Thedevil1817%40rdj@db.bchujwojzalibbsnzvee.supabase.co:5432/postgres')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

users = db.query(User).filter(User.email.ilike('%rajeshrcb%')).all()
for u in users:
    print(f"User ID: {u.id}, Email: {u.email}, Role: {u.role}")

db.close()
