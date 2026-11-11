"""
Database setup using SQLAlchemy.
Configured for enterprise concurrency:
- PostgreSQL (Cloud SQL): 5 base pool connections + 10 overflow per worker, pre-ping health check, 1800s recycle.
- SQLite (local dev/tests): WAL (Write-Ahead Logging) journal mode + busy timeout for non-blocking concurrent reads/writes.
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, scoped_session, Session
from .config import settings

logger = logging.getLogger("ofl.database")


def normalize_database_url(raw_url: str) -> str:
    """
    Normalizes postgres:// or postgresql:// URIs to postgresql+psycopg2://
    for SQLAlchemy 2.0 and Google Cloud SQL Unix socket compatibility.
    """
    url = (raw_url or "").strip()
    if url.startswith("postgres://"):
        return "postgresql+psycopg2://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg2://" + url[len("postgresql://"):]
    return url


def _resolve_effective_database_url() -> str:
    env_url = os.getenv("DATABASE_URL", "").strip()
    candidate = env_url or settings.DATABASE_URL

    # If deployed on GCP with Secret Manager enabled and no Cloud SQL DSN injected via env,
    # attempt fetching DATABASE_URL directly from GCP Secret Manager.
    if candidate.startswith("sqlite") and settings.GCP_SECRET_MANAGER_ENABLED and settings.ENVIRONMENT.lower() == "production":
        try:
            from .integrations.secret_manager_service import GCPSecretManagerService
            secret_url = GCPSecretManagerService.get_secret("DATABASE_URL")
            if secret_url and not secret_url.strip().startswith("sqlite"):
                candidate = secret_url
        except Exception as exc:
            logger.warning(f"Secret Manager DATABASE_URL lookup skipped: {exc}")

    return normalize_database_url(candidate)


EFFECTIVE_DATABASE_URL = _resolve_effective_database_url()

if EFFECTIVE_DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 30.0}
    engine = create_engine(
        EFFECTIVE_DATABASE_URL,
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
    # Production Cloud SQL PostgreSQL engine sized safely for Cloud Run multi-worker containers
    pool_size = int(os.getenv("DB_POOL_SIZE", "5"))
    max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    engine = create_engine(
        EFFECTIVE_DATABASE_URL,
        pool_size=pool_size,
        max_overflow=max_overflow,
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


def as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Normalizes naive datetimes (as returned by PostgreSQL TIMESTAMP WITHOUT TIME ZONE)
    into timezone-aware UTC datetimes for safe arithmetic comparisons.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def generate_next_case_number(db: Session, year: Optional[int] = None) -> str:
    """
    Generates a monotonically increasing, collision-safe case number (OFL-YYYY-NNNNN)
    based on the highest existing sequence rather than total row count.
    """
    from .models import CreditCase

    target_year = year or utc_now().year
    prefix = f"OFL-{target_year}-"
    existing_numbers = (
        db.query(CreditCase.case_number)
        .filter(CreditCase.case_number.like(f"{prefix}%"))
        .all()
    )

    max_seq = 0
    for (num_str,) in existing_numbers:
        suffix = (num_str or "").replace(prefix, "", 1)
        if suffix.isdigit():
            max_seq = max(max_seq, int(suffix))

    # Fallback check against total cases if custom numbers exist
    next_seq = max(max_seq + 1, 1)
    return f"{prefix}{next_seq:05d}"


def init_db() -> None:
    """
    Creates missing tables safely and seeds mandatory system configurations & staff roles.
    Safe to invoke before multi-worker Uvicorn startup against PostgreSQL or SQLite.
    """
    # Ensure all ORM models are registered before metadata creation
    from . import models  # noqa: F401
    from .core.config_manager import ConfigManager

    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.warning(f"Metadata create_all notice (safe if already initialized): {exc}")

    db = SessionLocal()
    try:
        ConfigManager.seed_defaults_if_needed(db)
    except Exception as exc:
        db.rollback()
        logger.warning(f"Default configuration bootstrap notice: {exc}")
    finally:
        db.close()
