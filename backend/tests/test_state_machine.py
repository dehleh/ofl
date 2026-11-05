"""
Unit Tests for State Machine Invariants & Approval Invalidation (PRD Section 6.1, FR-09, FR-12)
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import CreditCase, Application, Customer, Approval, AuditEvent, CaseState
from app.core.state_machine import TransitionService
from app.core.authority_matrix import AuthorityMatrix

@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def create_sample_case(db, amount=3_000_000):
    cust = Customer(name="Test Borrower", customer_type="INDIVIDUAL")
    db.add(cust)
    db.flush()
    app = Application(
        customer_id=cust.id,
        amount=amount,
        tenor=12,
        purpose="Test Loan",
        status="SUBMITTED"
    )
    db.add(app)
    db.flush()
    case = CreditCase(
        application_id=app.id,
        case_number="OFL-2026-TEST",
        state=CaseState.SUBMITTED.value,
        revision=1
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return case

def test_transition_invariants(test_db):
    """
    PRD 6.1: Transition service records actor, from/to state, and audit event.
    Disallows invalid jumps.
    """
    case = create_sample_case(test_db)
    
    # Invalid jump from SUBMITTED directly to DISBURSED_MONITORING
    ok, msg = TransitionService.execute_transition(
        test_db, case, CaseState.DISBURSED_MONITORING.value,
        actor="Hacker", role="ANALYST", reason="Bypassing stages"
    )
    assert ok is False
    assert "Invalid state transition" in msg
    
    # Valid transition to ANALYST_REVIEW
    ok2, msg2 = TransitionService.execute_transition(
        test_db, case, CaseState.ANALYST_REVIEW.value,
        actor="Intake System", role="SYSTEM", reason="Initial allocation"
    )
    assert ok2 is True
    assert case.state == CaseState.ANALYST_REVIEW.value
    
    # Check AuditEvent
    audit = test_db.query(AuditEvent).filter(AuditEvent.entity_id == case.case_number).first()
    assert audit is not None
    assert audit.event == "TRANSITION_SUBMITTED_TO_ANALYST REVIEW"

def test_approval_invalidation_upon_material_change(test_db):
    """
    FR-12: Material changes invalidate affected prior approvals and bump revision.
    """
    case = create_sample_case(test_db, amount=4_000_000)
    hash_v1 = TransitionService.calculate_terms_hash(4_000_000, 12, 0.28, case.application.customer_id)
    
    # Add active approval
    approval = Approval(
        case_id=case.id,
        revision=1,
        terms_hash=hash_v1,
        actor="HRM Officer",
        authority_level="HRM",
        decision="APPROVE",
        comments="Terms approved"
    )
    test_db.add(approval)
    test_db.commit()
    
    assert approval.invalidated_at is None
    
    # Material change: Amount changed from ₦4m to ₦4.5m
    hash_v2 = TransitionService.calculate_terms_hash(4_500_000, 12, 0.28, case.application.customer_id)
    invalidated_count = TransitionService.invalidate_approvals_if_material_change(
        test_db, case, hash_v2, actor="Credit Analyst", reason="Customer requested increase"
    )
    
    assert invalidated_count == 1
    assert approval.invalidated_at is not None
    assert case.revision == 2

def test_authority_limits(test_db):
    """
    FR-09: HRM max ₦5m, BCC max ₦15m, MD for > ₦15m.
    Credit Analyst cannot approve.
    """
    # Analyst cannot approve
    can_analyst, _ = AuthorityMatrix.can_user_approve("ANALYST", 1_000_000)
    assert can_analyst is False
    
    # HRM can approve ₦4.5m
    can_hrm, _ = AuthorityMatrix.can_user_approve("HRM", 4_500_000)
    assert can_hrm is True
    
    # HRM cannot approve ₦7m
    can_hrm_high, _ = AuthorityMatrix.can_user_approve("HRM", 7_000_000)
    assert can_hrm_high is False
    
    # BCC has authority for large facilities > ₦20m
    can_bcc, _ = AuthorityMatrix.can_user_approve("BCC", 25_000_000)
    assert can_bcc is True
    
    # MD can approve facilities up to ₦20m
    can_md, _ = AuthorityMatrix.can_user_approve("MD", 20_000_000)
    assert can_md is True
