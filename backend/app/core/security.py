"""
Security & Enterprise Identity Module (OAuth2 / JWT / RBAC)
Supports Google Workspace / Microsoft Entra ID SSO claims and role enforcement.
"""
from datetime import timedelta, datetime, timezone
from typing import List, Optional, Dict, Any
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

from ..config import settings

# JWT Secret & Algorithm
SECRET_KEY = getattr(settings, "JWT_SECRET_KEY", "OFL-ENTERPRISE-CREDIT-SECRET-KEY-2026-X99")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12  # 12 hours shift token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

class TokenPayload(BaseModel):
    sub: str
    email: str
    name: str
    role: str  # ANALYST, HRM, BCC, MD, TREASURY, IT_OWNER, BDO
    permissions: List[str] = []
    exp: Optional[int] = None

# Pre-provisioned Opticom enterprise staff directory
STAFF_DIRECTORY: Dict[str, Dict[str, Any]] = {
    "admin": {
        "id": "USR-OFL-000",
        "email": "admin@opticomfinance.com",
        "name": "Opticom System Administrator",
        "role": "ADMIN",
        "pin": "1988",
        "permissions": ["admin:config", "admin:users", "admin:audit", "*"]
    },
    "analyst": {
        "id": "USR-OFL-001",
        "email": "tunde.adebayo@opticomfinance.com",
        "name": "Babatunde Adebayo",
        "role": "ANALYST",
        "pin": "1988",
        "permissions": ["cam:create", "cam:edit", "case:read", "exception:raise", "statement:analyze"]
    },
    "hrm": {
        "id": "USR-OFL-002",
        "email": "chidinma.okafor@opticomfinance.com",
        "name": "Chidinma Okafor",
        "role": "HRM",
        "pin": "1988",
        "permissions": ["approval:recommend", "approval:risk_review", "exception:coordinate", "case:read"]
    },
    "bd": {
        "id": "USR-OFL-007",
        "email": "dapo.adeleke@opticomfinance.com",
        "name": "Dapo Adeleke (Head of Business Development)",
        "role": "HEAD_OF_BD",
        "pin": "1988",
        "permissions": ["approval:recommend", "bd:endorse", "fees:manage", "case:read"]
    },
    "bcc": {
        "id": "USR-OFL-003",
        "email": "emeka.nnamdi@opticomfinance.com",
        "name": "Emeka Nnamdi (BCC Chair)",
        "role": "BCC",
        "pin": "1988",
        "permissions": ["approval:approve_unlimited", "rejection:recommend", "case:read"]
    },
    "bcc_emeka": {
        "id": "USR-OFL-003",
        "email": "emeka.nnamdi@opticomfinance.com",
        "name": "Emeka Nnamdi (BCC Chair)",
        "role": "BCC",
        "pin": "1988",
        "permissions": ["approval:approve_unlimited", "rejection:recommend", "case:read"]
    },
    "bcc_aliyu": {
        "id": "USR-OFL-011",
        "email": "aliyu.dangote@opticomfinance.com",
        "name": "Alhaji Aliyu Dangote (BCC Member - Risk Trustee)",
        "role": "BCC",
        "pin": "1988",
        "permissions": ["approval:approve_unlimited", "rejection:recommend", "case:read"]
    },
    "bcc_zainab": {
        "id": "USR-OFL-012",
        "email": "zainab.ahmed@opticomfinance.com",
        "name": "Mrs. Zainab Ahmed (BCC Member - Legal Trustee)",
        "role": "BCC",
        "pin": "1988",
        "permissions": ["approval:approve_unlimited", "rejection:recommend", "case:read"]
    },
    "md": {
        "id": "USR-OFL-004",
        "email": "folashade.tinubu@opticomfinance.com",
        "name": "Folashade Tinubu (Managing Director)",
        "role": "MD",
        "pin": "1988",
        "permissions": ["admin:config", "admin:users", "admin:audit", "approval:approve_20m", "approval:approve_unlimited", "rejection:final", "disbursement:sanction", "fees:manage", "*"]
    },
    "treasury": {
        "id": "USR-OFL-005",
        "email": "ibrahim.musa@opticomfinance.com",
        "name": "Ibrahim Musa (Treasury Lead)",
        "role": "TREASURY",
        "pin": "1988",
        "permissions": ["treasury:nav_confirm", "treasury:loandisc_sync"]
    },
    "it_owner": {
        "id": "USR-OFL-006",
        "email": "devops@opticomfinance.com",
        "name": "DevOps / IT Integration Owner",
        "role": "IT_OWNER",
        "pin": "1988",
        "permissions": ["integration:retry", "exception:technical_restore", "telemetry:admin"]
    },
    "bdo": {
        "id": "USR-OFL-008",
        "email": "segun.adeleke@opticomfinance.com",
        "name": "Segun Adeleke (Business Dev Officer)",
        "role": "BDO",
        "pin": "1988",
        "permissions": ["intake:assisted", "case:read", "intake:originate"]
    },
    "operations": {
        "id": "USR-OFL-009",
        "email": "kemi.balogun@opticomfinance.com",
        "name": "Kemi Balogun (Credit Operations)",
        "role": "OPERATIONS",
        "pin": "1988",
        "permissions": ["offer:generate", "conditions:verify", "case:read"]
    },
    "auditor": {
        "id": "USR-OFL-010",
        "email": "farooq.mohammed@opticomfinance.com",
        "name": "Farooq Mohammed (Compliance Auditor)",
        "role": "AUDITOR",
        "pin": "1988",
        "permissions": ["audit:read", "audit:export", "case:read"]
    }
}

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Encodes claims into signed JWT Bearer token.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": int(expire.timestamp())})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> TokenPayload:
    """
    Validates and decodes JWT Bearer token.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenPayload(**payload)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token credentials.",
            headers={"WWW-Authenticate": "Bearer"}
        )

def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> TokenPayload:
    """
    Dependency that extracts authenticated caller.
    In production, strictly enforces authentication with 401 Unauthorized.
    In development/testing, falls back to mock analyst if no token is provided.
    """
    if not token:
        if settings.ENVIRONMENT.lower() == "production" or not settings.DEBUG:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required. Bearer token missing.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        # Development fallback allows seamless testing without locking out automated tests
        return TokenPayload(
            sub="USR-OFL-001",
            email="tunde.adebayo@opticom.ng",
            name="Babatunde Adebayo",
            role="ANALYST",
            permissions=["*"]
        )
    return decode_access_token(token)

def require_roles(allowed_roles: List[str]):
    """
    RBAC dependency factory checking role-level permission on sensitive credit actions.
    """
    def role_checker(current_user: TokenPayload = Depends(get_current_user)):
        if current_user.role not in allowed_roles and "*" not in current_user.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: User role '{current_user.role}' lacks authority. Required one of: {allowed_roles}"
            )
        return current_user
    return role_checker
