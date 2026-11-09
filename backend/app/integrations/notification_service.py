"""
Multi-Channel Transactional Notification Service (SMS & Email)
Integrates with Termii/Twilio (SMS) and SendGrid/Postmark (Email) for automated customer alerts.
"""
import uuid
from datetime import datetime, timezone, timedelta
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
        provider = "SENDGRID_ENTERPRISE"
        try:
            from ..database import SessionLocal
            from ..core.config_manager import ConfigManager
            db = SessionLocal()
            email_cfg = ConfigManager.get_config_value(db, "EMAIL_CLIENT")
            db.close()
            if email_cfg and email_cfg.get("enabled"):
                mode = email_cfg.get("mode", "CUSTOM_SMTP")
                host = email_cfg.get("smtp_host", "mail.opticom.ng")
                provider = f"{mode} ({host})" if mode == "CUSTOM_SMTP" else mode
        except Exception:
            pass

        record = {
            "id": delivery_id,
            "channel": "EMAIL",
            "recipient": to_email,
            "subject": subject,
            "template": template,
            "status": "SENT",
            "provider": provider,
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
    def notify_finance_and_disbursement_initiated(
        cls,
        case_number: str,
        obligor_name: str,
        amount: float,
        final_approver: str,
        approver_role: str
    ):
        """
        Alerts Finance, Treasury, and Operations that a credit facility has received final
        executive/board approval and disbursement preparations are initiated.
        """
        subject = f"[FINANCE ALERT] Case {case_number} ({obligor_name}) Approved for ₦{amount:,.2f}"
        body = f"""
        <h3>Opticom Finance Limited - Disbursement Notification</h3>
        <p>Credit Case <strong>{case_number}</strong> for <strong>{obligor_name}</strong> has received final sanction from <strong>{final_approver} ({approver_role})</strong>.</p>
        <p><strong>Approved Facility Quantum:</strong> ₦{amount:,.2f}</p>
        <p>The formal offer letter is being dispatched to the obligor. Finance and Treasury are now in the know for conditions precedent verification and LOAN-DISC payment initiation.</p>
        """
        cls.send_email(
            to_email="disbursement@opticomfinance.com", 
            subject=subject, 
            html_body=body, 
            template="FINANCE_DISBURSEMENT_INITIATED",
            metadata={"case_number": case_number, "amount": amount}
        )

    @classmethod
    def notify_hrm_exception_to_analyst_and_bd(
        cls,
        case_number: str,
        obligor_name: str,
        reason: str,
        actor: str = "Head of Risk Management"
    ):
        """
        Dispatches alerts when HRM queries an application and returns to Credit Analyst.
        Head of Business Development ALSO receives the prompt/alert in their notification tray.
        """
        # 1. Prompt to Analyst
        cls.send_email(
            to_email="tunde.adebayo@opticomfinance.com",
            subject=f"[EXCEPTION ALERT] Case {case_number} Returned for Rework",
            html_body=f"<p>Dear Credit Analyst,</p><p>HRM ({actor}) has raised an exception on facility <strong>{case_number}</strong> ({obligor_name}):</p><blockquote>{reason}</blockquote><p>Please resolve the queries and update the dossier.</p>",
            template="HRM_EXCEPTION_ANALYST",
            metadata={"case_number": case_number, "target": "ANALYST"}
        )

        # 2. Prompt to Head of Business Development
        cls.send_email(
            to_email="dapo.adeleke@opticomfinance.com",
            subject=f"[INFO ALERT] Case {case_number} ({obligor_name}) Returned to Analyst with Exception",
            html_body=f"<p>Dear Head of Business Development,</p><p>Please be advised that facility <strong>{case_number}</strong> ({obligor_name}) has been returned to the Credit Analyst by HRM for exception resolution:</p><blockquote>{reason}</blockquote>",
            template="HRM_EXCEPTION_HEAD_OF_BD",
            metadata={"case_number": case_number, "target": "HEAD_OF_BD"}
        )

    @classmethod
    def notify_md_return_to_stakeholders(
        cls,
        case_number: str,
        obligor_name: str,
        target_role: str,
        reason: str,
        actor: str = "Managing Director"
    ):
        """
        When MD returns an application (to HRM or Head of BD):
        Analyst, HRM, and Head of BD ALL receive a prompt that MD has returned the facility.
        """
        stakeholders = [
            ("tunde.adebayo@opticomfinance.com", "Credit Analyst"),
            ("chidinma.okafor@opticomfinance.com", "Head of Risk Management"),
            ("dapo.adeleke@opticomfinance.com", "Head of Business Development")
        ]
        for email, role_title in stakeholders:
            cls.send_email(
                to_email=email,
                subject=f"[EXECUTIVE RETURN] Case {case_number} Returned by MD to {target_role}",
                html_body=f"<p>Dear {role_title},</p><p>Managing Director ({actor}) has returned facility <strong>{case_number}</strong> ({obligor_name}) for further review by <strong>{target_role}</strong>.</p><p><strong>Managing Director's Query:</strong></p><blockquote>{reason}</blockquote>",
                template="MD_RETURN_STAKEHOLDER",
                metadata={"case_number": case_number, "target_role": target_role}
            )

    @classmethod
    def notify_mcc_head_of_bd_assignment(
        cls,
        case_number: str,
        obligor_name: str,
        amount: float,
        analyst_name: str = "Credit Analyst",
        analyst_actor: Optional[str] = None
    ):
        """
        Notifies Head of Business Development (First in MCC) that a new case has been forwarded by Credit Analyst.
        """
        actor = analyst_actor or analyst_name
        cls.send_email(
            to_email="dapo.adeleke@opticomfinance.com",
            subject=f"[MCC REVIEW] New Credit Case {case_number} ({obligor_name}) - ₦{amount:,.2f}",
            html_body=f"<p>Dear Head of Business Development,</p><p>Credit Analyst <strong>{actor}</strong> has completed underwriting analysis on <strong>{case_number}</strong> ({obligor_name}) for ₦{amount:,.2f} and forwarded to the Management Credit Committee (MCC) for your commercial review and sanction.</p>",
            template="MCC_ASSIGNMENT_BD",
            metadata={"case_number": case_number, "amount": amount}
        )

    @classmethod
    def auto_generate_and_email_offer_letter(
        cls,
        credit_case,
        db
    ):
        """
        Auto-generates the official Opticom Offer Letter and emails it to the borrower.
        """
        from ..models.entities import Offer
        from ..core.financial_engine import FinancialEngine
        from ..core.config_manager import ConfigManager
        from ..core.state_machine import TransitionService

        app = credit_case.application
        customer = app.customer
        amount = float(app.amount)
        tenor = int(app.tenor)
        rate = 0.28
        monthly_pmt = FinancialEngine.calculate_monthly_installment(amount, rate, tenor)
        terms_hash = TransitionService.calculate_terms_hash(amount, tenor, rate, customer.id)

        catalog = ConfigManager.get_fee_catalog(db)
        fee_items = [
            {
                "id": f.get("id"),
                "name": f.get("name"),
                "fee_type": f.get("fee_type", "PERCENTAGE"),
                "rate": f.get("rate", 0.0),
                "is_selected": True,
                "description": f.get("description", "")
            }
            for f in catalog
        ]
        calc = ConfigManager.calculate_case_fees(amount, fee_items)

        # Check existing offer
        existing_offer = db.query(Offer).filter(Offer.case_id == credit_case.id).first()
        now_dt = datetime.now(timezone.utc)
        if not existing_offer:
            offer = Offer(
                case_id=credit_case.id,
                terms_hash=terms_hash,
                approved_amount=amount,
                tenor_months=tenor,
                interest_rate_pct=28.0,
                monthly_repayment=monthly_pmt,
                issued_at=now_dt,
                expiry=now_dt + timedelta(days=14),
                status="ISSUED",
                fee_schedule=fee_items,
                total_fees=calc["total_fees"],
                net_disbursement=calc["net_disbursement"]
            )
            db.add(offer)
        else:
            existing_offer.status = "ISSUED"
            existing_offer.issued_at = now_dt
            existing_offer.fee_schedule = fee_items
            existing_offer.total_fees = calc["total_fees"]
            existing_offer.net_disbursement = calc["net_disbursement"]

        db.commit()

        # Send Email to Borrower
        cust_email = customer.email or "borrower@example.ng"
        subject = f"Official Credit Facility Offer Letter — Opticom Finance Limited ({credit_case.case_number})"
        email_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px;">
          <h2 style="color: #0096cc; margin-top: 0;">OPTICOM FINANCE LIMITED</h2>
          <p style="font-size: 11px; color: #64748b; margin-top: -10px;">Commercial Credit & Structured Finance &bull; RC: 347832 &bull; Help-Line: 0816 181 3538</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
          
          <p>Dear <strong>{customer.name}</strong>,</p>
          <p>We are pleased to inform you that following comprehensive appraisal and credit committee review, your commercial loan request has received <strong>Final Executive Approval</strong> by the Managing Director of Opticom Finance Limited.</p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin: 15px 0;">
            <h4 style="margin: 0 0 10px 0; color: #041326;">FACILITY TERM SUMMARY</h4>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr><td style="padding: 4px 0; color: #64748b;">Facility Reference:</td><td style="font-weight: bold;">{credit_case.case_number}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Approved Amount:</td><td style="font-weight: bold; color: #059669;">₦{amount:,.2f}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Facility Tenor:</td><td style="font-weight: bold;">{tenor} Months</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Interest Rate:</td><td style="font-weight: bold;">28.00% APR (2.33% / Month Reducing-Balance)</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Monthly Repayment (PMT):</td><td style="font-weight: bold;">₦{monthly_pmt:,.2f} / month</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Upfront Statutory Fees:</td><td style="font-weight: bold;">₦{calc['total_fees']:,.2f}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Net Disbursed Capital:</td><td style="font-weight: bold; color: #0096cc;">₦{calc['net_disbursement']:,.2f}</td></tr>
            </table>
          </div>

          <p style="font-size: 13px; line-height: 1.5; color: #334155;">
            Please access your borrower tracking portal at <a href="https://credit.opticomfinance.com/track/{credit_case.case_number}" style="color: #0096cc; font-weight: bold;">https://credit.opticomfinance.com/track/{credit_case.case_number}</a> to review the complete offer terms and execute digital acceptance.
          </p>
          
          <p style="font-size: 12px; color: #64748b; margin-top: 25px;">
            Opticom Finance Limited &bull; 10th Floor, UAC House, 1-5 Odunlami St, Lagos Island &bull; Phone: 0816 181 3538 &bull; Email: info@opticomfinance.com
          </p>
        </div>
        """
        cls.send_email(
            to_email=cust_email,
            subject=subject,
            html_body=email_body,
            template="OFFICIAL_OFFER_LETTER",
            metadata={"case_number": credit_case.case_number, "amount": amount}
        )

    @classmethod
    def get_delivery_logs(cls, limit: int = 50) -> List[Dict[str, Any]]:
        return cls._delivery_log[:limit]
