import os

class Settings:
    PROJECT_NAME: str = "JKKM Hostel Management System (HMS)"
    VERSION: str = "2.0.0"
    SECRET_KEY: str = os.getenv("JWT_SECRET", "jkkm_hms_secret_2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8 # 8 hours
    
    # PostgreSQL URI with SQLite fallback for local development
    # NOTE: Render provides DATABASE_URL as postgres:// but SQLAlchemy 2.x requires postgresql://
    _raw_db_url: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(os.path.dirname(__file__), '..', 'hms.db')}"
    )
    DATABASE_URL: str = _raw_db_url.replace("postgres://", "postgresql://", 1) if _raw_db_url.startswith("postgres://") else _raw_db_url

settings = Settings()
