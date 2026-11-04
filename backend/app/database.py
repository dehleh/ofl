"""
Database setup using SQLAlchemy.
Supports SQLite (local dev) and PostgreSQL Flexible Server (Azure Production).
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, scoped_session
from .config import settings

"""
Database setup using SQLAlchemy.
Configured for enterprise concurrency:
- PostgreSQL (Cloud SQL): 20 connections pool, 40 max overflow, pre-ping health check, 1800s recycle.
- SQLite (local dev): WAL (Write-Ahead Logging) journal mode + busy timeout for non-blocking concurrent reads/writes.
"""
import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, scoped_session
from .config import settings

logger = logging.getLogger("ofl.database")

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 30.0}
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        echo=False
    )
    
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()
        except Exception as e:
            logger.debug(f"SQLite PRAGMA WAL initialization notice: {e}")
else:
    # Production Cloud SQL PostgreSQL engine with robust concurrency pool
    engine = create_engine(
        settings.DATABASE_URL,
        pool_size=20,
        max_overflow=40,
        pool_recycle=1800,
        pool_pre_ping=True,
        echo=False
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db_session = scoped_session(SessionLocal)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)
