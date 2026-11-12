"""
Opticom Administration & Internal Configuration Router
Provides endpoints for User & Role Management, SSO / SSID Federation,
MFA policies, Custom Corporate Email Client / SMTP configuration, and System Parameters.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status, Body
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
import uuid
from pydantic import BaseModel, Field

from ...database import get_db, utc_now
from ...models.entities import SystemConfiguration, StaffUser
from ...core.config_manager import ConfigManager
from ...core.email_gateway import dispatch_email
from ...core.security import (
    get_current_user,
    TokenPayload,
    STAFF_DIRECTORY,
    hash_pin_or_password,
    create_invite_token,
)
from ...core.cloud_logger import GoogleCloudLoggingService
from ...integrations.notification_service import NotificationService

router = APIRouter(prefix="/admin", tags=["Opticom Administration"])

class UpdateConfigPayload(BaseModel):
    value: Dict[str, Any]

class TestEmailPayload(BaseModel):
    recipient: str
    config_override: Optional[Dict[str, Any]] = None

class CreateUserPayload(BaseModel):
    username: str
    email: str
    name: str
    role: str  # ANALYST, HEAD_OF_BD, BDO, HRM, BCC, MD, OPERATIONS, TREASURY, AUDITOR, IT_OWNER, ADMIN, or custom role
    department: Optional[str] = "Credit Operations"
    pin: Optional[str] = None
    permissions: Optional[List[str]] = None
    send_invite: Optional[bool] = None
    frontend_base_url: Optional[str] = None

class SendInvitePayload(BaseModel):
    frontend_base_url: Optional[str] = None

class UpdateUserPayload(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    pin: Optional[str] = None
    permissions: Optional[List[str]] = None

@router.get("/config")
def get_system_configurations(
    db: Session = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Returns all system configurations with sensitive secrets masked for security.
    """
    return ConfigManager.get_all_configurations(db, mask_secrets=True)

