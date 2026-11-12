"""
Validates internal staff user creation (including non-seeded/custom roles),
single-use invite link generation + email dispatch, pre-activation login blocking,
account activation via invite token, and hashed password enforcement.
"""
import uuid
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import create_access_token
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


def test_create_custom_role_user_with_invite_link_and_activate():
    headers = _admin_headers()
    suffix = uuid.uuid4().hex[:6]
    username = f"legal_{suffix}"
    email = f"legal_{suffix}@opticomfinance.com"

    # 1. Create custom role user with invite activation enabled
    create_res = client.post(
        "/api/v1/admin/users",
        json={
            "username": username,
            "email": email,
            "name": "Adaeze Nwosu",
            "role": "LEGAL_COUNSEL",
            "department": "Legal & Company Secretariat",
            "send_invite": True,
            "frontend_base_url": "https://credit.opticomfinance.com"
        },
        headers=headers
    )
    assert create_res.status_code == 201
    body = create_res.json()
    user_id = body["user"]["id"]
    assert body["user"]["role"] == "LEGAL_COUNSEL"
    assert body["user"]["is_active"] is False
    assert body["user"]["activation_status"] == "PENDING_ACTIVATION"
    assert "invite_url" in body
    assert body["invite_url"].startswith("https://credit.opticomfinance.com/staff?invite=")

    token = body["invite_url"].split("?invite=")[1]

    # Verify invite email & in-app alert were recorded
    logs = NotificationService.get_delivery_logs(limit=15)
    assert any(
        l.get("template") == "STAFF_INVITE_ACTIVATION" and l.get("recipient") == email
        for l in logs
    )

    # 2. Login before activation must be blocked (403)
    pre_login = client.post(
        "/api/v1/auth/login",
        json={"username_or_role": username, "pin_or_password": "1988"}
    )
    assert pre_login.status_code == 403

    # 3. Inspect invite token
    inspect_res = client.get(f"/api/v1/auth/invite/{token}")
    assert inspect_res.status_code == 200
    assert inspect_res.json()["valid"] is True
    assert inspect_res.json()["user"]["email"] == email
    assert inspect_res.json()["user"]["role"] == "LEGAL_COUNSEL"

    # 4. Activate account with custom password
    act_res = client.post(
        "/api/v1/auth/activate-invite",
        json={"token": token, "password": "OpticomLegal#2026"}
    )
    assert act_res.status_code == 200
    act_body = act_res.json()
    assert "access_token" in act_body
    assert act_body["user"]["role"] == "LEGAL_COUNSEL"

    # 5. Single-use guarantee: reusing same invite token fails
    reuse_res = client.post(
        "/api/v1/auth/activate-invite",
        json={"token": token, "password": "AnotherPassword1"}
    )
    assert reuse_res.status_code == 400

    # 6. Default UAT PIN '1988' does NOT bypass user's personal password
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"username_or_role": username, "pin_or_password": "1988"}
    )
    assert bad_login.status_code == 401

    # 7. Real password authenticates cleanly
    ok_login = client.post(
        "/api/v1/auth/login",
        json={"username_or_role": username, "pin_or_password": "OpticomLegal#2026"}
    )
    assert ok_login.status_code == 200
    assert ok_login.json()["user"]["name"] == "Adaeze Nwosu"

    # 8. Admin resends invite link -> generates new token & activates cleanly
    resend_res = client.post(
        f"/api/v1/admin/users/{user_id}/invite",
        json={"frontend_base_url": "https://credit.opticomfinance.com"},
        headers=headers
    )
    assert resend_res.status_code == 200
    new_token = resend_res.json()["invite_url"].split("?invite=")[1]
    assert new_token != token
    reactivate_res = client.post(
        "/api/v1/auth/activate-invite",
        json={"token": new_token, "password": "RotatedSecret#2026"}
    )
    assert reactivate_res.status_code == 200

