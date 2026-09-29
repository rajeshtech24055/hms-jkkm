import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import User
from app.security import get_password_hash

engine = create_engine('postgresql://postgres:Thedevil1817%40rdj@db.bchujwojzalibbsnzvee.supabase.co:5432/postgres')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Update Rajesh
r_user = db.query(User).filter(User.email == 'rajeshrcb1817@gmail.com').first()
if r_user:
    r_user.password_hash = get_password_hash('06022006')

# Update Murugan
m_user = db.query(User).filter(User.email == 'murugan88@gmail.com').first()
if m_user:
    m_user.password_hash = get_password_hash('08052008')

db.commit()
print("Updated hashes successfully.")
db.close()
