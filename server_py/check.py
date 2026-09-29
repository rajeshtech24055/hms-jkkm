import sys
from app.database import SessionLocal
from app.models.models import Student, User
from app.security import get_password_hash, verify_password

db = SessionLocal()
s = db.query(Student).order_by(Student.id.desc()).first()
u = db.query(User).filter(User.email == s.email, User.role == 'STUDENT').first()
print(f'Student email: {s.email}')
print(f'DOB: {s.dob}')
print(f'Verify 15012005: {verify_password("15012005", u.password_hash)}')
