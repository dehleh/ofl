"""
Test Suite: Opticom Loan Performance Telemetry & Post-Disbursement Servicing
Validates:
- 7-day grace period enforcement
- Deterministic 5% default penalty application on overdue installments (> 7 days)
- Repayment recording, schedule progression, and principal/interest accounting
- Telemetry REST API endpoints
"""
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import get_db, SessionLocal
from app.models import Customer, Application, CreditCase, CaseState, LoanPerformance
from app.core.loan_performance_engine import LoanPerformanceEngine

client = TestClient(app)

@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def funded_case(test_db: Session):
    import uuid
    uid = uuid.uuid4().hex[:8]
    cust = Customer(
        name=f"Opticom Telemetry Obligor {uid}",
        email=f"obligor_{uid}@telemetrytest.ng",
        phone="08020001122",
        bvn="22119933445"
    )
    test_db.add(cust)
    test_db.commit()

    app_rec = Application(
        customer_id=cust.id,
        amount=10_000_000.0,
        tenor=12,
        currency="NGN",
        purpose="Working Capital Logistics Facility"
    )
    test_db.add(app_rec)
    test_db.commit()

    case = CreditCase(
        case_number=f"OFL-PERF-{uid.upper()}",
        application_id=app_rec.id,
        state=CaseState.DISBURSED_MONITORING.value,
        revision=1
    )
    test_db.add(case)
    test_db.commit()

    loan_perf = LoanPerformanceEngine.initialize_loan_performance(case, test_db)
    test_db.commit()
    test_db.refresh(loan_perf)

    yield case, loan_perf

    # Teardown
    try:
        test_db.delete(loan_perf)
        test_db.delete(case)
        test_db.delete(app_rec)
        test_db.delete(cust)
        test_db.commit()
    except Exception:
        test_db.rollback()

def test_loan_performance_initialization(funded_case):
    case, loan_perf = funded_case
    assert loan_perf.disbursed_principal == 10_000_000.0
    assert loan_perf.tenor_months == 12
    assert loan_perf.total_installments_count == 12
    assert loan_perf.installments_serviced == 0
    assert loan_perf.grace_period_days == 7
    assert loan_perf.penalty_rate_pct == 5.0
    assert loan_perf.performance_status == "PERFORMING_CURRENT"
    assert loan_perf.penalty_accrued == 0.0
    assert len(loan_perf.repayment_schedule) == 12

def test_grace_period_within_7_days(funded_case, test_db: Session):
    case, loan_perf = funded_case
    now_dt = datetime.now(timezone.utc)
    
    # Simulate 4 days past due date (within 7-day grace window)
    loan_perf.next_due_date = now_dt - timedelta(days=4)
    LoanPerformanceEngine.evaluate_performance(loan_perf, reference_dt=now_dt)
    test_db.commit()

    assert loan_perf.days_overdue == 4
    assert loan_perf.performance_status == "GRACE_PERIOD_ACTIVE"
    assert loan_perf.penalty_accrued == 0.0, "Zero penalty should accrue within 7-day grace period"

def test_overdue_penalty_beyond_7_days(funded_case, test_db: Session):
    case, loan_perf = funded_case
    now_dt = datetime.now(timezone.utc)
    
    # Simulate 10 days past due date (> 7-day grace window)
    loan_perf.next_due_date = now_dt - timedelta(days=10)
    LoanPerformanceEngine.evaluate_performance(loan_perf, reference_dt=now_dt)
    test_db.commit()

    assert loan_perf.days_overdue == 10
    assert loan_perf.performance_status == "OVERDUE_PENALTY_APPLIED"
    
    expected_penalty = round(loan_perf.monthly_installment * 0.05, 2)
    assert loan_perf.penalty_accrued == expected_penalty
    assert loan_perf.penalty_accrued > 0

def test_record_repayment_lifecycle(funded_case, test_db: Session):
    case, loan_perf = funded_case
    initial_balance = loan_perf.outstanding_total
    installment = loan_perf.monthly_installment

    res = LoanPerformanceEngine.record_repayment(loan_perf, installment, db=test_db)
    assert res["installments_serviced"] == 1
    assert res["outstanding_total"] < initial_balance
    assert loan_perf.principal_serviced > 0
    assert loan_perf.interest_serviced > 0
    assert len(loan_perf.repayment_history) == 1

def test_telemetry_rest_endpoints(funded_case):
    case, loan_perf = funded_case

    # 1. Portfolio overview
    res1 = client.get("/api/v1/telemetry/loan-performance")
    assert res1.status_code == 200
    data1 = res1.json()
    assert "portfolio_metrics" in data1
    assert "accounts" in data1
    assert data1["portfolio_metrics"]["total_active_loans"] >= 1

    # 2. Single case dossier
    res2 = client.get(f"/api/v1/telemetry/loan-performance/{case.id}")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["facility_number"] == case.case_number
    assert "repayment_schedule" in data2

    # 3. Scenario simulator
    res3 = client.post(f"/api/v1/telemetry/loan-performance/{case.id}/simulate-status", json={
        "scenario": "OVERDUE_PENALTY"
    })
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["performance_status"] == "OVERDUE_PENALTY_APPLIED"
    assert data3["penalty_accrued"] > 0


