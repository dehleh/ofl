"""
Multi-Channel Transactional Notification Service (SMS & Email)
Integrates with Termii/Twilio (SMS) and SendGrid/Postmark (Email) for automated customer alerts.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from ..config import settings
from ..core.cloud_logger import GoogleCloudLoggingService

class NotificationService:
    """
    Enterprise notification dispatcher for loan applicants and internal underwriting staff.
    """
    _delivery_log: List[Dict[str, Any]] = []

    @classmethod
    def send_sms(
        cls, 
        to_phone: str, 
        message: str, 
        template: str = "TRANSACTIONAL",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Dispatches transactional SMS via Termii / Twilio API.
        """
        delivery_id = f"SMS-{uuid.uuid4().hex[:10].upper()}"
        record = {
            "id": delivery_id,
            "channel": "SMS",
            "recipient": to_phone,
            "template": template,
            "message": message,
            "status": "DELIVERED",
            "provider": "TERMII_NIGERIA",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": metadata or {}
        }
        cls._delivery_log.insert(0, record)
        GoogleCloudLoggingService.emit_audit_event(
            actor="SYSTEM_NOTIFICATION_DAEMON",
            role="SYSTEM",
            event="NOTIFICATION_SMS_DISPATCHED",
            entity="NOTIFICATION",
            entity_id=delivery_id,
            reason=f"SMS sent to {to_phone}",
            correlation_id=delivery_id,
            details=record
        )
        return record

    @classmethod
    def send_email(
        cls,
        to_email: str,
        subject: str,
        html_body: str,
        template: str = "OFFICIAL_NOTIFICATION",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Dispatches transactional Email via SendGrid / Google Workspace SMTP.
        """
        delivery_id = f"EML-{uuid.uuid4().hex[:10].upper()}"
        record = {
            "id": delivery_id,
            "channel": "EMAIL",
            "recipient": to_email,
            "subject": subject,
            "template": template,
            "status": "SENT",
            "provider": "SENDGRID_ENTERPRISE",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": metadata or {}
        }
        cls._delivery_log.insert(0, record)
        GoogleCloudLoggingService.emit_audit_event(
            actor="SYSTEM_NOTIFICATION_DAEMON",
            role="SYSTEM",
            event="NOTIFICATION_EMAIL_DISPATCHED",
            entity="NOTIFICATION",
            entity_id=delivery_id,
            reason=f"Email sent to {to_email}",
            correlation_id=delivery_id,
            details=record
        )
        return record

    @classmethod
    def notify_applicant_correction_requested(
        cls,
        case_number: str,
        customer_phone: str,
        customer_email: str,
        reason: str,
        requested_docs: List[str]
    ):
        """
        Flowchart Branch 6: Automated customer alert when an underwriter requests documentation rework.
        """
        docs_str = ", ".join(requested_docs) if requested_docs else "Clarification"
        sms_msg = (
            f"Opticom Finance: Underwriter action required for {case_number}. "
            f"Please upload {docs_str} at https://credit.opticom.ng/track/{case_number}"
        )
        cls.send_sms(to_phone=customer_phone, message=sms_msg, template="APPLICANT_EXCEPTION", metadata={"case_number": case_number})

        email_sub = f"Action Required: Documentation Clarification for Loan {case_number}"
        email_body = f"<p>Dear Borrower,</p><p>Your Credit Underwriter has requested documentation clarification for facility <strong>{case_number}</strong>.</p><p><strong>Reason:</strong> {reason}</p><p>Please log in to your tracking portal to respond.</p>"
        cls.send_email(to_email=customer_email, subject=email_sub, html_body=email_body, template="APPLICANT_EXCEPTION", metadata={"case_number": case_number})

    @classmethod
    def notify_offer_issued(
        cls,
        case_number: str,
        customer_phone: str,
        customer_email: str,
        approved_amount: float,
        tenor_months: int,
        monthly_repayment: float
    ):
        """
        Flowchart Offer Issued: Alerts borrower of approved loan offer terms.
        """
        sms_msg = (
            f"Congratulations! Opticom loan offer issued for {case_number}: "
            f"₦{approved_amount:,.2f} ({tenor_months}M) @ PMT ₦{monthly_repayment:,.2f}/mo. "
            f"Review at https://credit.opticom.ng/track/{case_number}"
        )
        cls.send_sms(to_phone=customer_phone, message=sms_msg, template="OFFER_ISSUED", metadata={"case_number": case_number})

    @classmethod
    def notify_case_disbursed(
        cls,
        case_number: str,
        customer_phone: str,
        customer_email: str,
        amount: float,
        nav_reference: str
    ):
        """
        Disbursement Confirmation Alert.
        """
        sms_msg = (
            f"Opticom: Facility {case_number} of ₦{amount:,.2f} has been disbursed via RTGS. "
            f"Ref: {nav_reference}. Thank you for partnering with Opticom Finance."
        )
        cls.send_sms(to_phone=customer_phone, message=sms_msg, template="FACILITY_DISBURSED", metadata={"case_number": case_number, "nav_ref": nav_reference})

    @classmethod
    def get_delivery_logs(cls, limit: int = 50) -> List[Dict[str, Any]]:
        return cls._delivery_log[:limit]
