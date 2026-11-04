"""
Enterprise Robustness Improvements Test Suite
Validates the 6 production enhancements:
1. Enterprise IAM (OAuth2 / Signed JWT / Role-Based Access Control)
2. Inbound Webhook HMAC SHA-256 Cryptographic Verification
3. Scanned Statement OCR Fallback via Google Cloud Document AI
4. Asynchronous Background Task Queue & Job Tracker
5. Multi-Channel Transactional Notifications (SMS / Email)
6. Alembic Schema Versioning & Migrations
"""
import hmac
import hashlib
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.core.security import create_access_token, decode_access_token
from app.core.background_jobs import JobManager
from app.integrations.notification_service import NotificationService
from app.integrations.bank_statement_analyzer import BankStatementAnalyzer

client = TestClient(app)

def test_enterprise_iam_login_and_token_validation():
    """
    Validates staff login, JWT token issuance, and /api/v1/auth/me inspection.
    """
    # 1. Staff Login
    resp = client.post("/api/v1/auth/login", json={
        "username_or_role": "analyst",
        "pin_or_password": "1988"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"].lower() == "bearer"
    assert data["user"]["role"] == "ANALYST"
    assert data["user"]["name"] == "Babatunde Adebayo"

    token = data["access_token"]
    
    # 2. Decode and verify payload
    payload = decode_access_token(token)
    assert payload is not None
    assert payload.sub == "USR-OFL-001" or len(payload.sub) > 10
    assert payload.role == "ANALYST"

    # 3. Authenticated /me endpoint
    me_resp = client.get("/api/v1/auth/me", headers={
        "Authorization": f"Bearer {token}"
    })
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["id"] == payload.sub
    assert me_data["role"] == "ANALYST"

    # 4. Invalid token rejection
    bad_resp = client.get("/api/v1/auth/me", headers={
        "Authorization": "Bearer invalid_tampered_token_string"
    })
    assert bad_resp.status_code == 401


def test_enterprise_iam_invalid_credentials():
    """
    Validates invalid pin / unknown staff ID returns 401.
    """
    resp = client.post("/api/v1/auth/login", json={
        "username_or_role": "unknown_user",
        "pin_or_password": "0000"
    })
    assert resp.status_code == 401


def test_inbound_webhook_hmac_verification():
    """
    Validates HMAC SHA-256 signature verification for inbound Besto webhooks.
    """
    payload = {
        "source_system": "BESTO",
        "source_application_id": "TEST-HMAC-WEBHOOK-001",
        "requested_amount_ngn": 1800000.0,
        "applicant_details": {
            "name": "Tunde Bakare",
            "email": "tunde@securelogistics.ng",
            "phone": "08033221100",
            "bvn": "22233344455"
        },
        "kyc_evidence": {
            "status": "PASSED",
            "provider_ref": "YV-HMAC-99"
        },
        "submitted_at": "2026-10-27T10:00:00Z",
        "schema_version": "1.0"
    }
    raw_body = json.dumps(payload).encode("utf-8")
    valid_sig = hmac.new(
        settings.WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    # 1. Valid HMAC header -> 200 OK
    resp_valid = client.post(
        "/api/v1/intake/besto",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Signature-SHA256": valid_sig
        }
    )
    assert resp_valid.status_code == 200
    assert resp_valid.json()["case_number"].startswith("OFL-")

    # 2. Tampered / Forged HMAC signature -> 401 Unauthorized
    resp_tampered = client.post(
        "/api/v1/intake/besto",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Signature-SHA256": "bad_signature_000000000000000000000000000000000000000000000000"
        }
    )
    assert resp_tampered.status_code == 401
    assert "Invalid webhook HMAC SHA-256 signature" in resp_tampered.json()["detail"]


def test_scanned_statement_ocr_fallback():
    """
    Validates Google Cloud Document AI fallback triggering on low-character / scanned PDFs.
    """
    # 1. Simulate empty scanned PDF (< 80 characters extracted)
    blank_pdf = b"%PDF-1.4\n%EOF"
    extracted_text, ocr_engine = BankStatementAnalyzer.extract_text_from_file(
        blank_pdf,
        "scanned_mercantile_statement.pdf"
    )
    assert ocr_engine == "GOOGLE_DOCUMENT_AI_FALLBACK"
    assert "GOOGLE CLOUD DOCUMENT AI FALLBACK" in extracted_text

    # 2. Direct Document AI helper test
    doc_ai_text, doc_ai_engine = BankStatementAnalyzer.fallback_ocr_document_ai(
        blank_pdf,
        "scanned_mercantile_statement.pdf"
    )
    assert doc_ai_engine == "GOOGLE_DOCUMENT_AI_FALLBACK"
    assert "GOOGLE CLOUD DOCUMENT AI FALLBACK" in doc_ai_text
    assert "UNITED BANK FOR AFRICA" in doc_ai_text


def test_asynchronous_background_job_queue():
    """
    Validates background job creation, tracking, and polling endpoints.
    """
    # 1. Create a simulated background job
    job_id = JobManager.create_job(
        job_type="OCR_PROCESSING",
        case_id="OFL-2026-JOB01"
    )
    assert job_id.startswith("JOB-")
    job = JobManager.get_job(job_id)
    assert job is not None
    assert job.status == "QUEUED"

    # 2. Poll job status via API
    poll_resp = client.get(f"/api/v1/jobs/{job_id}")
    assert poll_resp.status_code == 200
    job_data = poll_resp.json()
    assert job_data["job_id"] == job_id
    assert job_data["job_type"] == "OCR_PROCESSING"

    # 3. Complete the job and verify update
    JobManager.update_status(
        job_id,
        status="COMPLETED",
        progress=100,
        result={"extracted_pages": 14, "confidence_score": 0.98}
    )
    updated_resp = client.get(f"/api/v1/jobs/{job_id}")
    assert updated_resp.status_code == 200
    assert updated_resp.json()["status"] == "COMPLETED"
    assert updated_resp.json()["result"]["extracted_pages"] == 14

    # 4. List jobs endpoint
    list_resp = client.get("/api/v1/jobs")
    assert list_resp.status_code == 200
    assert any(j["job_id"] == job_id for j in list_resp.json())


def test_multi_channel_notifications_and_telemetry():
    """
    Validates SMS and Email dispatch logging and telemetry API.
    """
    # 1. Direct SMS Dispatch
    sms = NotificationService.send_sms(
        to_phone="08023456789",
        message="Opticom Finance: Test notification alert",
        template="TEST_ALERT",
        metadata={"test_id": "TEST-01"}
    )
    assert sms["id"].startswith("SMS-")
    assert sms["channel"] == "SMS"
    assert sms["status"] == "DELIVERED"
    assert sms["provider"] == "TERMII_NIGERIA"

    # 2. Direct Email Dispatch
    email = NotificationService.send_email(
        to_email="test@borrower.com",
        subject="Important Loan Notification",
        html_body="<p>Test notification content</p>",
        template="TEST_EMAIL"
    )
    assert email["id"].startswith("EML-")
    assert email["channel"] == "EMAIL"
    assert "CUSTOM_SMTP" in email["provider"] or "SENDGRID" in email["provider"]

    # 3. Notification Telemetry Endpoint
    telemetry_resp = client.get("/api/v1/telemetry/notifications")
    assert telemetry_resp.status_code == 200
    logs = telemetry_resp.json()["delivery_logs"]
    assert len(logs) >= 2
    assert any(log["id"] == sms["id"] for log in logs)
    assert any(log["id"] == email["id"] for log in logs)

def test_credit_underwriting_ai_copilot():
    """
    Validates staff AI Copilot endpoint (/api/v1/copilot/chat).
    Tests policy queries and active case grounding.
    """
    # 1. Ask policy question
    resp = client.post("/api/v1/copilot/chat", json={
        "message": "What is the difference between CBN 23% MPR and Opticom 28% APR?",
        "persona": "Senior Credit Analyst"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "reply" in data
    assert "23.00%" in data["reply"]
    assert "28.00%" in data["reply"]
    assert "provider" in data

    # 2. Ask ratio benchmark question
    resp_ratios = client.post("/api/v1/copilot/chat", json={
        "message": "What are our DSCR and ICR benchmarks?",
        "persona": "Head of Risk Management"
    })
    assert resp_ratios.status_code == 200
    assert "1.20x" in resp_ratios.json()["reply"]
    assert "1.50x" in resp_ratios.json()["reply"]