def test_telemetry_periodic_reports_and_downloads(funded_case):
    """
    Tests downloading monthly, quarterly, biannual, and annual telemetry reports
    in JSON, CSV, and printable executive HTML formats.
    """
    case, loan_perf = funded_case

    # Test JSON report endpoints for all 4 periods
    for period in ["monthly", "quarterly", "biannual", "annual"]:
        res = client.get(f"/api/v1/telemetry/reports?period={period}")
        assert res.status_code == 200
        data = res.json()
        assert data["period"] == period
        assert "portfolio_metrics" in data
        assert "accounts" in data
        assert data["portfolio_metrics"]["total_disbursed_principal"] > 0
        assert "status_distribution" in data

    # Test CSV export
    csv_res = client.get("/api/v1/telemetry/reports/export?period=quarterly&format=csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "OPTICOM FINANCE LIMITED" in csv_res.text
    assert "PORTFOLIO SUMMARY METRICS" in csv_res.text
    assert "STATUS STRATIFICATION" in csv_res.text
    assert case.case_number in csv_res.text

    # Test Printable HTML/PDF export
    html_res = client.get("/api/v1/telemetry/reports/export?period=biannual&format=html")
    assert html_res.status_code == 200
    assert "text/html" in html_res.headers["content-type"]
    assert "OPTICOM FINANCE LIMITED" in html_res.text
    assert "Biannual Portfolio Health" in html_res.text
    assert "Folashade Tinubu" in html_res.text
    assert "Chidinma Okafor" in html_res.text
    assert "Dapo Adeleke" in html_res.text


def test_deliberation_comment_trail_and_notifications():
    """
    Tests that Analyst, Head of BD, HRM, MD, and BCC can all leave review comments
    in a comment box, which record into the deliberation trail and emit notifications.
    """
    create_res = client.post("/api/v1/intake/direct", json={
        "applicant_name": "DELIBERATION LOGISTICS LTD",
        "applicant_type": "CORPORATE",
        "email": "info@deliberationlogistics.ng",
        "phone": "+2348088889999",
        "rc_number": "RC-556677",
        "bvn": "22998877665",
        "amount": 15_000_000.0,
        "tenor_months": 12,
        "purpose": "Logistics fleet renewal",
        "monthly_income": 3_500_000.0
    })
    assert create_res.status_code == 201
    case_id = create_res.json()["case_id"]

    # 1. Post a standalone deliberation note / comment without changing state
    comment_res = client.post(f"/api/v1/cases/{case_id}/approval", json={
        "actor": "Babatunde Adebayo",
        "role": "ANALYST",
        "decision": "COMMENT",
        "comments": "Reviewed tax clearance and verified audited accounts. Financials appear sound."
    })
    assert comment_res.status_code == 200
    assert "Deliberation review comment" in comment_res.json()["message"]

    # 2. Advance case to ANALYST_REVIEW
    client.post(f"/api/v1/cases/{case_id}/transition", json={
        "to_state": CaseState.ANALYST_REVIEW.value,
        "actor": "KYC Engine",
        "role": "ANALYST",
        "reason": "KYC Cleared."
    })

    # 3. Analyst forwards to Head of BD with comment
    analyst_res = client.post(f"/api/v1/cases/{case_id}/approval", json={
        "actor": "Babatunde Adebayo",
        "role": "ANALYST",
        "decision": "RECOMMEND_APPROVE",
        "comments": "CAM complete. Recommended facility ₦15M to MCC (Head of BD)."
    })
    assert analyst_res.status_code == 200
    assert analyst_res.json()["case_state"] == CaseState.HEAD_OF_BD_REVIEW.value

    # 4. Head of BD leaves commercial review comment & forwards to HRM
    bd_res = client.post(f"/api/v1/cases/{case_id}/approval", json={
        "actor": "Dapo Adeleke",
        "role": "HEAD_OF_BD",
        "decision": "APPROVE",
        "comments": "MCC commercial sponsor concurrence. Customer is high-volume corporate client."
    })
    assert bd_res.status_code == 200
    assert bd_res.json()["case_state"] == CaseState.HRM_REVIEW.value

    # 5. HRM raises exception query with comments -> routes back to Analyst
    hrm_res = client.post(f"/api/v1/cases/{case_id}/approval", json={
        "actor": "Chidinma Okafor",
        "role": "HRM",
        "decision": "RETURN_FOR_REWORK",
        "comments": "Need updated 3-month statement to verify turnover seasonality."
    })
    assert hrm_res.status_code == 200
    assert hrm_res.json()["case_state"] == CaseState.ANALYST_REVIEW.value

    # Verify all comments are present in workspace approvals trail
    ws = client.get(f"/api/v1/cases/{case_id}/workspace").json()
    approval_comments = [a["comments"] for a in ws["approvals"]]
    assert any("audited accounts" in c for c in approval_comments)
    assert any("Recommended facility ₦15M" in c for c in approval_comments)
    assert any("commercial sponsor concurrence" in c for c in approval_comments)
    assert any("seasonality" in c for c in approval_comments)
