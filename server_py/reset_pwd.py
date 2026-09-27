import os
import bcrypt
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv('d:/HMS JKKM/server_py/.env')

pwd = b'admin123'
salt = bcrypt.gensalt(rounds=12)
hashed = bcrypt.hashpw(pwd, salt)
decoded = hashed.decode('utf-8')

URL = os.getenv('DATABASE_URL')
engine = create_engine(URL)

with engine.connect() as conn:
    sql = text("UPDATE users SET password_hash = :hash")
    conn.execute(sql, {"hash": decoded})
    conn.commit()
    print('ALL user passwords reset successfully to admin123!')
