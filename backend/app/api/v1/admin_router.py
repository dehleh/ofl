"""
Opticom Administration & Internal Configuration Router
Provides endpoints for User & Role Management, SSO / SSID Federation,
MFA policies, Custom Corporate Email Client / SMTP configuration, and System Parameters.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from ...database import get_db, utc_now
from ...models.entities import SystemConfiguration, StaffUser
from ...core.config_manager import ConfigManager
from ...core.security import get_current_user, TokenPayload, STAFF_DIRECTORY
from ...core.cloud_logger import GoogleCloudLoggingService

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
    role: str  # ANALYST, HRM, BCC, MD, TREASURY, IT_OWNER, BDO, ADMIN
    department: Optional[str] = "Credit Operations"
    pin: Optional[str] = "1988"
    permissions: Optional[List[str]] = None

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

@router.post("/test-email")
def test_email_configuration(
    payload: TestEmailPayload,
    db: Session = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Dispatches a real-time diagnostic test email using custom SMTP or configured email client.
    """
    result = ConfigManager.test_email_connection(
        db=db,
        recipient=payload.recipient,
        config_override=payload.config_override
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
    db: Session = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Creates a new internal Opticom staff or administrator account.
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
            "HRM": ["approval:recommend", "approval:approve_5m", "exception:coordinate", "case:read"],
            "BCC": ["approval:approve_15m", "rejection:recommend", "case:read"],
            "MD": ["approval:approve_unlimited", "rejection:final", "disbursement:sanction"],
            "TREASURY": ["treasury:nav_confirm", "treasury:loandisc_sync"],
            "IT_OWNER": ["integration:retry", "exception:technical_restore", "telemetry:admin"],
            "ADMIN": ["admin:config", "admin:users", "admin:audit", "*"]
        }
        default_perms = role_map.get(payload.role.upper(), ["case:read"])

    user = StaffUser(
        username=payload.username.lower().strip(),
        email=payload.email.lower().strip(),
        name=payload.name.strip(),
        role=payload.role.upper(),
        department=payload.department or "Credit Operations",
        pin_hash=payload.pin or "1988",
        is_active=True,
        permissions=default_perms
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    GoogleCloudLoggingService.emit_audit_event(
        actor=current_user.name,
        role=current_user.role,
        event="STAFF_USER_CREATED",
        entity="STAFF_USER",
        entity_id=user.id,
        reason=f"Admin created account for {user.name} ({user.role})",
        correlation_id=user.id,
        details={"username": user.username, "role": user.role, "email": user.email}
    )

    return {
        "message": f"User {user.name} successfully created.",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "department": user.department,
            "is_active": user.is_active,
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
        user.pin_hash = payload.pin.strip()
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
