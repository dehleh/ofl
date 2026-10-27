"""
Tests for Full Credit Exception Handling Architecture (Flowchart 6 Categories & Convergence)
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db, utc_now
from app.main import app
from app.models import (
    Customer, Application, CreditCase, CaseState, 
    ExceptionItem, Approval, AuditEvent, Document
)
from app.core.state_machine import TransitionService


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
def client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_case(test_db):
    cust = Customer(
        customer_type="SME",
        name="FLOWCHART TEST ENTERPRISES",
        email="test@flowchart.ng",
        phone="08099887766",
        bvn="22334455660"
    )
    test_db.add(cust)
    test_db.flush()

    app_record = Application(
        customer_id=cust.id,
        amount=30_000_000.0,
        tenor=12,
        purpose="Machinery Expansion",
        status="SUBMITTED"
    )
    test_db.add(app_record)
    test_db.flush()

    credit_case = CreditCase(
        application_id=app_record.id,
        case_number="OFL-2026-EXC01",
        state=CaseState.ANALYST_REVIEW.value,
        revision=1,
        assigned_owner="Credit Analyst Queue"
    )
    test_db.add(credit_case)
    test_db.commit()
    test_db.refresh(credit_case)
    return credit_case


def test_raise_all_six_categories(client, sample_case):
    """
    Validates raising exceptions across all 6 flowchart categories and asserts automated owner & SLA assignment.
    """
    categories_expected = [
        ("TECHNICAL_FAILURE", "IT / Integration Owner", 4),
        ("INTERNAL_CORRECTION", "Credit Analyst", 24),
        ("REJECTION_RECOMMENDATION", "Authorised Decision-Maker", 24),
        ("RISK_RECONSIDERATION", "HRM", 24),
        ("WITHDRAWAL_EXPIRY", "Credit Operations", 48),
        ("APPLICANT_CORRECTION", "Credit Analyst / BDO", 48),
    ]

    for cat, expected_owner, expected_sla in categories_expected:
        payload = {
            "case_id": sample_case.id,
            "category": cat,
            "originator_role": "ANALYST",
            "originator_name": "Tunde Underwriter",
            "reason": f"Testing {cat} workflow trigger",
            "comments": "Automated architectural test",
            "sla_hours": expected_sla
        }
        res = client.post("/api/v1/exceptions/raise", json=payload)
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["category"] == cat
        assert data["assigned_owner"] == expected_owner
        assert data["status"] == "OPEN"
        assert "sla_due_at" in data


def test_branch_1_technical_failure_retry_and_restore(client, sample_case, test_db):
    """
    Branch 1: Technical Failure -> Assign to IT -> Retry / Reconcile -> Restore Original State
    """
    # 1. Raise Technical Failure
    raise_res = client.post("/api/v1/exceptions/raise", json={
        "case_id": sample_case.id,
        "category": "TECHNICAL_FAILURE",
        "originator_role": "SYSTEM",
        "reason": "Youverify KYC webhook timeout",
        "sla_hours": 4
    })
    exc_id = raise_res.json()["exception_id"]

    # 2. Retry action by IT Owner
    retry_res = client.post(f"/api/v1/exceptions/{exc_id}/action", json={
        "action_type": "RETRY_TECHNICAL",
        "actor": "DevOps Engineer",
        "decision": "RETRY",
        "notes": "Attempting API replay with renewed credentials"
    })
    assert retry_res.status_code == 200

    # 3. Reconcile and Restore Original State
    restore_res = client.post(f"/api/v1/exceptions/{exc_id}/action", json={
        "action_type": "RETRY_TECHNICAL",
        "actor": "DevOps Engineer",
        "decision": "RESTORE",
        "notes": "Webhook replayed successfully. Data reconciled."
    })
    assert restore_res.status_code == 200
    assert restore_res.json()["status"] == "RESOLVED"


def test_branch_3_rejection_recommendation_reject_flow(client, sample_case):
    """
    Branch 3: Rejection Recommendation -> Route to Authorised Decision-Maker ->
    Final Decision: Reject -> Record Final Rejection (Reason + Authority + Date) -> Notify & Close
    """
    raise_res = client.post("/api/v1/exceptions/raise", json={
        "case_id": sample_case.id,
        "category": "REJECTION_RECOMMENDATION",
        "originator_role": "BCC",
        "reason": "Severe credit history delinquency and insufficient debt service coverage",
        "sla_hours": 24
    })
    exc_id = raise_res.json()["exception_id"]

    # Decision maker rejects
    reject_res = client.post(f"/api/v1/exceptions/{exc_id}/action", json={
        "action_type": "REJECTION_DECISION",
        "actor": "Managing Director",
        "decision": "REJECT",
        "notes": "Declined by MD per Credit Policy Section 4.2"
    })
    assert reject_res.status_code == 200
    data = reject_res.json()
    assert data["status"] == "RESOLVED"
    assert data["case_state"] == CaseState.REJECTED.value


def test_branch_3_rejection_recommendation_further_assessment(client, sample_case):
    """
    Branch 3 (Alt): Final Decision: Further Assessment -> Route to HRM -> HRM Coordinates Reassessment
    """
    raise_res = client.post("/api/v1/exceptions/raise", json={
        "case_id": sample_case.id,
        "category": "REJECTION_RECOMMENDATION",
        "originator_role": "ANALYST",
        "reason": "Marginal cashflow coverage",
        "sla_hours": 24
    })
    exc_id = raise_res.json()["exception_id"]

    # Decision maker orders further assessment
    action_res = client.post(f"/api/v1/exceptions/{exc_id}/action", json={
        "action_type": "REJECTION_DECISION",
        "actor": "BCC Chair",
        "decision": "FURTHER_ASSESSMENT",
        "notes": "Explore structured collateral haircut and debtor assignment"
    })
    assert action_res.status_code == 200
    data = action_res.json()
    assert data["owner"] == "HRM"
    assert data["case_state"] == CaseState.HRM_REVIEW.value


def test_branch_4_risk_reconsideration_and_hrm_coordination(client, sample_case):
    """
    Branch 4: Risk Reconsideration -> Route to HRM -> HRM Coordinates Reassessment -> Analyst Revises
    """
    raise_res = client.post("/api/v1/exceptions/raise", json={
        "case_id": sample_case.id,
        "category": "RISK_RECONSIDERATION",
        "originator_role": "HRM",
        "reason": "Re-evaluate facility with personal guarantee from primary shareholder",
        "sla_hours": 24
    })
    exc_id = raise_res.json()["exception_id"]

    # HRM coordinates with analyst
    coord_res = client.post(f"/api/v1/exceptions/{exc_id}/action", json={
        "action_type": "HRM_COORDINATE",
        "actor": "Head of Risk Management",
        "notes": "Credit Analyst to recalculate DSR with shareholder guarantee included"
    })
    assert coord_res.status_code == 200
    data = coord_res.json()
    assert data["owner"] == "Credit Analyst"
    assert data["case_state"] == CaseState.ANALYST_REVIEW.value


def test_branch_5_withdrawal_expiry_close(client, sample_case):
    """
    Branch 5: Withdrawal / Expiry -> Validate Rules -> Close as Authorised
    """
    raise_res = client.post("/api/v1/exceptions/raise", json={
        "case_id": sample_case.id,
        "category": "WITHDRAWAL_EXPIRY",
        "originator_role": "APPLICANT",
        "reason": "Borrower secured cheaper internal equity; requests withdrawal",
        "sla_hours": 48
    })
    exc_id = raise_res.json()["exception_id"]

    close_res = client.post(f"/api/v1/exceptions/{exc_id}/action", json={
        "action_type": "WITHDRAWAL_DECISION",
        "actor": "Credit Operations Officer",
        "decision": "CLOSE",
        "notes": "Verified formal borrower withdrawal letter"
    })
    assert close_res.status_code == 200
    assert close_res.json()["case_state"] == CaseState.WITHDRAWN.value


def test_branch_6_applicant_correction_lifecycle(client, sample_case):
    """
    Branch 6: Applicant Correction -> Assign to Analyst/BDO -> Send Request ->
    Applicant Uploads / Corrects Info via Public Tracker -> Analyst Validates Changes
    """
    # 1. Raise Applicant Correction
    raise_res = client.post("/api/v1/exceptions/raise", json={
        "case_id": sample_case.id,
        "category": "APPLICANT_CORRECTION",
        "originator_role": "ANALYST",
        "reason": "CAC Form 1.1 page 3 is blurry and missing director seal",
        "sla_hours": 48
    })
    exc_id = raise_res.json()["exception_id"]

    # 2. Analyst sends specific request to applicant
    req_res = client.post(f"/api/v1/exceptions/{exc_id}/action", json={
        "action_type": "SEND_APPLICANT_REQUEST",
        "actor": "Lead Credit Analyst",
        "notes": "Please upload a clear, stamped copy of CAC Form 1.1 page 3",
        "details": {"documents": ["CAC_Form_1_1_Stamped.pdf"]}
    })
    assert req_res.status_code == 200
    assert req_res.json()["applicant_action_required"] is True

    # 3. Applicant checks tracking on public portal
    track_res = client.get(f"/api/v1/intake/track/{sample_case.case_number}")
    assert track_res.status_code == 200
    track_data = track_res.json()
    assert track_data["applicant_action"] is not None
    assert "CAC Form 1.1" in track_data["applicant_action"]["instructions"]

    # 4. Applicant uploads replacement document via public portal
    resp_res = client.post(f"/api/v1/intake/track/{sample_case.case_number}/respond-exception", json={
        "exception_id": exc_id,
        "notes": "Uploaded clear, certified true copy of CAC Form 1.1 with official seal.",
        "documents": [
            {
                "type": "CAC_REGISTRATION",
                "name": "CAC_Form_1_1_Certified.pdf",
                "summary": "Certified copy with director stamp"
            }
        ]
    })
    assert resp_res.status_code == 200
    assert resp_res.json()["status"] == "IN_PROGRESS"

    # 5. Analyst validates changes: Resolved? Yes!
    val_res = client.post(f"/api/v1/exceptions/{exc_id}/action", json={
        "action_type": "ANALYST_VALIDATE",
        "actor": "Lead Credit Analyst",
        "decision": "YES",
        "notes": "CAC document validated and legible. Directors match."
    })
    assert val_res.status_code == 200


def test_convergence_material_change_invalidates_approvals(client, sample_case, test_db):
    """
    Convergence: Material Credit Change?
    - YES: Invalidate affected prior approvals -> Restart applicable approval chain
    """
    # 1. Setup prior approval on case
    prior_approval = Approval(
        case_id=sample_case.id,
        revision=1,
        terms_hash="ORIGINAL_TERMS_HASH_123",
        actor="HRM Approver",
        authority_level="HRM",
        decision="RECOMMEND_APPROVE"
    )
    test_db.add(prior_approval)
    test_db.commit()

    # 2. Raise Internal Correction exception
    raise_res = client.post("/api/v1/exceptions/raise", json={
        "case_id": sample_case.id,
        "category": "INTERNAL_CORRECTION",
        "originator_role": "ANALYST",
        "reason": "Borrower revenue adjustment reduced approved capacity from ₦30m to ₦20m",
        "sla_hours": 24
    })
    exc_id = raise_res.json()["exception_id"]

    # 3. Resolve exception with is_material_change = True
    resolve_res = client.post(f"/api/v1/exceptions/{exc_id}/resolve", json={
        "resolution_notes": "Facility amount revised down to ₦20m. Material terms shifted.",
        "resolved_by": "Senior Credit Analyst",
        "is_material_change": True,
        "resolution_category": "REVISED_CAM"
    })
    assert resolve_res.status_code == 200
    res_data = resolve_res.json()
    assert res_data["is_material_change"] is True
    assert res_data["invalidated_approvals_count"] == 1
    assert res_data["case_revision"] == 2
    assert res_data["case_state"] == CaseState.ANALYST_REVIEW.value

    # 4. Verify approval is invalidated in DB
    test_db.refresh(prior_approval)
    assert prior_approval.invalidated_at is not None


def test_convergence_non_material_change_preserves_approvals(client, sample_case, test_db):
    """
    Convergence: Material Credit Change?
    - NO: Return to required reviewer with original comments. Approvals preserved.
    """
    # 1. Setup prior approval
    prior_approval = Approval(
        case_id=sample_case.id,
        revision=1,
        terms_hash="ORIGINAL_TERMS_HASH_123",
        actor="HRM Approver",
        authority_level="HRM",
        decision="RECOMMEND_APPROVE"
    )
    test_db.add(prior_approval)
    test_db.commit()

    # 2. Raise exception
    raise_res = client.post("/api/v1/exceptions/raise", json={
        "case_id": sample_case.id,
        "category": "INTERNAL_CORRECTION",
        "originator_role": "HRM",
        "reason": "Clarify industry classification code and executive summary phrasing",
        "sla_hours": 24
    })
    exc_id = raise_res.json()["exception_id"]

    # 3. Resolve exception with is_material_change = False
    resolve_res = client.post(f"/api/v1/exceptions/{exc_id}/resolve", json={
        "resolution_notes": "Industry classification updated to Manufacturing - Agro-Allied. No terms changed.",
        "resolved_by": "Credit Analyst",
        "is_material_change": False,
        "return_to_stage": CaseState.HRM_REVIEW.value
    })
    assert resolve_res.status_code == 200
    res_data = resolve_res.json()
    assert res_data["is_material_change"] is False
    assert res_data["invalidated_approvals_count"] == 0
    assert res_data["case_state"] == CaseState.HRM_REVIEW.value

    # 4. Verify approval remains active
    test_db.refresh(prior_approval)
    assert prior_approval.invalidated_at is None
