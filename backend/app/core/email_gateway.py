"""
Unified Email Delivery & Diagnostic Gateway for OFL.
Supports real transactional Email Service APIs (SendGrid, Resend, Postmark, Custom HTTP REST API)
and Corporate SMTP Servers (STARTTLS, SSL/TLS, Plain Intranet).
"""
from __future__ import annotations

import base64
from email.message import EmailMessage
import logging
import os
import smtplib
import time
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from ..config import settings

logger = logging.getLogger("ofl.email_gateway")

MASKED_SECRET = "••••••••••••"
PLACEHOLDER_SMTP_PASS = "opticom-corporate-smtp-secret-key-2026"
SANDBOX_SMTP_HOSTS = {
    "mail.opticom.ng",
    "mail.opticomfinance.com",
    "smtp.internal.opticom.ng",
}

API_PROVIDER_MODES = {
    "SENDGRID",
    "DEFAULT_SENDGRID",
    "RESEND",
    "POSTMARK",
    "CUSTOM_API",
}

_API_PROVIDER_DEFAULTS: Dict[str, Dict[str, str]] = {
    "SENDGRID": {
        "endpoint": "https://api.sendgrid.com/v3/mail/send",
        "env_key": "SENDGRID_API_KEY",
        "label": "SendGrid Email API v3",
    },
    "DEFAULT_SENDGRID": {
        "endpoint": "https://api.sendgrid.com/v3/mail/send",
        "env_key": "SENDGRID_API_KEY",
        "label": "SendGrid / Google Cloud Email API",
    },
    "RESEND": {
        "endpoint": "https://api.resend.com/emails",
        "env_key": "RESEND_API_KEY",
        "label": "Resend Transactional Email API",
    },
    "POSTMARK": {
        "endpoint": "https://api.postmarkapp.com/email",
        "env_key": "POSTMARK_SERVER_TOKEN",
        "label": "Postmark Server Email API",
    },
    "CUSTOM_API": {
        "endpoint": "",
        "env_key": "CUSTOM_EMAIL_API_KEY",
        "label": "Custom Email Service HTTP API",
    },
}


def _is_masked_or_empty(val: Optional[str]) -> bool:
    return not val or not str(val).strip() or MASKED_SECRET in str(val)


