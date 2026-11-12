"""
Test Suite: Individual Post-Disbursement Loan Performance, Statement of Account & Servicing Controls
"""
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.models import (
    Customer, Application, CreditCase, CaseState,
    LoanPerformance, AuditEvent, Disbursement
)
from app.core.loan_performance_engine import LoanPerformanceEngine

client = TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def disbursed_facility(db_session: Session):
    uid = uuid.uuid4().hex[:8]
    cust = Customer(
        name=f"Individual Perf Obligor {uid}",
        email=f"obligor_{uid}@opticomtest.ng",
        phone="08035551234",
        bvn="22334455667",
        customer_type="CORPORATE"
    )
    db_session.add(cust)
    db_session.commit()

    app_rec = Application(
        customer_id=cust.id,
        amount=12_000_000.0,
        tenor=12,
        currency="NGN",
        purpose="Fleet Logistics Working Capital",
        raw_payload={
            "facility_classification": "Working Capital",
            "guarantor_name": "Chukwuemeka Obi",
            "guarantor_phone": "+2348091112222",
            "guarantor_email": f"guarantor_{uid}@opticomtest.ng",
            "guarantor_relationship": "Managing Director",
            "collateral_type": "Commercial Truck Fleet",
            "collateral_value": 18_000_000.0
        }
    )
    db_session.add(app_rec)
    db_session.commit()

    case = CreditCase(
        case_number=f"OFL-IND-{uid.upper()}",
        application_id=app_rec.id,
        state=CaseState.DISBURSED_MONITORING.value,
        revision=1
    )
    db_session.add(case)
    db_session.commit()

    disb = Disbursement(
        case_id=case.id,
        nav_reference=f"LD-{uid.upper()}",
        amount=12_000_000.0,
        status="RECONCILED",
        recorded_by="Treasury Operations"
    )
    db_session.add(disb)
    db_session.commit()

    yield case, cust, app_rec, disb

    try:
        db_session.query(AuditEvent).filter(
            AuditEvent.entity == "LOAN_PERFORMANCE",
            AuditEvent.entity_id == case.id
        ).delete()
        db_session.query(LoanPerformance).filter(LoanPerformance.case_id == case.id).delete()
        db_session.query(Disbursement).filter(Disbursement.case_id == case.id).delete()
        db_session.delete(case)
        db_session.delete(app_rec)
        db_session.delete(cust)
        db_session.commit()
    except Exception:
        db_session.rollback()


def test_auto_initialize_disbursed_facility_on_portfolio_fetch(disbursed_facility, db_session: Session):
    case, _, _, _ = disbursed_facility
    # Ensure no LoanPerformance exists beforehand
    assert db_session.query(LoanPerformance).filter(LoanPerformance.case_id == case.id).first() is None

    res = client.get("/api/v1/telemetry/loan-performance")
    assert res.status_code == 200
    data = res.json()
    match = next((acc for acc in data["accounts"] if acc["case_id"] == case.id), None)
    assert match is not None
    assert match["facility_number"] == case.case_number
    assert match["guarantor_name"] == "Chukwuemeka Obi"
    assert match["performance_score"] == 100


