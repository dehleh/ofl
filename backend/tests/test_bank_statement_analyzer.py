"""
Unit and Integration Tests for Bank Statement Analyzer & Ingestion Engine
"""
import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import (
    Customer, Application, CreditCase, Document, FinancialAssessment, CaseState
)
from app.integrations.bank_statement_analyzer import BankStatementAnalyzer


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
        name="LEO-AKINBONI BABATUNDE GLOBAL ENTERPRISES",
        email="leobabatunde9@gmail.com",
        phone="08024799952",
        bvn="2233307057",
        nin="65858750946",
        rc_number="7049792"
    )
    test_db.add(cust)
    test_db.flush()

    app_record = Application(
        customer_id=cust.id,
        amount=50_000_000.0,
        tenor=6,
        purpose="Purchase Order Execution for P.A. Lawrence Nigeria Limited",
        intake_channel="OFL_DIRECT",
        status="UNDER_ASSESSMENT"
    )
    test_db.add(app_record)
    test_db.flush()

    credit_case = CreditCase(
        case_number="OFL-2026-TEST-BS01",
        application_id=app_record.id,
        state=CaseState.ANALYST_REVIEW.value,
        assigned_owner="Credit Analyst"
    )
    test_db.add(credit_case)
    test_db.commit()
    test_db.refresh(credit_case)
    return credit_case


def test_bank_statement_text_and_metrics_parsing(test_db, sample_case):
    """
    Verifies that BankStatementAnalyzer extracts commercial inflows, computes turnover,
    and identifies behavioral risk signals.
    """
    raw_content = (
        "UNITED BANK FOR AFRICA - ACCOUNT STATEMENT\n"
        "Account Name: LEO-AKINBONI BABATUNDE GLOBAL ENTERPRISES\n"
        "Account Number: 1027034047\n"
        "Period: 01/03/2026 to 31/08/2026\n"
        "Overdraft Facility Limit: 8,576,374.79\n"
    ).encode("utf-8")

    doc = BankStatementAnalyzer.process_and_attach_statement(
        db=test_db,
        credit_case=sample_case,
        file_bytes=raw_content,
        filename="UBA_Haulage_Account_Statement_6M.pdf",
        mime_type="application/pdf",
        actor="Test Analyst"
    )

    assert doc.id is not None
    assert doc.document_type == "BANK_STATEMENT"
    assert doc.scan_status == "CLEAN"
    assert len(doc.checksum) == 64

    analysis = doc.analysis_results
    assert analysis["bank_name"] == "United Bank for Africa (UBA)"
    assert analysis["account_number"] == "1027034047"
    assert analysis["total_inflow"] > 500_000_000.0
    assert analysis["average_monthly_inflow"] > 80_000_000.0
    assert analysis["coverage_multiple"] > 5.0
    assert len(analysis["monthly_inflows"]) == 6
    assert any(s["code"] == "HIGH_TURNOVER_COVERAGE" for s in analysis["risk_signals"])


def test_bank_statement_api_endpoints(test_db, sample_case):
    """
    Verifies API upload, demo analysis, and applying statement metrics to financial model.
    """
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    # 1. Test Demo Ingestion Endpoint
    demo_res = client.post(f"/api/v1/cases/{sample_case.id}/bank-statements/analyze-demo?bank_preset=UBA_HAULAGE")
    assert demo_res.status_code == 200
    demo_data = demo_res.json()
    assert "document_id" in demo_data
    assert demo_data["analysis"]["average_monthly_inflow"] > 0

    doc_id = demo_data["document_id"]

    # 2. Test Apply to Financials Endpoint
    apply_res = client.post(f"/api/v1/cases/{sample_case.id}/bank-statements/{doc_id}/apply-to-financials")
    assert apply_res.status_code == 200
    apply_data = apply_res.json()
    assert "financial_assessment_id" in apply_data
    assert "updated_monthly_turnover" in apply_data
    assert apply_data["ratios"]["dsr"] > 0

    app.dependency_overrides.clear()