@router.put("/config/{key}")
def update_system_configuration(
    key: str,
    payload: UpdateConfigPayload,
    db: Session = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Updates administrative configuration for a specific key (SSO, MFA, EMAIL, SMS, POLICY).
    Preserves existing secrets if masked text was passed back.
    """
    updated = ConfigManager.update_configuration(
        db=db,
        key=key,
        new_value=payload.value,
        actor=current_user.name
    )

    GoogleCloudLoggingService.emit_audit_event(
        actor=current_user.name,
        role=current_user.role,
        event="SYSTEM_CONFIGURATION_UPDATED",
        entity="SYSTEM_CONFIG",
        entity_id=key,
        reason=f"Updated configuration for {key}",
        correlation_id=key,
        details={"updated_keys": list(payload.value.keys())}
    )

    return {
        "message": f"Configuration for {key} successfully updated.",
        "config": updated
    }

@router.get("/pricing-policy")
def get_admin_pricing_policy(
    db: Session = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Returns active pricing policy and interest rate benchmarks for administration.
    """
    return ConfigManager.get_pricing_policy(db)

@router.get("/fees")
def get_fee_catalog(
    db: Session = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Returns master fee catalog including standard Opticom fees and bespoke fees.
    """
    return ConfigManager.get_fee_catalog(db)

class UpdateFeeCatalogPayload(BaseModel):
    fees: List[Dict[str, Any]]

@router.put("/fees")
def update_fee_catalog(
    payload: UpdateFeeCatalogPayload,
    db: Session = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Updates master catalog of facility fees with bespoke fee additions.
    """
    updated_catalog = ConfigManager.update_fee_catalog(
        db=db,
        fees=payload.fees,
        actor=current_user.name
    )

    GoogleCloudLoggingService.emit_audit_event(
        actor=current_user.name,
        role=current_user.role,
        event="FEE_CATALOG_UPDATED",
        entity="SYSTEM_CONFIG",
        entity_id="FEE_CATALOG",
        reason=f"Admin updated master fee catalog ({len(payload.fees)} items configured)",
        correlation_id="FEE_CATALOG",
        details={"fee_count": len(payload.fees)}
    )

    return {
        "message": "Master fee catalog updated successfully.",
        "fees": updated_catalog
    }

@router.post("/test-email")
def test_email_configuration(
    payload: TestEmailPayload,
    db: Session = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Dispatches a real-time diagnostic test email using the configured Email Service API or SMTP gateway.
    """
    result = dispatch_email(
        to_email=payload.recipient,
        subject="[OPTICOM DIAGNOSTIC] Email Service Gateway Verification",
        html_body=(
            "<h3>Opticom Finance Limited — Outbound Email Gateway Test</h3>"
            "<p>This message confirms your Email Service API / SMTP configuration is active and "
            "ready for internal staff notifications, executive alerts, and customer offer packages.</p>"
        ),
        template="EMAIL_GATEWAY_DIAGNOSTIC",
        db=db,
        config_override=payload.config_override,
    )

    GoogleCloudLoggingService.emit_audit_event(
        actor=current_user.name,
        role=current_user.role,
        event="EMAIL_CLIENT_DIAGNOSTIC_TEST",
        entity="EMAIL_GATEWAY",
        entity_id=payload.recipient,
        reason="Admin initiated test email connection verification",
        correlation_id=f"TEST-EML-{int(utc_now().timestamp())}",
        details=result
    )

    return result

def _activation_status(u: StaffUser) -> str:
    if (u.pin_hash or "").startswith("INVITE_PENDING:"):
        return "PENDING_ACTIVATION"
    return "ACTIVE" if u.is_active else "DEACTIVATED"


def _resolve_portal_base_url(request: Request, explicit_base_url: Optional[str] = None) -> str:
    if explicit_base_url and explicit_base_url.strip():
        return explicit_base_url.strip().rstrip("/")
    origin = request.headers.get("origin")
    if origin:
        return origin.rstrip("/")
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if host:
        return f"{proto}://{host}".rstrip("/")
    return str(request.base_url).rstrip("/")


def _issue_staff_invite(
    db: Session,
    user: StaffUser,
    request: Request,
    frontend_base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Generates a single-use 72-hour activation invite link and dispatches it via Email + In-App."""
    invite_jti = uuid.uuid4().hex
    user.pin_hash = f"INVITE_PENDING:{invite_jti}"
    user.is_active = False
    user.updated_at = utc_now()
    db.flush()

    token = create_invite_token(user_id=user.id, email=user.email, invite_jti=invite_jti, expires_hours=72)
    base_url = _resolve_portal_base_url(request, frontend_base_url)
    invite_url = f"{base_url}/staff?invite={token}"

    NotificationService.send_email(
        to_email=user.email,
        subject="Opticom Finance Limited — Activate Your Staff Underwriting Account",
        html_body=(
            f"<p>Dear <strong>{user.name}</strong>,</p>"
            f"<p>An internal staff account has been provisioned for you on the "
            f"<strong>Opticom Finance Credit Automation &amp; Underwriting Platform</strong>.</p>"
            f"<p><strong>Username:</strong> {user.username}<br/>"
            f"<strong>Assigned Role:</strong> {user.role}<br/>"
            f"<strong>Department:</strong> {user.department or 'Credit Operations'}</p>"
            f"<p>Please click the activation link below to set your personal password/PIN and activate your access "
            f"(valid for 72 hours, single use):</p>"
            f"<p><a href=\"{invite_url}\" style=\"display:inline-block;padding:10px 18px;background:#0096cc;color:#ffffff;"
            f"text-decoration:none;border-radius:6px;font-weight:bold;\">Activate My Staff Account</a></p>"
            f"<p style=\"font-size:12px;color:#475569;\">Or copy this URL into your browser:<br/>{invite_url}</p>"
        ),
        template="STAFF_INVITE_ACTIVATION",
        metadata={"user_id": user.id, "username": user.username, "role": user.role},
        db=db,
    )
    NotificationService.create_in_app_notification(
        title=f"Staff Activation Invite Sent: {user.name}",
        message=f"Activation invite emailed to {user.email} ({user.role}). Awaiting user password setup.",
        notification_type="INFO",
        category="USER_INVITE",
        recipient_role="ADMIN",
    )
    return {
        "invite_url": invite_url,
        "invite_token": token,
        "expires_hours": 72,
    }


@router.get("/users")
def list_staff_users(
    db: Session = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Lists all internal staff and administrative users.
    """
    ConfigManager.seed_defaults_if_needed(db)
    users = db.query(StaffUser).all()

    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "department": u.department,
            "is_active": u.is_active,
            "activation_status": _activation_status(u),
            "permissions": u.permissions or [],
            "mfa_enabled": u.mfa_enabled,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None
        }
        for u in users
    ]

@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_staff_user(
    payload: CreateUserPayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Creates a new internal Opticom staff or administrator account.
    Supports either direct PIN provisioning or generating a single-use email activation invite link.
    """
    # Check if username or email exists
    existing = db.query(StaffUser).filter(
        (StaffUser.username == payload.username.lower().strip()) | 
        (StaffUser.email == payload.email.lower().strip())
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this username or email already exists."
        )

    # Default role permissions
    default_perms = payload.permissions
    if not default_perms:
        role_map = {
            "ANALYST": ["cam:create", "cam:edit", "case:read", "exception:raise", "statement:analyze"],
            "BDO": ["intake:assisted", "case:read", "intake:originate"],
            "HEAD_OF_BD": ["approval:recommend", "bd:endorse", "fees:manage", "case:read"],
            "HRM": ["approval:recommend", "approval:risk_review", "exception:coordinate", "case:read"],
            "BCC": ["approval:approve_unlimited", "rejection:recommend", "case:read"],
            "MD": ["admin:config", "admin:users", "approval:approve_20m", "approval:approve_unlimited", "rejection:final", "disbursement:sanction", "fees:manage", "*"],
            "OPERATIONS": ["offer:generate", "conditions:verify", "case:read"],
            "TREASURY": ["treasury:nav_confirm", "treasury:loandisc_sync"],
            "AUDITOR": ["audit:read", "audit:export", "case:read"],
            "IT_OWNER": ["integration:retry", "exception:technical_restore", "telemetry:admin"],
            "ADMIN": ["admin:config", "admin:users", "admin:audit", "*"]
        }
        default_perms = role_map.get(payload.role.upper().strip(), ["case:read", "telemetry:read"])

    should_invite = payload.send_invite if payload.send_invite is not None else not bool(payload.pin and payload.pin.strip())
    initial_pin_hash = "INVITE_PENDING:INIT" if should_invite else hash_pin_or_password((payload.pin or "1988").strip())

    user = StaffUser(
        username=payload.username.lower().strip(),
        email=payload.email.lower().strip(),
        name=payload.name.strip(),
        role=payload.role.upper().strip(),
        department=payload.department or "Credit Operations",
        pin_hash=initial_pin_hash,
        is_active=not should_invite,
        permissions=default_perms
    )
    db.add(user)
    db.flush()

    invite_info = None
    if should_invite:
        invite_info = _issue_staff_invite(
            db=db,
            user=user,
            request=request,
            frontend_base_url=payload.frontend_base_url,
        )

    db.commit()
    db.refresh(user)

    GoogleCloudLoggingService.emit_audit_event(
        actor=current_user.name,
        role=current_user.role,
        event="STAFF_USER_CREATED",
        entity="STAFF_USER",
        entity_id=user.id,
        reason=f"Admin created account for {user.name} ({user.role})" + (" [Invite Sent]" if should_invite else ""),
        correlation_id=user.id,
        details={"username": user.username, "role": user.role, "email": user.email, "invited": should_invite}
    )

    resp: Dict[str, Any] = {
        "message": (
            f"User {user.name} provisioned. Activation invite emailed to {user.email}."
            if should_invite
            else f"User {user.name} successfully created."
        ),
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "department": user.department,
            "is_active": user.is_active,
            "activation_status": _activation_status(user),
            "permissions": user.permissions
        }
    }
    if invite_info:
        resp["invite_url"] = invite_info["invite_url"]
        resp["invite_expires_hours"] = invite_info["expires_hours"]
    return resp


@router.post("/users/{user_id}/invite")
def resend_staff_invite(
    user_id: str,
    request: Request,
    payload: Optional[SendInvitePayload] = Body(default=None),
    db: Session = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user)
):
    """Issues a fresh single-use activation invite link for a new or existing staff account."""
    user = db.query(StaffUser).filter(StaffUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Staff user not found.")

    invite_info = _issue_staff_invite(
        db=db,
        user=user,
        request=request,
        frontend_base_url=payload.frontend_base_url if payload else None,
    )
    db.commit()
    db.refresh(user)

    GoogleCloudLoggingService.emit_audit_event(
        actor=current_user.name,
        role=current_user.role,
        event="STAFF_INVITE_SENT",
        entity="STAFF_USER",
        entity_id=user.id,
        reason=f"Admin dispatched activation invite link to {user.email}",
        correlation_id=user.id,
        details={"username": user.username, "email": user.email}
    )

    return {
        "message": f"Activation invite sent to {user.email}.",
        "invite_url": invite_info["invite_url"],
        "invite_expires_hours": invite_info["expires_hours"],
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "department": user.department,
            "is_active": user.is_active,
            "activation_status": _activation_status(user),
            "permissions": user.permissions
        }
    }

@router.put("/users/{user_id}")
def update_staff_user(
    user_id: str,
    payload: UpdateUserPayload,
    db: Session = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Updates an existing staff user's attributes, role, or active status.
    """
    user = db.query(StaffUser).filter(StaffUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Staff user not found.")

    if payload.name is not None:
        user.name = payload.name
    if payload.email is not None:
        user.email = payload.email.lower().strip()
    if payload.role is not None:
        user.role = payload.role.upper()
    if payload.department is not None:
        user.department = payload.department
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.pin is not None and payload.pin.strip():
        user.pin_hash = hash_pin_or_password(payload.pin.strip())
    if payload.permissions is not None:
        user.permissions = payload.permissions

    user.updated_at = utc_now()
    db.commit()
    db.refresh(user)

    GoogleCloudLoggingService.emit_audit_event(
        actor=current_user.name,
        role=current_user.role,
        event="STAFF_USER_UPDATED",
        entity="STAFF_USER",
        entity_id=user.id,
        reason=f"Admin updated account for {user.name}",
        correlation_id=user.id,
        details={"updated_fields": payload.model_dump(exclude_unset=True)}
    )

    return {
        "message": f"User {user.name} updated successfully.",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "department": user.department,
            "is_active": user.is_active,
            "activation_status": _activation_status(user),
            "permissions": user.permissions
        }
    }

@router.delete("/users/{user_id}")
def deactivate_staff_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Deactivates a staff user account.
    """
    user = db.query(StaffUser).filter(StaffUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Staff user not found.")

    user.is_active = False
    user.updated_at = utc_now()
    db.commit()

    GoogleCloudLoggingService.emit_audit_event(
        actor=current_user.name,
        role=current_user.role,
        event="STAFF_USER_DEACTIVATED",
        entity="STAFF_USER",
        entity_id=user.id,
        reason=f"Admin deactivated account for {user.name}",
        correlation_id=user.id,
        details={"username": user.username}
    )

    return {"message": f"Staff user {user.name} has been deactivated."}

@router.post("/seed-demo")
def seed_demo_data_endpoint(
    db: Session = Depends(get_db)
):
    """
    Seeds / resets the full 9-case demonstration pipeline and RBAC tasks directly on GCP or local environments.
    """
    try:
        from ...scripts.seed_executive_demo import seed_demo
    except (ImportError, ValueError):
        import sys, os
        backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        if backend_root not in sys.path:
            sys.path.insert(0, backend_root)
        from scripts.seed_executive_demo import seed_demo
    seed_demo(db_session=db)
    return {
        "message": "Successfully seeded/refreshed 9 executive demonstration cases on environment.",
        "status": "SUCCESS"
    }
