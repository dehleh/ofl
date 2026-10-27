"""
Admin & System Configuration Test Suite
Validates administrative configuration management:
1. User & Staff Account Management (Create, List, Update, Deactivate)
2. SSO / SSID & OAuth2 Federation Configuration
3. MFA Security Policy Configuration
4. Custom Outbound Email Client & SMTP Integration
5. Real-time Diagnostic Test Email Dispatch
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

client = TestClient(app)

@pytest.fixture
def admin_headers():
    token = create_access_token({
        "sub": "USR-OFL-000",
        "email": "admin@opticom.ng",
        "name": "Opticom System Administrator",
        "role": "ADMIN",
        "permissions": ["admin:config", "admin:users", "*"]
    })
    return {"Authorization": f"Bearer {token}"}

def test_get_system_configurations(admin_headers):
    """
    Validates retrieval of all administrative configurations with masked secrets.
    """
    resp = client.get("/api/v1/admin/config", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "SSO_CONFIG" in data
    assert "MFA_CONFIG" in data
    assert "EMAIL_CLIENT" in data
    assert "SMS_GATEWAY" in data
    assert "CREDIT_THRESHOLDS" in data
    assert "WEBHOOK_INTEGRATIONS" in data

    # Verify sensitive secrets are masked
    assert data["SSO_CONFIG"]["value"]["client_secret"] == "••••••••••••"
    assert data["EMAIL_CLIENT"]["value"]["password"] == "••••••••••••"
    assert data["SMS_GATEWAY"]["value"]["api_key"] == "••••••••••••"

def test_update_email_client_configuration(admin_headers):
    """
    Validates updating custom corporate email client configuration.
    """
    new_email_config = {
        "mode": "CUSTOM_SMTP",
        "provider_name": "Opticom Internal Postfix Mailer",
        "smtp_host": "smtp.internal.opticom.ng",
        "smtp_port": 465,
        "security": "SSL_TLS",
        "username": "no-reply@opticom.ng",
        "password": "••••••••••••",  # Preserves existing secret
        "from_name": "Opticom Finance System",
        "from_email": "no-reply@opticom.ng",
        "reply_to": "support@opticom.ng",
        "enabled": True
    }

    resp = client.put(
        "/api/v1/admin/config/EMAIL_CLIENT",
        json={"value": new_email_config},
        headers=admin_headers
    )
    assert resp.status_code == 200
    updated = resp.json()["config"]["value"]
    assert updated["smtp_host"] == "smtp.internal.opticom.ng"
    assert updated["smtp_port"] == 465
    assert updated["security"] == "SSL_TLS"

def test_diagnostic_test_email(admin_headers):
    """
    Validates real-time diagnostic test email dispatch with live diagnostics.
    """
    resp = client.post(
        "/api/v1/admin/test-email",
        json={
            "recipient": "compliance.officer@opticom.ng",
            "config_override": {
                "mode": "CUSTOM_SMTP",
                "smtp_host": "mail.opticom.ng",
                "smtp_port": 587,
                "security": "STARTTLS",
                "from_name": "Opticom Test Daemon",
                "from_email": "test@opticom.ng"
            }
        },
        headers=admin_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "latency_ms" in data
    assert "diagnostics" in data
    assert data["diagnostics"]["recipient"] == "compliance.officer@opticom.ng"

def test_staff_user_lifecycle_and_authentication(admin_headers):
    """
    Validates creating a new staff account, updating details, and logging in.
    """
    import uuid
    suffix = uuid.uuid4().hex[:6]
    test_username = f"underwriter_{suffix}"
    test_email = f"underwriter_{suffix}@opticom.ng"

    # 1. Create new user
    create_resp = client.post(
        "/api/v1/admin/users",
        json={
            "username": test_username,
            "email": test_email,
            "name": "Ngozi Eze",
            "role": "ANALYST",
            "department": "Specialized SME Credit",
            "pin": "2026"
        },
        headers=admin_headers
    )
    assert create_resp.status_code == 201
    user_data = create_resp.json()["user"]
    assert user_data["username"] == test_username
    assert user_data["name"] == "Ngozi Eze"
    assert user_data["role"] == "ANALYST"
    user_id = user_data["id"]

    # 2. List users
    list_resp = client.get("/api/v1/admin/users", headers=admin_headers)
    assert list_resp.status_code == 200
    users = list_resp.json()
    assert any(u["id"] == user_id for u in users)

    # 3. Update user role
    update_resp = client.put(
        f"/api/v1/admin/users/{user_id}",
        json={"role": "HRM", "department": "Risk Oversight"},
        headers=admin_headers
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["user"]["role"] == "HRM"

    # 4. Authenticate as the newly created user via /auth/login
    login_resp = client.post("/api/v1/auth/login", json={
        "username_or_role": test_username,
        "pin_or_password": "2026"
    })
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "access_token" in login_data
    assert login_data["user"]["name"] == "Ngozi Eze"
    assert login_data["user"]["role"] == "HRM"

    # 5. Deactivate user
    del_resp = client.delete(f"/api/v1/admin/users/{user_id}", headers=admin_headers)
    assert del_resp.status_code == 200
