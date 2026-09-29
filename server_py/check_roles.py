import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import User

engine = create_engine('postgresql://postgres:Thedevil1817%40rdj@db.bchujwojzalibbsnzvee.supabase.co:5432/postgres')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

user = db.query(User).filter(User.username == 'Super Admin').first()
if user:
    print(f"Role: {user.role}, Insts: {user.allowed_institutions}")
else:
    print("User 'Super Admin' not found by username. Trying to list admins.")
    users = db.query(User).filter(User.role.ilike('%ADMIN%')).all()
    for u in users:
        print(f"Name: {u.name}, Username: {u.username}, Role: {u.role}, Insts: {u.allowed_institutions}")

db.close()
