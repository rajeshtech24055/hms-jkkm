import os
from sqlalchemy import create_engine

db_url = "postgresql://neondb_owner:npg_OE9GvTqV7xhw@ep-polished-firefly-b5ks1lky-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"
print(f"Testing connection to {db_url}...")

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        print("SUCCESS! Connected to Neon PostgreSQL!")
except Exception as e:
    print(f"FAILED: {e}")
    