def test_individual_dossier_statement_and_repayment_flow(disbursed_facility):
    case, _, _, disb = disbursed_facility

    # Fetch individual dossier (auto-initializes if needed)
    dossier_res = client.get(f"/api/v1/telemetry/loan-performance/{case.id}")
    assert dossier_res.status_code == 200
    dossier = dossier_res.json()
    assert dossier["disbursement_reference"] == disb.nav_reference
    assert dossier["guarantor"]["name"] == "Chukwuemeka Obi"
    assert dossier["performance_score"] == 100
    assert dossier["health_grade"] == "A"
    assert len(dossier["statement_entries"]) == 2  # DISBURSEMENT + CONTRACT_INTEREST

    # Record a repayment with custom payment method, reference, and note
    inst_amt = dossier["monthly_installment"]
    pay_res = client.post(
        f"/api/v1/telemetry/loan-performance/{case.id}/record-repayment",
        json={
            "amount": inst_amt,
            "payment_method": "NIBSS_TRANSFER",
            "reference": "NIBSS-998877",
            "note": "First installment cleared via corporate transfer"
        }
    )
    assert pay_res.status_code == 200
    receipt = pay_res.json()["payment_receipt"]
    assert receipt["reference"] == "NIBSS-998877"
    assert receipt["payment_method"] == "NIBSS_TRANSFER"

    # Re-fetch dossier and verify Statement Ledger running balance reduced cleanly
    updated = client.get(f"/api/v1/telemetry/loan-performance/{case.id}").json()
    assert updated["installments_serviced"] == 1
    assert any(e["entry_type"] == "REPAYMENT" and e["reference"] == "NIBSS-998877" for e in updated["statement_entries"])
    assert updated["statement_totals"]["total_credits"] == pytest.approx(inst_amt, rel=1e-3)
    assert updated["repayment_schedule"][0]["status"] == "PAID_ON_TIME"

    # Export CSV & HTML Statement of Account
    csv_res = client.get(f"/api/v1/telemetry/loan-performance/{case.id}/statement/export?format=csv")
    assert csv_res.status_code == 200
    assert "INDIVIDUAL LOAN STATEMENT OF ACCOUNT" in csv_res.text
    assert "NIBSS-998877" in csv_res.text

    html_res = client.get(f"/api/v1/telemetry/loan-performance/{case.id}/statement/export?format=html")
    assert html_res.status_code == 200
    assert "INDIVIDUAL LOAN PERFORMANCE" in html_res.text
    assert case.case_number in html_res.text


def test_penalty_waiver_reminder_and_monitoring_note(disbursed_facility, db_session: Session):
    case, _, _, _ = disbursed_facility
    client.get(f"/api/v1/telemetry/loan-performance/{case.id}")

    # Simulate 10 days overdue (> 7-day grace) -> levies 5% penalty
    sim_res = client.post(
        f"/api/v1/telemetry/loan-performance/{case.id}/simulate-status",
        json={"scenario": "OVERDUE_PENALTY"}
    )
    assert sim_res.status_code == 200
    assert sim_res.json()["penalty_accrued"] > 0

    # Send reminder copying guarantor
    rem_res = client.post(
        f"/api/v1/telemetry/loan-performance/{case.id}/send-reminder",
        json={"include_guarantor": True, "custom_note": "Please regularize within 48h"}
    )
    assert rem_res.status_code == 200
    assert len(rem_res.json()["dispatched_to"]) == 2

    # Log a surveillance note with Promise-to-Pay date
    note_res = client.post(
        f"/api/v1/telemetry/loan-performance/{case.id}/monitoring-note",
        json={
            "note_type": "PROMISE_TO_PAY",
            "note": "Borrower MD confirmed inflow arriving Friday",
            "promise_to_pay_date": "2026-11-20",
            "actor": "Credit Monitoring Officer",
            "role": "ANALYST"
        }
    )
    assert note_res.status_code == 200
    assert note_res.json()["entry"]["promise_to_pay_date"] == "2026-11-20"

    # Waive 5% penalty with audit reason and confirm evaluate_performance respects waiver
    waive_res = client.post(
        f"/api/v1/telemetry/loan-performance/{case.id}/waive-penalty",
        json={"reason": "Confirmed NIBSS settlement delay approved by HRM", "actor": "Chidinma Okafor"}
    )
    assert waive_res.status_code == 200
    assert waive_res.json()["penalty_accrued"] == 0.0

    # Fetching dossier re-runs evaluate_performance; penalty must remain waived at 0.0
    after_waive = client.get(f"/api/v1/telemetry/loan-performance/{case.id}").json()
    assert after_waive["penalty_accrued"] == 0.0
    events = [m["event"] for m in after_waive["monitoring_logs"]]
    assert "PENALTY_WAIVED" in events
    assert "MONITORING_NOTE" in events