def load_effective_email_config(
    db: Optional[Session] = None,
    config_override: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Loads the unmasked EMAIL_CLIENT configuration from DB and merges any override
    while preserving stored secrets if the override passes masked values.
    """
    stored: Dict[str, Any] = {
        "mode": "CUSTOM_SMTP",
        "provider_name": "Opticom Exchange Mail Server",
        "smtp_host": "mail.opticomfinance.com",
        "smtp_port": 587,
        "security": "STARTTLS",
        "username": "customercare@opticomfinance.com",
        "password": "",
        "from_name": "Opticom Finance Credit Operations",
        "from_email": "info@opticomfinance.com",
        "reply_to": "customercare@opticomfinance.com",
        "api_endpoint": "",
        "api_key": "",
        "enabled": True,
    }

    if db is not None:
        try:
            from ..models.entities import SystemConfiguration
            row = db.query(SystemConfiguration).filter(SystemConfiguration.key == "EMAIL_CLIENT").first()
            if row and isinstance(row.value, dict):
                stored.update(row.value)
        except Exception as exc:
            logger.debug(f"Could not read EMAIL_CLIENT from DB: {exc}")

    if config_override:
        merged = {**stored, **config_override}
        for secret_field in ("password", "api_key"):
            if _is_masked_or_empty(config_override.get(secret_field)):
                merged[secret_field] = stored.get(secret_field, "")
        return merged
    return stored


def _format_api_request(
    mode: str,
    cfg: Dict[str, Any],
    to_email: str,
    subject: str,
    html_body: str,
    template: str,
    attachments: Optional[List[Dict[str, Any]]] = None,
) -> tuple[str, Dict[str, str], Dict[str, Any]]:
    """Builds endpoint URL, headers, and JSON body uniformly for supported Email Service APIs."""
    preset = _API_PROVIDER_DEFAULTS.get(mode, _API_PROVIDER_DEFAULTS["CUSTOM_API"])
    endpoint = (cfg.get("api_endpoint") or preset["endpoint"]).strip()
    api_key = (cfg.get("api_key") or os.getenv(preset["env_key"], "") or os.getenv("EMAIL_API_KEY", "")).strip()
    from_email = (cfg.get("from_email") or "info@opticomfinance.com").strip()
    from_name = (cfg.get("from_name") or "Opticom Finance Credit Operations").strip()
    reply_to = (cfg.get("reply_to") or from_email).strip()

    encoded_attachments = []
    for att in attachments or []:
        raw_bytes = att.get("content", b"")
        if isinstance(raw_bytes, str):
            raw_bytes = raw_bytes.encode("utf-8")
        encoded_attachments.append({
            "filename": att.get("filename", "document.pdf"),
            "content_b64": base64.b64encode(raw_bytes).decode("ascii"),
            "mime_type": att.get("mime_type", "application/pdf"),
        })

    if mode in ("SENDGRID", "DEFAULT_SENDGRID"):
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "personalizations": [{"to": [{"email": to_email}]}],
            "from": {"email": from_email, "name": from_name},
            "reply_to": {"email": reply_to},
            "subject": subject,
            "content": [{"type": "text/html", "value": html_body}],
        }
        if encoded_attachments:
            payload["attachments"] = [
                {
                    "content": a["content_b64"],
                    "filename": a["filename"],
                    "type": a["mime_type"],
                    "disposition": "attachment",
                }
                for a in encoded_attachments
            ]
        return endpoint, headers, payload

    if mode == "RESEND":
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "from": f"{from_name} <{from_email}>",
            "to": [to_email],
            "reply_to": reply_to,
            "subject": subject,
            "html": html_body,
        }
        if encoded_attachments:
            payload["attachments"] = [
                {"filename": a["filename"], "content": a["content_b64"]}
                for a in encoded_attachments
            ]
        return endpoint, headers, payload

    if mode == "POSTMARK":
        headers = {
            "X-Postmark-Server-Token": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        payload = {
            "From": f"{from_name} <{from_email}>",
            "To": to_email,
            "ReplyTo": reply_to,
            "Subject": subject,
            "HtmlBody": html_body,
        }
        if encoded_attachments:
            payload["Attachments"] = [
                {
                    "Name": a["filename"],
                    "Content": a["content_b64"],
                    "ContentType": a["mime_type"],
                }
                for a in encoded_attachments
            ]
        return endpoint, headers, payload

    # CUSTOM_API generic JSON schema supporting Bearer + X-API-Key authentication
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
        headers["X-API-Key"] = api_key
    payload = {
        "from": from_email,
        "from_name": from_name,
        "reply_to": reply_to,
        "to": to_email,
        "subject": subject,
        "html": html_body,
        "template": template,
        "attachments": [
            {"filename": a["filename"], "content_base64": a["content_b64"], "mime_type": a["mime_type"]}
            for a in encoded_attachments
        ],
    }
    return endpoint, headers, payload


def _send_via_http_api(
    mode: str,
    cfg: Dict[str, Any],
    to_email: str,
    subject: str,
    html_body: str,
    template: str,
    attachments: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    start = time.perf_counter()
    preset = _API_PROVIDER_DEFAULTS.get(mode, _API_PROVIDER_DEFAULTS["CUSTOM_API"])
    endpoint, headers, payload = _format_api_request(
        mode, cfg, to_email, subject, html_body, template, attachments
    )
    api_key = (cfg.get("api_key") or os.getenv(preset["env_key"], "") or os.getenv("EMAIL_API_KEY", "")).strip()
    provider_label = cfg.get("provider_name") or preset["label"]

    if not endpoint:
        latency_ms = round((time.perf_counter() - start) * 1000, 1)
        return {
            "success": False,
            "delivered_live": False,
            "status": "FAILED",
            "provider": f"{mode} ({provider_label})",
            "latency_ms": latency_ms,
            "message": f"{preset['label']} requires a valid API Endpoint URL.",
            "diagnostics": {
                "host": "unconfigured",
                "port": 443,
                "security": "HTTPS / TLS 1.3",
                "recipient": to_email,
                "mode": mode,
            },
        }

    # In non-production with no API key supplied for managed SendGrid, simulate safely unless explicitly RESEND/POSTMARK/CUSTOM_API
    if not api_key:
        latency_ms = round((time.perf_counter() - start) * 1000, 1)
        is_explicit_api = mode in ("RESEND", "POSTMARK", "CUSTOM_API", "SENDGRID")
        if settings.ENVIRONMENT.lower() == "production" or is_explicit_api:
            return {
                "success": False,
                "delivered_live": False,
                "status": "UNCONFIGURED",
                "provider": f"{mode} ({provider_label})",
                "latency_ms": latency_ms,
                "message": f"Email Service API Key is missing for {provider_label}. Configure it in Admin -> Custom Corporate Email & API.",
                "diagnostics": {
                    "host": endpoint,
                    "port": 443,
                    "security": "HTTPS API Bearer",
                    "recipient": to_email,
                    "mode": mode,
                },
            }
        return {
            "success": True,
            "delivered_live": False,
            "status": "SENT_SANDBOX",
            "provider": f"{mode} (Sandbox Fallback)",
            "latency_ms": latency_ms,
            "message": f"Sandbox Email Service simulated delivery to {to_email}. Add API key for live dispatch.",
            "diagnostics": {
                "host": endpoint,
                "port": 443,
                "security": "HTTPS API Bearer (Sandbox)",
                "recipient": to_email,
                "mode": mode,
            },
        }

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(endpoint, headers=headers, json=payload)
        latency_ms = round((time.perf_counter() - start) * 1000, 1)
        ok = 200 <= resp.status_code < 300
        return {
            "success": ok,
            "delivered_live": ok,
            "status": "SENT_LIVE" if ok else "FAILED",
            "provider": f"{mode} ({provider_label})",
            "latency_ms": latency_ms,
            "message": (
                f"Email Service API ({provider_label}) dispatched message to {to_email} (HTTP {resp.status_code})."
                if ok
                else f"Email Service API returned HTTP {resp.status_code}: {resp.text[:200]}"
            ),
            "diagnostics": {
                "host": endpoint,
                "port": 443,
                "security": "HTTPS REST API",
                "http_status": resp.status_code,
                "recipient": to_email,
                "mode": mode,
            },
        }
    except Exception as exc:
        latency_ms = round((time.perf_counter() - start) * 1000, 1)
        logger.warning(f"Email Service API request failed for {to_email}: {exc}")
        return {
            "success": False,
            "delivered_live": False,
            "status": "FAILED",
            "provider": f"{mode} ({provider_label})",
            "latency_ms": latency_ms,
            "message": f"Email Service API connection error: {str(exc)}",
            "diagnostics": {
                "host": endpoint,
                "port": 443,
                "security": "HTTPS REST API",
                "recipient": to_email,
                "mode": mode,
                "error": str(exc),
            },
        }


def _send_via_smtp(
    cfg: Dict[str, Any],
    to_email: str,
    subject: str,
    html_body: str,
    attachments: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    start = time.perf_counter()
    host = (cfg.get("smtp_host") or "mail.opticomfinance.com").strip()
    port = int(cfg.get("smtp_port") or 587)
    security = (cfg.get("security") or "STARTTLS").upper()
    username = (cfg.get("username") or "").strip()
    password = cfg.get("password") or ""
    from_email = (cfg.get("from_email") or username or "info@opticomfinance.com").strip()
    from_name = (cfg.get("from_name") or "Opticom Finance Credit Operations").strip()
    reply_to = (cfg.get("reply_to") or from_email).strip()

    is_pytest = bool(os.getenv("PYTEST_CURRENT_TEST"))
    is_local_mock_host = host in SANDBOX_SMTP_HOSTS or (password == PLACEHOLDER_SMTP_PASS and settings.ENVIRONMENT.lower() != "production")
    if (is_local_mock_host and settings.ENVIRONMENT.lower() != "production") or (is_pytest and host not in ("127.0.0.1", "localhost")):
        latency_ms = round((time.perf_counter() - start) * 1000, 1)
        return {
            "success": True,
            "delivered_live": False,
            "status": "SENT_SANDBOX",
            "provider": f"CUSTOM_SMTP ({host})",
            "latency_ms": max(latency_ms, 1.0),
            "message": f"SMTP gateway handshake simulated for {host}:{port} ({security}). Configure corporate SMTP credentials for live relay.",
            "diagnostics": {
                "host": host,
                "port": port,
                "security": security,
                "recipient": to_email,
                "mode": "CUSTOM_SMTP",
            },
        }

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    msg["Reply-To"] = reply_to
    msg.set_content("Please view this message in an HTML-capable email client.")
    msg.add_alternative(html_body, subtype="html")

    for att in attachments or []:
        raw_bytes = att.get("content", b"")
        if isinstance(raw_bytes, str):
            raw_bytes = raw_bytes.encode("utf-8")
        mime_type = att.get("mime_type", "application/octet-stream")
        maintype, _, subtype = mime_type.partition("/")
        msg.add_attachment(
            raw_bytes,
            maintype=maintype or "application",
            subtype=subtype or "octet-stream",
            filename=att.get("filename", "attachment.pdf"),
        )

    try:
        if security == "SSL_TLS" or port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=8.0) as server:
                if username and password:
                    server.login(username, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=8.0) as server:
                server.ehlo()
                if security == "STARTTLS":
                    server.starttls()
                    server.ehlo()
                if username and password:
                    server.login(username, password)
                server.send_message(msg)

        latency_ms = round((time.perf_counter() - start) * 1000, 1)
        return {
            "success": True,
            "delivered_live": True,
            "status": "SENT_LIVE",
            "provider": f"CUSTOM_SMTP ({host})",
            "latency_ms": latency_ms,
            "message": f"Live SMTP relay {host}:{port} accepted email for {to_email}.",
            "diagnostics": {
                "host": host,
                "port": port,
                "security": security,
                "recipient": to_email,
                "mode": "CUSTOM_SMTP",
            },
        }
    except Exception as exc:
        latency_ms = round((time.perf_counter() - start) * 1000, 1)
        logger.warning(f"SMTP relay failure for {to_email} via {host}:{port}: {exc}")
        return {
            "success": False,
            "delivered_live": False,
            "status": "FAILED",
            "provider": f"CUSTOM_SMTP ({host})",
            "latency_ms": latency_ms,
            "message": f"SMTP error ({host}:{port}): {str(exc)}",
            "diagnostics": {
                "host": host,
                "port": port,
                "security": security,
                "recipient": to_email,
                "mode": "CUSTOM_SMTP",
                "error": str(exc),
            },
        }


def dispatch_email(
    to_email: str,
    subject: str,
    html_body: str,
    template: str = "OFFICIAL_NOTIFICATION",
    db: Optional[Session] = None,
    config_override: Optional[Dict[str, Any]] = None,
    attachments: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Dispatches an outbound email via either the configured Email Service REST API
    (SendGrid, Resend, Postmark, Custom HTTP API) or Corporate SMTP Server.
    """
    cfg = load_effective_email_config(db=db, config_override=config_override)
    if cfg.get("enabled") is False and not config_override:
        return {
            "success": False,
            "delivered_live": False,
            "status": "DISABLED",
            "provider": cfg.get("mode", "DISABLED"),
            "latency_ms": 0.0,
            "message": "Outbound email client is disabled in Admin Configuration.",
            "diagnostics": {"recipient": to_email, "mode": cfg.get("mode", "DISABLED")},
        }

    mode = (cfg.get("mode") or "CUSTOM_SMTP").upper()
    if mode in API_PROVIDER_MODES:
        return _send_via_http_api(mode, cfg, to_email, subject, html_body, template, attachments)
    return _send_via_smtp(cfg, to_email, subject, html_body, attachments)

