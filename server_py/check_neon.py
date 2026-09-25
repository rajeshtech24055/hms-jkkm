import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

URL = "postgresql://neondb_owner:npg_OE9GvTqV7xhw@ep-polished-firefly-b5ks1lky-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"
engine = create_engine(URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Check arjun
res = db.execute(text("SELECT email, password_hash FROM students WHERE email='arjun@student.jkkm.edu';"))
for r in res:
    print(r)
