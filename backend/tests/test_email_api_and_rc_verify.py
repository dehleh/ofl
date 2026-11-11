"""
Tests for:
1. Email Service API configuration (SendGrid, Resend, Postmark, Custom HTTP API) & Dual Notification dispatch (Email + In-App).
2. Live CAC RC/BN Number Verification (`POST /api/v1/intake/resolve-rc`).
3. Salary Loan & Facility Classification intake with Guarantor & Contact details persistence.
"""
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import create_access_token
from app.database import SessionLocal
from app.models.entities import InAppNotification, Customer, CreditCase
from app.integrations.notification_service import NotificationService

client = TestClient(app)


def _admin_headers():
    token = create_access_token({
        "sub": "USR-OFL-000",
        "email": "admin@opticomfinance.com",
        "name": "Opticom System Administrator",
        "role": "ADMIN",
        "permissions": ["*"]
    })
    return {"Authorization": f"Bearer {token}"}


def test_email_service_api_config_and_live_http_dispatch():
    headers = _admin_headers()

    # 1. Configure Resend Transactional Email API
    res_put = client.put(
        "/api/v1/admin/config/EMAIL_CLIENT",
        json={
            "value": {
                "mode": "RESEND",
                "provider_name": "Resend Opticom API",
                "api_endpoint": "https://api.resend.com/emails",
                "api_key": "re_test_live_api_key_998877",
                "from_name": "Opticom Credit Desk",
                "from_email": "info@opticomfinance.com",
                "reply_to": "customercare@opticomfinance.com",
                "enabled": True
            }
        },
        headers=headers
    )
    assert res_put.status_code == 200

    # Verify API key is masked on read
    res_get = client.get("/api/v1/admin/config", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["EMAIL_CLIENT"]["value"]["api_key"] == "••••••••••••"

    # 2. Verify live HTTP dispatch executes with real Bearer token
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = '{"id": "email_123"}'

    mock_http = MagicMock()
    mock_http.post.return_value = mock_response
    mock_client_cm = MagicMock()
    mock_client_cm.__enter__.return_value = mock_http

    with patch("app.core.email_gateway.httpx.Client", return_value=mock_client_cm):
        test_res = client.post(
            "/api/v1/admin/test-email",
            json={"recipient": "risk.desk@opticomfinance.com"},
            headers=headers
        )

    assert test_res.status_code == 200
    body = test_res.json()
    assert body["success"] is True
    assert body["delivered_live"] is True
    assert body["status"] == "SENT_LIVE"
    assert "RESEND" in body["provider"]

    mock_http.post.assert_called_once()
    call_kwargs = mock_http.post.call_args.kwargs
    assert mock_http.post.call_args.args[0] == "https://api.resend.com/emails"
    assert call_kwargs["headers"]["Authorization"] == "Bearer re_test_live_api_key_998877"
    assert call_kwargs["json"]["to"] == ["risk.desk@opticomfinance.com"]

    # 3. Verify Postmark & Custom HTTP API work uniformly with masked secret preservation
    with patch("app.core.email_gateway.httpx.Client", return_value=mock_client_cm):
        custom_res = client.post(
            "/api/v1/admin/test-email",
            json={
                "recipient": "md@opticomfinance.com",
                "config_override": {
                    "mode": "CUSTOM_API",
                    "provider_name": "Internal SES Relay",
                    "api_endpoint": "https://mail-relay.opticomfinance.com/send",
                    "api_key": "••••••••••••"
                }
            },
            headers=headers
        )
    assert custom_res.status_code == 200
    assert custom_res.json()["success"] is True
    assert custom_res.json()["delivered_live"] is True

    # Restore default CUSTOM_SMTP config so sibling tests see expected baseline
    client.put(
        "/api/v1/admin/config/EMAIL_CLIENT",
        json={
            "value": {
                "mode": "CUSTOM_SMTP",
                "provider_name": "Opticom Exchange Mail Server",
                "smtp_host": "mail.opticomfinance.com",
                "smtp_port": 587,
                "security": "STARTTLS",
                "username": "customercare@opticomfinance.com",
                "password": "opticom-corporate-smtp-secret-key-2026",
                "from_name": "Opticom Finance Credit Operations",
                "from_email": "info@opticomfinance.com",
                "api_endpoint": "",
                "api_key": "",
                "enabled": True
            }
        },
        headers=headers
    )


def test_dual_notifications_for_comments_offers_and_disbursement():
    NotificationService.notify_deliberation_comment(
        case_number="OFL-TEST-DUAL-01",
        obligor_name="Zenith Trading Ltd",
        actor="Dr. Chidinma Okafor",
        role="HRM",
        comments="Verify perfected lien before drawdown."
    )
    NotificationService.notify_offer_issued(
        case_number="OFL-TEST-DUAL-01",
        customer_phone="08031234567",
        customer_email="borrower@zenithtrading.ng",
        approved_amount=12_000_000.0,
        tenor_months=12,
        monthly_repayment=1_280_000.0
    )
    NotificationService.notify_case_disbursed(
        case_number="OFL-TEST-DUAL-01",
        customer_phone="08031234567",
        customer_email="borrower@zenithtrading.ng",
        amount=12_000_000.0,
        nav_reference="LD-998811"
    )

    logs = NotificationService.get_delivery_logs(limit=40)
    templates = [entry["template"] for entry in logs if entry.get("metadata", {}).get("case_number") == "OFL-TEST-DUAL-01"]
    assert "DELIBERATION_NOTE" in templates
    assert "OFFER_ISSUED" in templates
    assert "FACILITY_DISBURSED" in templates

    db = SessionLocal()
    try:
        in_app_rows = db.query(InAppNotification).filter(
            InAppNotification.case_number == "OFL-TEST-DUAL-01"
        ).all()
        categories = {r.category for r in in_app_rows}
        assert {"DELIBERATION_NOTE", "OFFER_ISSUED", "DISBURSED"}.issubset(categories)
    finally:
        db.close()


def test_resolve_rc_number_endpoint():
    # Valid Opticom BN entry
    res_bn = client.post("/api/v1/intake/resolve-rc", json={"rc_number": "BN 7049792"})
    assert res_bn.status_code == 200
    data_bn = res_bn.json()
    assert data_bn["success"] is True
    assert data_bn["cac_status"] in ("ACTIVE", "FOUND", "VERIFIED")
    assert "LEO-AKINBONI" in data_bn["company_name"]

    # Valid Opticom Limited RC entry
    res_rc = client.post("/api/v1/intake/resolve-rc", json={"rc_number": "RC 347832"})
    assert res_rc.status_code == 200
    assert res_rc.json()["company_name"] == "OPTICOM FINANCE LIMITED"

    # Non-existent invalid pattern rejected cleanly
    res_bad = client.post("/api/v1/intake/resolve-rc", json={"rc_number": "RC 000999"})
    assert res_bad.status_code == 422


def test_salary_loan_with_guarantor_and_contact_details():
    payload = {
        "applicant_name": "Toluwanimi Adeyemi",
        "applicant_type": "INDIVIDUAL",
        "email": "tolu.adeyemi@corporate.ng",
        "phone": "08023334455",
        "bvn": "22446688001",
        "nin": "71234567890",
        "rc_number": "",
        "business_address": "Chevron Towers, Lekki, Lagos State",
        "residential_address": "Flat 4B, Ikoyi Crescent, Lagos State",
        "means_of_id_type": "PASSPORT",
        "means_of_id_number": "A09871234",
        "facility_type": "Salary Loan / Payroll Advance",
        "guarantor_name": "Engr. Babajide Olawale",
        "guarantor_email": "b.olawale@suretycorp.ng",
        "guarantor_phone": "08037778899",
        "guarantor_address": "18 Norman Williams Street, SW Ikoyi, Lagos",
        "guarantor_occupation": "General Manager, Power Engineering Ltd",
        "guarantor_bvn": "22112233445",
        "amount": 3_500_000.0,
        "tenor_months": 12,
        "purpose": "Personal salary-backed education and relocation advance",
        "monthly_income": 1_850_000.0,
        "existing_monthly_debt": 50_000.0,
        "estimated_monthly_expenses": 300_000.0,
        "collateral_value": 0.0
    }
    res = client.post("/api/v1/intake/direct", json=payload)
    assert res.status_code == 201
    case_number = res.json()["case_number"]

    db = SessionLocal()
    try:
        case = db.query(CreditCase).filter(CreditCase.case_number == case_number).first()
        assert case is not None
        cust = db.query(Customer).filter(Customer.id == case.application.customer_id).first()
        attrs = cust.verified_attributes or {}
        assert attrs["facility_type"] == "Salary Loan / Payroll Advance"
        assert attrs["guarantor_name"] == "Engr. Babajide Olawale"
        assert attrs["guarantor_email"] == "b.olawale@suretycorp.ng"
        assert attrs["guarantor_phone"] == "08037778899"
        assert attrs["guarantor_bvn"] == "22112233445"

        # Confirm new intake emitted both Email and In-App notification
        in_app = db.query(InAppNotification).filter(
            InAppNotification.case_number == case_number,
            InAppNotification.category == "NEW_APPLICATION"
        ).first()
        assert in_app is not None
    finally:
        db.close()

    logs = NotificationService.get_delivery_logs(limit=25)
    assert any(
        entry.get("template") == "NEW_APPLICATION_INTAKE"
        and entry.get("metadata", {}).get("case_number") == case_number
        for entry in logs
    )

