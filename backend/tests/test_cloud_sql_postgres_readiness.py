"""
Tests for Cloud SQL PostgreSQL Readiness:
- URL normalization (postgres:// / postgresql:// -> postgresql+psycopg2://)
- Timezone-safe UTC arithmetic helper (PostgreSQL naive timestamps vs UTC aware)
- Collision-safe sequential case number generator
- Complete ORM schema DDL compilation against PostgreSQL dialect
- Telemetry GCP infrastructure DB reporting
"""
import sys
import os
from datetime import datetime, timezone
import pytest
from sqlalchemy import create_engine, schema
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.database import (
    Base,
    get_db,
    normalize_database_url,
    as_utc,
    generate_next_case_number,
)
from app.models import Customer, Application, CreditCase, CaseState, IntakeChannel


TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def test_normalize_database_url():
    assert (
        normalize_database_url("postgres://u:p@localhost:5432/ofl")
        == "postgresql+psycopg2://u:p@localhost:5432/ofl"
    )
    assert (
        normalize_database_url("postgresql://u:p@/ofl?host=/cloudsql/proj:reg:inst")
        == "postgresql+psycopg2://u:p@/ofl?host=/cloudsql/proj:reg:inst"
    )
    assert (
        normalize_database_url("postgresql+psycopg2://u:p@/ofl")
        == "postgresql+psycopg2://u:p@/ofl"
    )
    assert normalize_database_url("sqlite:///./ofl.db") == "sqlite:///./ofl.db"


def test_as_utc_handles_naive_and_aware():
    assert as_utc(None) is None
    naive = datetime(2026, 11, 11, 12, 0, 0)
    aware = as_utc(naive)
    assert aware is not None
    assert aware.tzinfo == timezone.utc
    assert (aware - datetime(2026, 11, 11, 11, 0, 0, tzinfo=timezone.utc)).total_seconds() == 3600


def test_postgresql_ddl_compilation():
    """
    Compiles CREATE TABLE DDL for every model in Base.metadata under the PostgreSQL dialect
    to catch dialect-incompatible column types or defaults before Cloud SQL deployment.
    """
    pg_dialect = postgresql.dialect()
    compiled_tables = []
    for table in Base.metadata.sorted_tables:
        ddl = str(schema.CreateTable(table).compile(dialect=pg_dialect))
        assert f"CREATE TABLE {table.name}" in ddl
        compiled_tables.append(table.name)

    assert "credit_cases" in compiled_tables
    assert "loan_performances" in compiled_tables
    assert "in_app_notifications" in compiled_tables
    assert "staff_users" in compiled_tables
    assert "system_configurations" in compiled_tables


def test_generate_next_case_number_avoids_delete_collisions(db_session):
    year = datetime.now(timezone.utc).year
    assert generate_next_case_number(db_session, year=year) == f"OFL-{year}-00001"

    cust = Customer(customer_type="INDIVIDUAL", name="Test Obligor")
    db_session.add(cust)
    db_session.flush()

    app_rec = Application(
        customer_id=cust.id,
        amount=5_000_000.0,
        tenor=12,
        purpose="Working Capital",
        intake_channel=IntakeChannel.OFL_DIRECT.value,
    )
    db_session.add(app_rec)
    db_session.flush()

    # Simulate case #00005 existing even though total count is 1 (e.g. gaps from deletions)
    c5 = CreditCase(
        application_id=app_rec.id,
        case_number=f"OFL-{year}-00005",
        state=CaseState.ANALYST_REVIEW.value,
        revision=1,
    )
    db_session.add(c5)
    db_session.commit()

    assert generate_next_case_number(db_session, year=year) == f"OFL-{year}-00006"


def test_gcp_infrastructure_reports_database_metadata(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            res = client.get("/api/v1/telemetry/gcp-infrastructure")
            assert res.status_code == 200
            db_info = res.json()["services"]["database"]
            assert "dialect" in db_info
            assert "cloud_sql_active" in db_info
            assert db_info["status"] == "CONNECTED"
    finally:
        app.dependency_overrides.clear()

