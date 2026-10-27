"""
Webhook Security & HMAC-SHA256 Signature Verification Module
Secures inbound webhooks from external channels (BESTO, Youverify, Partner Banks).
"""
import hmac
import hashlib
from typing import Optional
from fastapi import Header, HTTPException, Request, status
from ..config import settings

def compute_hmac_sha256(payload_bytes: bytes, secret: str) -> str:
    """
    Computes hexadecimal HMAC-SHA256 hash of payload bytes.
    """
    return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

def verify_hmac_signature(
    payload_bytes: bytes, 
    signature: Optional[str], 
    secret: Optional[str] = None
) -> bool:
    """
    Constant-time comparison of payload HMAC-SHA256 against received signature.
    """
    webhook_secret = secret or getattr(settings, "WEBHOOK_SECRET", "OPTICOM_DEFAULT_WEBHOOK_SECRET_2026")
    if not signature:
        # Require signature in production; allow bypass in dev if not set
        if getattr(settings, "ENVIRONMENT", "development") == "production":
            return False
        return True

    expected = compute_hmac_sha256(payload_bytes, webhook_secret)
    # Support 'sha256=' prefix if provided
    clean_signature = signature.replace("sha256=", "").strip()
    return hmac.compare_digest(clean_signature, expected)
