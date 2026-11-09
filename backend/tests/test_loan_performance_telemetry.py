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
