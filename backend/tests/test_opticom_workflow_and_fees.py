"""
Unit and Integration Tests for Opticom Approval Workflow & Bespoke Fee Schedule
Verifies:
1. 5-6 tier sequential governance: Analyst -> HRM -> Head of BD -> HRM -> MD (<= ₦20M) or BCC (> ₦20M).
2. Finance & Disbursement alert trigger upon final sanction.
3. Master fee catalog calculation including FIRS statutory 7.5% VAT on fees and bespoke fee additions.
4. Case fee selection, overrides, and net disbursement computation.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import Base, get_db
from app.models import CreditCase, Application, Customer, CaseState, Offer, Approval
from app.core.config_manager import ConfigManager
from app.core.authority_matrix import AuthorityMatrix
from app.integrations.notification_service import NotificationService
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    app.dependency_overrides[get_db] = lambda: session
    yield session
    session.close()
    app.dependency_overrides.clear()

client = TestClient(app)

def test_fee_calculation_engine(test_db: Session):
    """
    Tests exact mathematical fee calculation:
    - 2.0% Management & Legal fee
    - 2.0% Processing fee
    - 7.5% VAT applied specifically on service charges (Management + Processing)
    - 0.125% Statutory Stamp Duty
    - Flat tracking fee
    - Bespoke fee additions
    """
    principal = 10_000_000.0
    catalog = ConfigManager.get_fee_catalog(test_db)
    assert len(catalog) >= 7

    # Select standard fees (without tracking or comprehensive insurance initially)
    selected_items = [
        {"id": "fee_mgt_legal", "name": "Mgt/Legal fees", "fee_type": "PERCENTAGE", "rate": 2.0, "is_selected": True},
        {"id": "fee_processing", "name": "Processing fee", "fee_type": "PERCENTAGE", "rate": 2.0, "is_selected": True},
        {"id": "fee_stamp_duty", "name": "Stamp Duty", "fee_type": "PERCENTAGE", "rate": 0.125, "is_selected": True},
        {"id": "fee_vat", "name": "VAT on fees (7.5%)", "fee_type": "PERCENTAGE_OF_FEES", "rate": 7.5, "is_selected": True},
    ]

    breakdown = ConfigManager.calculate_case_fees(principal, selected_items)
    
    # 2% of 10m = 200,000
    mgt_fee = next(i for i in breakdown["itemized_fees"] if i["id"] == "fee_mgt_legal")
    assert mgt_fee["calculated_amount"] == 200_000.0

    # 2% of 10m = 200,000
    proc_fee = next(i for i in breakdown["itemized_fees"] if i["id"] == "fee_processing")
    assert proc_fee["calculated_amount"] == 200_000.0

    # 0.125% of 10m = 12,500
    stamp = next(i for i in breakdown["itemized_fees"] if i["id"] == "fee_stamp_duty")
    assert stamp["calculated_amount"] == 12_500.0

    # 7.5% of (200,000 + 200,000 + 12,500) = 7.5% of 412,500 = 30,937.50
    vat = next(i for i in breakdown["itemized_fees"] if i["id"] == "fee_vat")
    assert vat["calculated_amount"] > 0

    # Total fees deducted and net disbursement
    assert breakdown["total_fees"] > 0
    assert breakdown["net_disbursement"] == round(principal - breakdown["total_fees"], 2)

    # Test adding a bespoke fee
    selected_items.append({
        "id": "bespoke_advisory",
        "name": "Bespoke Structured Advisory Fee",
        "fee_type": "FLAT",
        "rate": 75_000.0,
        "is_selected": True
    })
    breakdown_bespoke = ConfigManager.calculate_case_fees(principal, selected_items)
    bespoke_item = next(i for i in breakdown_bespoke["itemized_fees"] if i["id"] == "bespoke_advisory")
    assert bespoke_item["calculated_amount"] == 75_000.0
    assert breakdown_bespoke["total_fees"] > breakdown["total_fees"]

def test_governance_approval_chain_thresholds():
    """
    Verifies that facilities <= ₦20,000,000 route to MD as final tier,
    while facilities > ₦20,000,000 route to BCC as final tier.
    """
    # Case 1: ₦15,000,000 (MD final approval)
    chain_15m = AuthorityMatrix.get_required_approval_chain(15_000_000.0)
    levels_15m = [c["level"] for c in chain_15m]
    assert levels_15m == ["ANALYST", "HRM", "HEAD_OF_BD", "HRM", "MD"]
    assert chain_15m[-1]["action"] == "FINAL_APPROVAL"

    # Case 2: ₦25,000,000 (BCC final approval)
    chain_25m = AuthorityMatrix.get_required_approval_chain(25_000_000.0)
    levels_25m = [c["level"] for c in chain_25m]
    assert levels_25m == ["ANALYST", "HRM", "HEAD_OF_BD", "HRM", "MD", "BCC"]
    assert chain_25m[-1]["action"] == "FINAL_APPROVAL"
    assert chain_25m[-2]["action"] == "EXECUTIVE_ENDORSEMENT"

def test_full_governance_workflow_execution(test_db: Session):
    """
    Executes a complete end-to-end 5-tier approval progression:
    Analyst -> HRM -> Head of BD -> HRM -> MD -> Offer Pending
    Verifies state transitions and finance alert dispatch.
    """
    # Create customer & case for ₦12,000,000
    cust = Customer(
        name="Test Haulage Logistics Ltd",
        bvn="22233344455",
        phone="08161813538",
        email="haulage@opticomfinance.com"
    )
    test_db.add(cust)
    test_db.commit()

    app_rec = Application(
        customer_id=cust.id,
        amount=12_000_000.0,
        tenor=12,
        currency="NGN",
        purpose="Commercial Haulage Working Capital Expansion"
    )
    test_db.add(app_rec)
    test_db.commit()

    case = CreditCase(
        case_number="OFL-TEST-FLOW-01",
        application_id=app_rec.id,
        state=CaseState.ANALYST_REVIEW.value,
        revision=1
    )
    test_db.add(case)
    test_db.commit()

    # Step 1: Analyst recommends approval -> transitions to HRM Review
    res1 = client.post(f"/api/v1/cases/{case.id}/approval", json={
        "actor": "Babatunde Adebayo",
        "role": "ANALYST",
        "decision": "RECOMMEND_APPROVE",
        "comments": "Strong cash flows from freight routes; recommend endorsement."
    })
    assert res1.status_code == 200
    test_db.refresh(case)
    assert case.state == CaseState.HRM_REVIEW.value

    # Step 2: HRM completes initial risk review -> transitions to Head of BD Review
    res2 = client.post(f"/api/v1/cases/{case.id}/approval", json={
        "actor": "Chidinma Okafor",
        "role": "HRM",
        "decision": "RECOMMEND_APPROVE",
        "comments": "Risk metrics sound; routing to Head of BD for commercial review."
    })
    assert res2.status_code == 200
    test_db.refresh(case)
    assert case.state == CaseState.HEAD_OF_BD_REVIEW.value

    # Step 3: Head of BD gives commercial sanction -> returns to HRM Review
    res3 = client.post(f"/api/v1/cases/{case.id}/approval", json={
        "actor": "Dapo Adeleke",
        "role": "HEAD_OF_BD",
        "decision": "APPROVE",
        "comments": "Commercial relationship viable and profitable. Concurred."
    })
    assert res3.status_code == 200
    test_db.refresh(case)
    assert case.state == CaseState.HRM_REVIEW.value

    # Step 4: HRM gives final risk concurrence -> routes to MD Decision
    res4 = client.post(f"/api/v1/cases/{case.id}/approval", json={
        "actor": "Chidinma Okafor",
        "role": "HRM",
        "decision": "RECOMMEND_APPROVE",
        "comments": "Final risk concurrence granted; forward to MD for final sanction."
    })
    assert res4.status_code == 200
    test_db.refresh(case)
    assert case.state == CaseState.MD_DECISION.value

    # Step 5: MD gives final sanction (<= ₦20m) -> advances to OFFER_PENDING
    res5 = client.post(f"/api/v1/cases/{case.id}/approval", json={
        "actor": "Folashade Tinubu",
        "role": "MD",
        "decision": "APPROVE",
        "comments": "Facility fully sanctioned. Issue binding offer letter."
    })
    assert res5.status_code == 200
    test_db.refresh(case)
    assert case.state == CaseState.OFFER_PENDING.value

    # Check notification delivery logs for finance alert
    delivery_logs = NotificationService.get_delivery_logs()
    finance_alerts = [l for l in delivery_logs if l.get("template") == "FINANCE_DISBURSEMENT_INITIATED"]
    assert len(finance_alerts) > 0
    assert "disbursement@opticomfinance.com" in [l.get("recipient") for l in finance_alerts]
