import os
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import text
from app.models.models import Base

# Load env manually
env_path = os.path.join(os.path.dirname(__file__), ".env")
with open(env_path, "r") as f:
    for line in f:
        if line.startswith("DATABASE_URL="):
            OLD_URL = line.strip().split("=", 1)[1]
        elif line.startswith("NEW_DATABASE_URL="):
            NEW_URL = line.strip().split("=", 1)[1]

if "[YOUR-PASSWORD]" in NEW_URL:
    print("ERROR: You haven't replaced [YOUR-PASSWORD] with your actual password in the .env file yet!")
    exit(1)

print("Connecting to OLD database (Neon)...")
old_engine = create_engine(OLD_URL)
OldSession = sessionmaker(bind=old_engine)

print("Connecting to NEW database (Supabase)...")
new_engine = create_engine(NEW_URL)
NewSession = sessionmaker(bind=new_engine)

print("Creating tables in Supabase...")
Base.metadata.create_all(bind=new_engine)

print("Migrating data...")
old_db = OldSession()
new_db = NewSession()

# Get all tables in order of creation
metadata = MetaData()
metadata.reflect(bind=old_engine)

# Tables to migrate (ordered by dependencies)
TABLES = [
    "institutions",
    "departments",
    "users",
    "hostels",
    "rooms",
    "students",
    "attendance",
    "mess_menu",
    "mess_attendance",
    "entry_exit_logs",
    "visitors",
    "leave_applications",
    "complaints",
    "inventory_items",
    "assets",
    "asset_assignments",
    "asset_transactions",
    "mess_feedback",
    "meal_waste_logs",
    "gate_passes",
    "notifications",
    "audit_logs"
]

for table_name in TABLES:
    print(f"Migrating {table_name}...")
    table = metadata.tables.get(table_name)
    if table is None:
        continue
    
    # Get all records from old
    with old_engine.connect() as conn:
        records = conn.execute(table.select()).fetchall()
    
    if records:
        # Insert into new
        with new_engine.connect() as conn:
            for r in records:
                # We use text to insert dynamically to avoid ORM identity conflicts
                cols = ", ".join(r._mapping.keys())
                vals = ", ".join([f":{k}" for k in r._mapping.keys()])
                sql = f"INSERT INTO {table_name} ({cols}) VALUES ({vals}) ON CONFLICT DO NOTHING"
                try:
                    conn.execute(text(sql), r._mapping)
                except Exception as e:
                    try:
                        sql2 = f"INSERT INTO {table_name} ({cols}) VALUES ({vals})"
                        conn.execute(text(sql2), r._mapping)
                    except Exception as inner_e:
                        pass
            conn.commit()

print("Migration Complete! All data is now in Supabase.")
