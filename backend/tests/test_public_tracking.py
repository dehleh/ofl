"""
Tests for Public Customer Loan Application Tracking API
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Customer, Application, CreditCase, CaseState


@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def sample_case(test_db):
    cust = Customer(
        customer_type="SME",
        name="PUBLIC TEST ENTERPRISE",
        email="borrower@example.ng",
        phone="08011223344",
        bvn="22334455667"
    )
    test_db.add(cust)
    test_db.flush()

    app_record = Application(
        customer_id=cust.id,
        amount=25_000_000.0,
        tenor=12,
        purpose="Expansion of warehousing facilities",
        intake_channel="OFL_DIRECT",
        status="UNDER_ASSESSMENT"
    )
    test_db.add(app_record)
    test_db.flush()

    credit_case = CreditCase(
        case_number="OFL-2026-TRACK-99",
        application_id=app_record.id,
        state=CaseState.ANALYST_REVIEW.value,
        assigned_owner="Credit Analyst"
    )
    test_db.add(credit_case)
    test_db.commit()
    test_db.refresh(credit_case)
    return credit_case


def test_public_tracking_success(test_db, sample_case):
    """
    Ensures applicants can track their loan progress publicly without exposing
    private internal credit memos or committee votes.
    """
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    res = client.get(f"/api/v1/intake/track/{sample_case.case_number}")
    assert res.status_code == 200
    data = res.json()
    assert data["case_number"] == sample_case.case_number
    assert data["applicant_name"] == "PUBLIC TEST ENTERPRISE"
    assert data["amount"] == 25_000_000.0
    assert "status_label" in data
    assert "message" in data
    # Ensure internal private fields are NOT present
    assert "cam_data" not in data
    assert "source_snapshot" not in data
    assert "committee_sign_offs" not in data

    app.dependency_overrides.clear()


def test_public_tracking_not_found(test_db):
    """
    Ensures invalid reference returns 404 with helpful error message.
    """
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    res = client.get("/api/v1/intake/track/OFL-INVALID-REF-999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()

    app.dependency_overrides.clear()
