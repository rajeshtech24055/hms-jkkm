import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import User, Student

engine = create_engine('postgresql://postgres:Thedevil1817%40rdj@db.bchujwojzalibbsnzvee.supabase.co:5432/postgres')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

emails = ['rajeshrcb1817@gmail.com', 'murugan88@gmail.com']
users = db.query(User).filter(User.email.in_(emails)).all()
for u in users:
    print(f"User Email: {u.email}, Hash: {u.password_hash}")

db.close()
