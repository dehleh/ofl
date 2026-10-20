"""
Unit Tests for BESTO Ingestion and Acceptance Criteria (PRD Section 17.4)
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import CreditCase, IntegrationEvent, ExceptionItem
from app.integrations.besto_adapter import BestoAdapter

@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_besto_1_5m_creates_exactly_one_case(test_db):
    """
    Acceptance Criteria 17.4: A BESTO application of ₦1.5m creates exactly one OFL credit case
    and enters the credit analyst queue after validation.
    """
    payload = {
        "source_system": "BESTO",
        "source_application_id": "BST-TEST-1001",
        "requested_amount_ngn": 1_500_000.0,
        "applicant_details": {
            "name": "Chidi Okonkwo",
            "email": "chidi@example.ng",
            "phone": "+2348011112222",
            "bvn": "22334455667"
        },
        "kyc_evidence": {
            "status": "PASSED",
            "provider_ref": "YV-TEST-889"
        },
        "submitted_at": "2026-10-20T10:00:00Z",
        "schema_version": "1.0"
    }
    
    ok, res = BestoAdapter.ingest_payload(test_db, payload)
    assert ok is True
    assert res["is_replay"] is False
    assert res["case_number"].startswith("OFL-")
    
    case = test_db.query(CreditCase).filter(CreditCase.id == res["case_id"]).first()
    assert case is not None
    assert case.state == "Analyst Review"
    assert case.application.amount == 1_500_000.0

def test_besto_deduplication_replay_never_duplicates(test_db):
    """
    Acceptance Criteria 17.4: Replaying the same BESTO application twice never creates a second case.
    """
    payload = {
        "source_system": "BESTO",
        "source_application_id": "BST-TEST-REPLAY",
        "requested_amount_ngn": 1_200_000.0,
        "applicant_details": {
            "name": "Zainab Bello",
            "email": "zainab@example.ng",
            "bvn": "22998877665"
        },
        "submitted_at": "2026-10-20T11:00:00Z"
    }
    
    # First delivery
    ok1, res1 = BestoAdapter.ingest_payload(test_db, payload)
    assert ok1 is True
    assert res1["is_replay"] is False
    
    case_count_1 = test_db.query(CreditCase).count()
    assert case_count_1 == 1
    
    # Replay same delivery
    ok2, res2 = BestoAdapter.ingest_payload(test_db, payload)
    assert ok2 is True
    assert res2["is_replay"] is True
    
    case_count_2 = test_db.query(CreditCase).count()
    assert case_count_2 == 1  # Still exactly 1 case!

def test_besto_boundary_rule(test_db):
    """
    Section 17.1 & 17.4: ₦2m exact is accepted in BESTO. > ₦2m is quarantined / rejected.
    """
    # Exactly 2,000,000 is accepted
    p_exact = {
        "source_system": "BESTO",
        "source_application_id": "BST-TEST-2M-EXACT",
        "requested_amount_ngn": 2_000_000.0,
        "applicant_details": {"name": "Boundary Test Person"}
    }
    ok_exact, res_exact = BestoAdapter.ingest_payload(test_db, p_exact)
    assert ok_exact is True
    
    # 2,000,001 is out of BESTO bounds and quarantined
    p_over = {
        "source_system": "BESTO",
        "source_application_id": "BST-TEST-OVER",
        "requested_amount_ngn": 2_000_001.0,
        "applicant_details": {"name": "Over Limit"}
    }
    ok_over, res_over = BestoAdapter.ingest_payload(test_db, p_over)
    assert ok_over is False
    assert res_over["quarantined"] is True

def test_besto_incomplete_kyc_creates_exception_without_losing_case(test_db):
    """
    Section 17.4: A BESTO import with incomplete KYC enters an owned verification exception
    without silently losing the case.
    """
    payload = {
        "source_system": "BESTO",
        "source_application_id": "BST-TEST-NO-KYC",
        "requested_amount_ngn": 800_000.0,
        "applicant_details": {"name": "Incomplete KYC User"}
        # Note: no kyc_evidence provided
    }
    ok, res = BestoAdapter.ingest_payload(test_db, payload)
    assert ok is True
    
    # Verify exception exists
    exc = test_db.query(ExceptionItem).filter(ExceptionItem.case_id == res["case_id"]).first()
    assert exc is not None
    assert exc.category == "KYC_MISMATCH"
    assert exc.owner == "KYC Officer / Compliance"
    assert exc.status == "OPEN"
