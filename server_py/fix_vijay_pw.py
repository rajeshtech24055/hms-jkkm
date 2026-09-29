"""
Reset password for vijayaraghavan34@gmail.com to admin123
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import User
from app.security import get_password_hash

engine = create_engine('postgresql://postgres:Thedevil1817%40rdj@db.bchujwojzalibbsnzvee.supabase.co:5432/postgres')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

u = db.query(User).filter(User.email == 'vijayaraghavan34@gmail.com').first()
if u:
    new_hash = get_password_hash('admin123')
    u.password_hash = new_hash
    db.commit()
    print(f"DONE: Reset password for {u.email} to 'admin123'")
else:
    print("User not found!")

db.close()
