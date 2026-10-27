"""
Test Suite for Google Cloud Platform Integrations
Verifies:
1. Vertex AI (Gemini) CAM drafting, citations, and token telemetry (FR-06, FR-28, FR-29)
2. Google Cloud Storage document upload and SHA-256 verification (FR-03)
3. Google Cloud Secret Manager retrieval and audit inventory
4. Google Cloud Logging audit event streaming
5. GCP infrastructure telemetry endpoint
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models import (
    Customer, Application, CreditCase, Document, KYCCheck,
    FinancialAssessment, CAMVersion, CaseState, IntakeChannel
)
from app.core.financial_engine import FinancialEngine
from app.integrations.vertex_ai_service import VertexAICamService
from app.integrations.gcs_service import GoogleCloudStorageService
from app.integrations.secret_manager_service import GCPSecretManagerService
from app.core.cloud_logger import GoogleCloudLoggingService

from sqlalchemy.pool import StaticPool

# Isolated in-memory SQLite database for testing using StaticPool
TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
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

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

def test_vertex_ai_cam_generation(db_session):
    """
    Verifies that Vertex AI (Gemini) generates an 8-section CAM with cited evidence and token telemetry.
    """
    cust = Customer(
        customer_type="INDIVIDUAL",
        name="Folake Ojo",
        email="folake.ojo@example.ng",
        phone="+234 802 333 4444",
        bvn="22233344455"
    )
    db_session.add(cust)
    db_session.flush()

    app_req = Application(
        customer_id=cust.id,
        amount=3_500_000.0,
        currency="NGN",
        tenor=18,
        purpose="Medical clinic equipment procurement",
        intake_channel=IntakeChannel.OFL_DIRECT.value,
        applicant_type="INDIVIDUAL"
    )
    db_session.add(app_req)
    db_session.flush()

    credit_case = CreditCase(
        application_id=app_req.id,
        case_number="OFL-2026-TEST01",
        state=CaseState.ANALYST_REVIEW.value,
        revision=1
    )
    db_session.add(credit_case)
    db_session.flush()

    # Ingest document
    sample_pdf = b"%PDF-1.4 sample statement contents"
    upload_res = GoogleCloudStorageService.upload_document(
        case_id=credit_case.id,
        document_type="BANK_STATEMENT",
        filename="folake_bank_stmt.pdf",
        content_bytes=sample_pdf
    )

    doc = Document(
        case_id=credit_case.id,
        document_type="BANK_STATEMENT",
        object_key=upload_res["blob_path"],
        checksum=upload_res["checksum"],
        version=1,
        scan_status="CLEAN",
        original_filename="folake_bank_stmt.pdf"
    )
    db_session.add(doc)
    db_session.flush()

    # Deterministic financial assessment
    fin_eval = FinancialEngine.evaluate({
        "requested_amount": 3_500_000.0,
        "tenor_months": 18,
        "applicant_type": "INDIVIDUAL",
        "verified_monthly_income": 850_000.0,
        "existing_monthly_debt": 50_000.0,
        "estimated_monthly_expenses": 300_000.0,
        "collateral_value": 5_000_000.0
    })
    fin = FinancialAssessment(
        case_id=credit_case.id,
        formula_version=fin_eval["formula_version"],
        input_snapshot={"verified_monthly_income": 850000.0},
        calculated_ratios=fin_eval["calculated_ratios"],
        policy_flags=fin_eval["policy_flags"]
    )
    db_session.add(fin)
    db_session.flush()

    # Execute Vertex AI CAM drafting
    cam = VertexAICamService.generate_draft_cam(
        db=db_session,
        credit_case=credit_case,
        financial_assessment=fin,
        actor="Risk Analyst Test"
    )

    assert cam.version == 1
    assert "Folake Ojo".lower() in cam.borrower_profile.lower()
    assert len(cam.evidence_citations) == 1
    assert cam.evidence_citations[0]["checksum"] == upload_res["checksum"]
    
    # Check Vertex AI telemetry
    tele = cam.source_snapshot.get("token_telemetry")
    assert tele is not None
    assert tele["provider"] == "GOOGLE_CLOUD_VERTEX_AI"
    assert tele["total_tokens"] > 0
    assert tele["estimated_cost_usd"] > 0

def test_gcs_document_storage_and_checksum():
    """
    Verifies GCS upload, SHA-256 calculation, and signed URL generation.
    """
    payload = b"Opticom Credit Facility Agreement Payload 2026"
    res = GoogleCloudStorageService.upload_document(
        case_id="case-12345",
        document_type="OFFER_LETTER",
        filename="signed_facility_letter.pdf",
        content_bytes=payload
    )

    assert res["checksum"] == GoogleCloudStorageService.compute_sha256(payload)
    assert "cases/case-12345/OFFER_LETTER/signed_facility_letter.pdf" in res["blob_path"]
    
    signed_url = GoogleCloudStorageService.generate_signed_read_url(res["blob_path"])
    assert signed_url is not None
    assert len(signed_url) > 0

def test_secret_manager_inventory():
    """
    Verifies GCP Secret Manager service provides health audit inventory.
    """
    inventory = GCPSecretManagerService.get_secrets_inventory()
    assert "gcp_secret_manager_enabled" in inventory
    assert inventory["secret_count"] > 0
    assert "DATABASE_URL" in inventory["secrets_status"]

def test_cloud_logging_telemetry():
    """
    Verifies Google Cloud Logging structured logging service.
    """
    tele = GoogleCloudLoggingService.get_logging_telemetry()
    assert "ofl-audit-stream" in tele["log_stream_name"]
    assert tele["tamper_evident"] is True

def test_telemetry_gcp_api(client):
    """
    Tests the GET /api/v1/telemetry/gcp-infrastructure and /ai-costs endpoints.
    """
    resp_infra = client.get("/api/v1/telemetry/gcp-infrastructure")
    assert resp_infra.status_code == 200
    infra_data = resp_infra.json()
    assert infra_data["cloud_platform"] == "Google Cloud Platform (GCP)"
    assert "vertex_ai" in infra_data["services"]
    assert "cloud_storage" in infra_data["services"]
    assert "secret_manager" in infra_data["services"]
    assert "cloud_logging" in infra_data["services"]

    resp_ai = client.get("/api/v1/telemetry/ai-costs")
    assert resp_ai.status_code == 200
    ai_data = resp_ai.json()
    assert ai_data["cloud_provider"] == "Google Cloud Platform (GCP)"
    assert "Vertex AI" in ai_data["ai_underwriter"]
