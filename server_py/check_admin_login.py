import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import User, Student
from app.security import verify_password

engine = create_engine('postgresql://postgres:Thedevil1817%40rdj@db.bchujwojzalibbsnzvee.supabase.co:5432/postgres')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Check all SUPER_ADMIN users
print("=== SUPER_ADMIN Users ===")
admins = db.query(User).filter(User.role == 'SUPER_ADMIN').all()
for u in admins:
    v = verify_password('admin123', u.password_hash or '')
    print(f"Email: {u.email}, Active: {u.active}, Hash: {u.password_hash[:30] if u.password_hash else 'NULL'} ... | admin123 works: {v}")

print("\n=== All Users (non-student) ===")
users = db.query(User).filter(User.role != 'STUDENT').all()
for u in users:
    print(f"Email: {u.email}, Role: {u.role}, Active: {u.active}, HasHash: {bool(u.password_hash)}")

db.close()
