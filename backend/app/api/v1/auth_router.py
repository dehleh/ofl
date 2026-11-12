"""
Authentication & SSO Router (OAuth2 / JWT Token Exchange)
"""
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from ...core.security import (
    STAFF_DIRECTORY, 
    create_access_token, 
    get_current_user, 
    TokenPayload,
    hash_pin_or_password,
    verify_pin_or_password,
    decode_invite_token,
)
from ...core.cloud_logger import GoogleCloudLoggingService
from ...database import get_db, utc_now
from ...models.entities import StaffUser

router = APIRouter(prefix="/auth", tags=["Enterprise Authentication"])

class LoginRequest(BaseModel):
    username_or_role: str
    pin_or_password: str = "1988"

class ActivateInviteRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=4, max_length=128)

class SSOCallbackRequest(BaseModel):
    provider: str = "google-workspace"  # google-workspace, azure-ad, okta
    auth_code: str
    email: str
    role_requested: Optional[str] = None

@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Standard staff login exchanging credentials or quick staff role for signed JWT.
    Checks database StaffUser directory and pre-provisioned directory.
    """
    key = payload.username_or_role.lower().strip()
    submitted_pin = (payload.pin_or_password or "").strip()
    user = None

    # 1. Check database StaffUser directory (exact username/email first, then active role match)
    db_user = db.query(StaffUser).filter(
        or_(StaffUser.username == key, StaffUser.email == key)
    ).first()
    if not db_user:
        db_user = db.query(StaffUser).filter(
            StaffUser.role == key.upper(),
            StaffUser.is_active.is_(True)
        ).first()

    if db_user:
        if (db_user.pin_hash or "").startswith("INVITE_PENDING:"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is awaiting activation. Open the invite link sent to your email to set your password."
            )
        if not db_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This staff account has been deactivated. Contact System Administrator."
            )
        if not verify_pin_or_password(submitted_pin, db_user.pin_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or security PIN."
            )
        db_user.last_login_at = utc_now()
        try:
            db.commit()
        except Exception:
            db.rollback()
        user = {
            "id": db_user.id,
            "email": db_user.email,
            "name": db_user.name,
            "role": db_user.role,
            "permissions": db_user.permissions or []
        }

    # 2. Check pre-provisioned directory fallback when user is not in DB yet
    if not user:
        user = STAFF_DIRECTORY.get(key)
        if not user:
            for _, v in STAFF_DIRECTORY.items():
                if v["email"].lower() == key or v.get("role", "").lower() == key:
                    user = v
                    break

        if not user or not verify_pin_or_password(submitted_pin, user.get("pin", "1988")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or security PIN."
            )

    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "permissions": user["permissions"]
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "permissions": user["permissions"]
        }
    }

@router.post("/sso-callback")
def sso_callback(payload: SSOCallbackRequest):
    """
    Simulates Google Workspace / Microsoft Entra ID enterprise token exchange.
    Maps corporate corporate email to underwriting authority role.
    """
    email = payload.email.lower().strip()
    matched_user = None
    for _, v in STAFF_DIRECTORY.items():
        if v["email"].lower() == email:
            matched_user = v
            break

    if not matched_user:
        role = (payload.role_requested or "ANALYST").upper()
        matched_user = {
            "id": f"USR-SSO-{hash(email) % 10000:04d}",
            "email": email,
            "name": email.split("@")[0].replace(".", " ").title(),
            "role": role,
            "permissions": ["case:read", "cam:create"]
        }

    token = create_access_token({
        "sub": matched_user["id"],
        "email": matched_user["email"],
        "name": matched_user["name"],
        "role": matched_user["role"],
        "permissions": matched_user["permissions"]
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": matched_user,
        "sso_provider": payload.provider
    }

@router.get("/me")
def get_current_user_profile(user: TokenPayload = Depends(get_current_user)):
    """
    Returns verified profile of the authenticated caller.
    """
    return {
        "id": user.sub,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "permissions": user.permissions
    }


def _validate_pending_invite(token: str, db: Session) -> StaffUser:
    """Decodes an invite JWT and guarantees the target user still holds that exact pending invite."""
    claims = decode_invite_token(token)
    user = db.query(StaffUser).filter(StaffUser.id == claims["sub"]).first()
    expected_marker = f"INVITE_PENDING:{claims['jti']}"
    if not user or user.pin_hash != expected_marker:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This activation link has already been used, superseded, or is no longer valid."
        )
    return user


@router.get("/invite/{token}")
def inspect_staff_invite(token: str, db: Session = Depends(get_db)):
    """Validates an activation invite token before displaying the password setup form."""
    user = _validate_pending_invite(token, db)
    return {
        "valid": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "department": user.department,
        }
    }


@router.post("/activate-invite")
def activate_staff_invite(payload: ActivateInviteRequest, db: Session = Depends(get_db)):
    """Completes account activation via email invite link by setting a personal hashed password/PIN."""
    user = _validate_pending_invite(payload.token, db)
    user.pin_hash = hash_pin_or_password(payload.password.strip())
    user.is_active = True
    user.last_login_at = utc_now()
    user.updated_at = utc_now()
    db.commit()
    db.refresh(user)

    GoogleCloudLoggingService.emit_audit_event(
        actor=user.name,
        role=user.role,
        event="STAFF_INVITE_ACTIVATED",
        entity="STAFF_USER",
        entity_id=user.id,
        reason=f"{user.name} activated staff account via invite link",
        correlation_id=user.id,
        details={"username": user.username, "email": user.email}
    )

    access_token = create_access_token({
        "sub": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "permissions": user.permissions or []
    })
    return {
        "message": "Staff account activated successfully.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "permissions": user.permissions or []
        }
    }
