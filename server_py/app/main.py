import os
import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base
from app.seed import seed_database
from app.routes import (
    auth, users, students, rooms, hostels, departments, gate, leaves, mess,
    mess_analytics, inventory, maintenance, vacate, sos, notices,
    ai_forecast, dashboard, analytics, audit, menu, mess_feedback,
    search, notifications
)

# 1. Import Socket.IO Server
from app.socket import sio

# 2. Initialize FastAPI Application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# 3. Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Mount Static Uploads Directory
upload_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

# Apply database patches on startup
from sqlalchemy import text
@app.on_event("startup")
def startup_event():
    try:
        with engine.begin() as conn:
            # Existing patches
            try:
                conn.execute(text("ALTER TABLE students ADD COLUMN dob VARCHAR;"))
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE students ADD COLUMN qr_token VARCHAR;"))
            except Exception:
                pass
            # New: Create hostels table
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS hostels (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR NOT NULL,
                        gender VARCHAR NOT NULL,
                        description VARCHAR
                    );
                """))
            except Exception:
                pass
            # New: Add hostel_id to rooms
            try:
                conn.execute(text("ALTER TABLE rooms ADD COLUMN hostel_id INTEGER REFERENCES hostels(id);"))
            except Exception:
                pass
            # Seed default hostels if none exist
            try:
                result = conn.execute(text("SELECT COUNT(*) FROM hostels"))
                count = result.scalar()
                if count == 0:
                    conn.execute(text("""
                        INSERT INTO hostels (name, gender, description) VALUES
                        ('Boys Hostel', 'Male', 'Main Boys Hostel'),
                        ('Girls Hostel', 'Female', 'Main Girls Hostel');
                    """))
            except Exception as e:
                print(f"Hostel seed failed: {e}")
    except Exception as e:
        print(f"Failed to patch DB: {e}")

# 5. Socket.IO Event Handlers
@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
async def sos_trigger(sid, data):
    print(f"SOS Triggered via Socket: {data}")
    await sio.emit("sos_alert", data)

# 6. Mount Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(students.router)
app.include_router(rooms.router)
app.include_router(hostels.router)
app.include_router(departments.router)
app.include_router(gate.router)
app.include_router(leaves.router)
app.include_router(mess.router)
app.include_router(mess_analytics.router)
app.include_router(inventory.router)
app.include_router(maintenance.router)
app.include_router(vacate.router)
app.include_router(sos.router)
app.include_router(notices.router)
app.include_router(ai_forecast.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(audit.router)
app.include_router(menu.router)
app.include_router(mess_feedback.router)
app.include_router(search.router)
app.include_router(notifications.router)

# 7. Wrap FastAPI app with Socket.IO ASGI app
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

@app.on_event("startup")
def on_startup():
    print("[INIT] Initializing Python FastAPI Engine & Database...")
    seed_database()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:socket_app", host="0.0.0.0", port=5000, reload=True)
