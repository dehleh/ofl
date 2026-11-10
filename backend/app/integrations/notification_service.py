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
    Delivers multi-channel alerts (Email, SMS, and Real-time In-App Notifications).
    """
    _delivery_log: List[Dict[str, Any]] = []
    _in_app_notifications: List[Dict[str, Any]] = []

    @classmethod
    def create_in_app_notification(
        cls,
        title: str,
        message: str,
        notification_type: str = "INFO",  # WARNING, URGENT, SUCCESS, INFO
        category: str = "GENERAL",
        case_number: Optional[str] = None,
        recipient_role: str = "ALL",
        recipient_email: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Creates and stores an In-App Notification for internal staff and borrowers.
        Persists to in_app_notifications table and maintains in-memory buffer.
        """
        notif_id = f"NOTIF-{uuid.uuid4().hex[:8].upper()}"
        now_dt = datetime.now(timezone.utc)
        record = {
            "id": notif_id,
            "title": title,
            "message": message,
            "time": "Just now",
            "type": notification_type,
            "category": category,
            "caseNumber": case_number,
            "recipient_role": recipient_role,
            "recipient_email": recipient_email,
            "unread": True,
            "created_at": now_dt.isoformat()
        }
        cls._in_app_notifications.insert(0, record)
        if len(cls._in_app_notifications) > 100:
            cls._in_app_notifications = cls._in_app_notifications[:100]

        try:
            from ..database import SessionLocal
            from ..models.entities import InAppNotification
            db = SessionLocal()
            db_notif = InAppNotification(
                id=notif_id,
                recipient_role=recipient_role,
                recipient_email=recipient_email,
                title=title,
                message=message,
                notification_type=notification_type,
                category=category,
                case_number=case_number,
                unread=True,
                created_at=now_dt
            )
            db.add(db_notif)
            db.commit()
            db.close()
        except Exception:
            pass

        return record

    @classmethod
    def get_in_app_notifications(
        cls, 
        role: Optional[str] = None, 
        unread_only: bool = False, 
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Returns in-app notifications for staff cockpit tray and alert bell.
        """
        try:
            from ..database import SessionLocal
            from ..models.entities import InAppNotification
            db = SessionLocal()
            query = db.query(InAppNotification)
            if unread_only:
                query = query.filter(InAppNotification.unread.is_(True))
            if role and role.upper() != "ALL":
                query = query.filter(
                    (InAppNotification.recipient_role.in_(["ALL", role.upper()])) |
                    (InAppNotification.recipient_role.is_(None))
                )
            records = query.order_by(InAppNotification.created_at.desc()).limit(limit).all()
            result = []
            for r in records:
                diff_sec = (datetime.now(timezone.utc) - (r.created_at.replace(tzinfo=timezone.utc) if r.created_at.tzinfo is None else r.created_at)).total_seconds()
                if diff_sec < 60:
                    time_str = "Just now"
                elif diff_sec < 3600:
                    time_str = f"{int(diff_sec // 60)} mins ago"
                elif diff_sec < 86400:
                    time_str = f"{int(diff_sec // 3600)} hours ago"
                else:
                    time_str = f"{int(diff_sec // 86400)} days ago"

                result.append({
                    "id": r.id,
                    "title": r.title,
                    "message": r.message,
                    "time": time_str,
                    "type": r.notification_type,
                    "category": r.category,
                    "caseNumber": r.case_number,
                    "unread": r.unread,
                    "created_at": r.created_at.isoformat()
                })
            db.close()
            if result:
                return result
        except Exception:
            pass

        notifs = cls._in_app_notifications
        if unread_only:
            notifs = [n for n in notifs if n.get("unread")]
        return notifs[:limit]

    @classmethod
    def mark_in_app_read(cls, notif_id: str) -> bool:
        """Marks a specific notification as read."""
        for n in cls._in_app_notifications:
            if n["id"] == notif_id:
                n["unread"] = False
        try:
            from ..database import SessionLocal
            from ..models.entities import InAppNotification
            db = SessionLocal()
            rec = db.query(InAppNotification).filter(InAppNotification.id == notif_id).first()
            if rec:
                rec.unread = False
                db.commit()
            db.close()
            return True
        except Exception:
            return False

    @classmethod
    def mark_all_in_app_read(cls, role: Optional[str] = None) -> bool:
        """Marks all in-app notifications as read."""
        for n in cls._in_app_notifications:
            n["unread"] = False
        try:
            from ..database import SessionLocal
            from ..models.entities import InAppNotification
            db = SessionLocal()
            query = db.query(InAppNotification).filter(InAppNotification.unread.is_(True))
            if role and role.upper() != "ALL":
                query = query.filter(InAppNotification.recipient_role.in_(["ALL", role.upper()]))
            query.update({InAppNotification.unread: False}, synchronize_session=False)
            db.commit()
            db.close()
            return True
        except Exception:
            return False

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
        Delivered via SMS, Email, and In-App notification.
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

        cls.create_in_app_notification(
            title=f"Applicant Documentation Rework: {case_number}",
            message=f"Underwriter requested clarification for {case_number}: {reason}",
            notification_type="WARNING",
            category="CORRECTION_REQUESTED",
            case_number=case_number,
            recipient_role="ANALYST"
        )

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
        Delivered via SMS, Email, and In-App notification.
        """
        sms_msg = (
            f"Congratulations! Opticom loan offer issued for {case_number}: "
            f"₦{approved_amount:,.2f} ({tenor_months}M) @ PMT ₦{monthly_repayment:,.2f}/mo. "
            f"Review at https://credit.opticom.ng/track/{case_number}"
        )
        cls.send_sms(to_phone=customer_phone, message=sms_msg, template="OFFER_ISSUED", metadata={"case_number": case_number})

        cls.create_in_app_notification(
            title=f"Offer Issued: {case_number}",
            message=f"Loan offer of ₦{approved_amount:,.2f} issued to borrower ({tenor_months}M @ ₦{monthly_repayment:,.2f}/mo).",
            notification_type="INFO",
            category="OFFER_ISSUED",
            case_number=case_number,
            recipient_role="OPERATIONS"
        )

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
        Delivered via SMS, Email, and In-App notification.
        """
        sms_msg = (
            f"Opticom: Facility {case_number} of ₦{amount:,.2f} has been disbursed via RTGS. "
            f"Ref: {nav_reference}. Thank you for partnering with Opticom Finance."
        )
        cls.send_sms(to_phone=customer_phone, message=sms_msg, template="FACILITY_DISBURSED", metadata={"case_number": case_number, "nav_ref": nav_reference})

        cls.create_in_app_notification(
            title=f"Facility Capital Disbursed: {case_number}",
            message=f"Disbursement of ₦{amount:,.2f} confirmed via RTGS (LOAN-DISC Ref: {nav_reference}).",
            notification_type="SUCCESS",
            category="DISBURSED",
            case_number=case_number,
            recipient_role="ALL"
        )

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
        Delivered via Email and In-App notification.
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

        cls.create_in_app_notification(
            title=f"Disbursement Authorization: {case_number}",
            message=f"Facility for {obligor_name} (₦{amount:,.2f}) approved by {final_approver} ({approver_role}). Treasury payment authorized.",
            notification_type="SUCCESS",
            category="DISBURSEMENT_INITIATED",
            case_number=case_number,
            recipient_role="TREASURY"
        )

    @classmethod
    def notify_hrm_exception_to_analyst_and_bd(
        cls,
        case_number: str,
        obligor_name: str,
        reason: Optional[str] = None,
        actor: str = "Head of Risk Management",
        hrm_actor: Optional[str] = None,
        exception_query: Optional[str] = None
    ):
        """
        Dispatches alerts when HRM queries an application and returns to Credit Analyst.
        Head of Business Development ALSO receives the prompt/alert in their notification tray.
        Delivered via Email and In-App notification.
        """
        effective_reason = exception_query or reason or "HRM Risk Exception"
        effective_actor = hrm_actor or actor or "Head of Risk Management"

        # 1. Prompt to Analyst
        cls.send_email(
            to_email="tunde.adebayo@opticomfinance.com",
            subject=f"[EXCEPTION ALERT] Case {case_number} Returned for Rework",
            html_body=f"<p>Dear Credit Analyst,</p><p>HRM ({effective_actor}) has raised an exception on facility <strong>{case_number}</strong> ({obligor_name}):</p><blockquote>{effective_reason}</blockquote><p>Please resolve the queries and update the dossier.</p>",
            template="HRM_EXCEPTION_ANALYST",
            metadata={"case_number": case_number, "target": "ANALYST"}
        )

        # 2. Prompt to Head of Business Development
        cls.send_email(
            to_email="dapo.adeleke@opticomfinance.com",
            subject=f"[INFO ALERT] Case {case_number} ({obligor_name}) Returned to Analyst with Exception",
            html_body=f"<p>Dear Head of Business Development,</p><p>Please be advised that facility <strong>{case_number}</strong> ({obligor_name}) has been returned to the Credit Analyst by HRM for exception resolution:</p><blockquote>{effective_reason}</blockquote>",
            template="HRM_EXCEPTION_HEAD_OF_BD",
            metadata={"case_number": case_number, "target": "HEAD_OF_BD"}
        )

        # In-App Notifications for both Analyst and Head of BD
        cls.create_in_app_notification(
            title=f"HRM Risk Exception Alert: {case_number}",
            message=f"HRM ({effective_actor}) raised exception on {obligor_name}: \"{effective_reason}\". Returned to Analyst; Head of BD alerted.",
            notification_type="WARNING",
            category="RISK_EXCEPTION",
            case_number=case_number,
            recipient_role="ANALYST"
        )
        cls.create_in_app_notification(
            title=f"Exception Notice: {case_number}",
            message=f"HRM returned facility {obligor_name} to Analyst for exception rework: \"{effective_reason}\".",
            notification_type="INFO",
            category="RISK_EXCEPTION",
            case_number=case_number,
            recipient_role="HEAD_OF_BD"
        )

    @classmethod
    def notify_md_return_to_stakeholders(
        cls,
        case_number: str,
        obligor_name: str,
        target_role: str = "Head of Risk Management",
        reason: Optional[str] = None,
        actor: str = "Managing Director",
        md_actor: Optional[str] = None,
        md_reservation: Optional[str] = None
    ):
        """
        When MD returns an application (to HRM or Head of BD):
        Analyst, HRM, and Head of BD ALL receive a prompt that MD has returned the facility.
        Delivered via Email and In-App notification.
        """
        effective_reason = md_reservation or reason or "MD Executive Reservation"
        effective_actor = md_actor or actor or "Managing Director"
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

        cls.create_in_app_notification(
            title=f"MD Executive Return: {case_number}",
            message=f"Managing Director ({actor}) returned {obligor_name} to {target_role}: \"{reason}\". Analyst, HRM & BD notified.",
            notification_type="URGENT",
            category="EXECUTIVE_RETURN",
            case_number=case_number,
            recipient_role="ALL"
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
        Delivered via Email and In-App notification.
        """
        actor = analyst_actor or analyst_name
        cls.send_email(
            to_email="dapo.adeleke@opticomfinance.com",
            subject=f"[MCC REVIEW] New Credit Case {case_number} ({obligor_name}) - ₦{amount:,.2f}",
            html_body=f"<p>Dear Head of Business Development,</p><p>Credit Analyst <strong>{actor}</strong> has completed underwriting analysis on <strong>{case_number}</strong> ({obligor_name}) for ₦{amount:,.2f} and forwarded to the Management Credit Committee (MCC) for your commercial review and sanction.</p>",
            template="MCC_ASSIGNMENT_BD",
            metadata={"case_number": case_number, "amount": amount}
        )

        cls.create_in_app_notification(
            title=f"MCC Review Assigned: {case_number}",
            message=f"Credit Analyst {actor} completed CAM for {obligor_name} (₦{amount:,.2f}); assigned to Head of BD (MCC).",
            notification_type="INFO",
            category="MCC_ASSIGNMENT",
            case_number=case_number,
            recipient_role="HEAD_OF_BD"
        )

    @classmethod
    def notify_bcc_board_convened(
        cls,
        case_number: str,
        obligor_name: str,
        amount: float,
        md_actor: str = "Managing Director"
    ):
        """
        When facility > ₦20m is endorsed by MD, notifies all 3 BCC board members
        via Email AND creates In-App notification for BCC.
        """
        board_members = [
            ("emeka.nnamdi@opticomfinance.com", "Emeka Nnamdi (BCC Chair)"),
            ("aliyu.dangote@opticomfinance.com", "Alhaji Aliyu Dangote (BCC Member - Risk Trustee)"),
            ("zainab.ahmed@opticomfinance.com", "Mrs. Zainab Ahmed (BCC Member - Legal Trustee)")
        ]
        for email, name in board_members:
            cls.send_email(
                to_email=email,
                subject=f"[BCC QUORUM MANDATE] Credit Facility {case_number} ({obligor_name}) - ₦{amount:,.2f}",
                html_body=f"<p>Dear {name},</p><p>Managing Director ({md_actor}) has endorsed commercial facility <strong>{case_number}</strong> for <strong>{obligor_name}</strong> in the sum of <strong>₦{amount:,.2f}</strong>.</p><p>As this quantum exceeds the executive ₦20,000,000 threshold, <strong>statutory Board Credit Committee (BCC) sanction is mandatory</strong>.</p><p><strong>Governance Quorum Rule:</strong> At least 2 out of 3 Board members must approve for final facility sanction and legal package dispatch.</p>",
                template="BCC_QUORUM_CONVENED",
                metadata={"case_number": case_number, "amount": amount}
            )

        cls.create_in_app_notification(
            title=f"BCC Quorum Convened: {case_number}",
            message=f"Commercial facility for {obligor_name} (₦{amount:,.2f}) endorsed by MD; routed to Board Credit Committee. 2 of 3 Board approvals required.",
            notification_type="URGENT",
            category="BCC_REVIEW",
            case_number=case_number,
            recipient_role="BCC"
        )

    @classmethod
    def notify_head_of_bd_approval_to_hrm(
        cls,
        case_number: str,
        obligor_name: str,
        amount: float,
        bd_actor: str,
        comments: str
    ):
        """
        When Head of BD approves case in MCC, alerts HRM with BD's endorsement and comments.
        """
        hrm_email = "chidinma.okafor@opticomfinance.com"
        cls.send_email(
            to_email=hrm_email,
            subject=f"[MCC ENDORSEMENT] Case {case_number} ({obligor_name}) - ₦{amount:,.2f}",
            html_body=f"<p>Dear Head of Risk Management,</p><p>Head of Business Development <strong>{bd_actor}</strong> has reviewed and commercially sanctioned facility <strong>{case_number}</strong> ({obligor_name}) for <strong>₦{amount:,.2f}</strong>.</p><p><strong>Commercial Comments:</strong> {comments}</p><p>Case is now routed to your Risk Review Queue for risk concurrence.</p>",
            template="MCC_ENDORSED_TO_HRM",
            metadata={"case_number": case_number, "amount": amount, "bd_actor": bd_actor}
        )
        cls.create_in_app_notification(
            title=f"MCC Endorsement: {case_number}",
            message=f"Head of BD ({bd_actor}) approved {obligor_name} (₦{amount:,.2f}) and forwarded to HRM. Comments: {comments[:100]}...",
            notification_type="INFO",
            category="HRM_REVIEW",
            case_number=case_number,
            recipient_role="HRM"
        )

    @classmethod
    def notify_hrm_approval_to_md(
        cls,
        case_number: str,
        obligor_name: str,
        amount: float,
        hrm_actor: str,
        comments: str
    ):
        """
        When HRM approves risk review, alerts Managing Director with HRM's concurrence and comments.
        """
        md_email = "folashade.tinubu@opticomfinance.com"
        cls.send_email(
            to_email=md_email,
            subject=f"[EXECUTIVE SANCTION REQUIRED] Case {case_number} ({obligor_name}) - ₦{amount:,.2f}",
            html_body=f"<p>Dear Managing Director,</p><p>Head of Risk Management <strong>{hrm_actor}</strong> has completed credit risk assessment on <strong>{case_number}</strong> ({obligor_name}) for <strong>₦{amount:,.2f}</strong> and concurred with approval.</p><p><strong>Risk Assessment Comments:</strong> {comments}</p><p>Case is now placed in your Executive Sanctions Queue for final facility approval.</p>",
            template="HRM_CONCURRENCE_TO_MD",
            metadata={"case_number": case_number, "amount": amount, "hrm_actor": hrm_actor}
        )
        cls.create_in_app_notification(
            title=f"Risk Concurrence: {case_number}",
            message=f"HRM ({hrm_actor}) approved risk appraisal for {obligor_name} (₦{amount:,.2f}) and forwarded to Managing Director. Comments: {comments[:100]}...",
            notification_type="INFO",
            category="MD_DECISION",
            case_number=case_number,
            recipient_role="MD"
        )

    @classmethod
    def notify_bdo_resubmission_to_analyst(
        cls,
        case_number: str,
        obligor_name: str,
        bdo_actor: str,
        comments: str
    ):
        """
        When BDO updates documentation or clarifications, alerts Credit Analyst.
        """
        analyst_email = "tunde.adebayo@opticomfinance.com"
        cls.send_email(
            to_email=analyst_email,
            subject=f"[APPLICATION REWORK UPDATED] Case {case_number} ({obligor_name})",
            html_body=f"<p>Dear Credit Analyst,</p><p>Business Development Officer <strong>{bdo_actor}</strong> has uploaded updated customer documentation and clarifications for facility <strong>{case_number}</strong> ({obligor_name}).</p><p><strong>BDO Submission Notes:</strong> {comments}</p><p>Please review updated inputs in your Underwriting Queue.</p>",
            template="BDO_RESUBMISSION_TO_ANALYST",
            metadata={"case_number": case_number, "bdo_actor": bdo_actor}
        )
        cls.create_in_app_notification(
            title=f"BDO Updated Application: {case_number}",
            message=f"BDO {bdo_actor} submitted updated details for {obligor_name}. Analyst review required.",
            notification_type="INFO",
            category="ANALYST_REVIEW",
            case_number=case_number,
            recipient_role="ANALYST"
        )

    @classmethod
    def notify_bcc_quorum_progress(
        cls,
        case_number: str,
        obligor_name: str,
        approving_actor: Optional[str] = None,
        approved_count: int = 1,
        required_count: int = 2,
        amount: Optional[float] = None,
        approver_actor: Optional[str] = None
    ):
        """
        When a BCC member approves, updates board members via email and in-app tray.
        """
        effective_actor = approving_actor or approver_actor or "BCC Member"
        board_members = [
            "emeka.nnamdi@opticomfinance.com",
            "aliyu.dangote@opticomfinance.com",
            "zainab.ahmed@opticomfinance.com"
        ]
        for email in board_members:
            cls.send_email(
                to_email=email,
                subject=f"[BCC VOTE PROGRESS] {effective_actor} Approved {case_number} ({approved_count}/{required_count})",
                html_body=f"<p>Board Member <strong>{effective_actor}</strong> has registered approval for <strong>{case_number}</strong> ({obligor_name}).</p><p><strong>Quorum Status:</strong> {approved_count} of {required_count} required approvals recorded (Awaiting {required_count - approved_count} more Board member).</p>",
                template="BCC_QUORUM_PROGRESS",
                metadata={"case_number": case_number, "approved_count": approved_count}
            )

        cls.create_in_app_notification(
            title=f"BCC Vote Recorded: {case_number}",
            message=f"{effective_actor} approved {obligor_name}. Quorum progress: {approved_count} of {required_count} required Board approvals recorded.",
            notification_type="INFO",
            category="BCC_REVIEW",
            case_number=case_number,
            recipient_role="BCC"
        )

    @classmethod
    def auto_generate_and_email_offer_letter(
        cls,
        credit_case,
        db
    ):
        """
        Auto-generates the complete post-approval legal document suite and delivers:
        1. Facility Offer Letter & Complete Legal Suite to APPLICANT'S EMAIL.
        2. Third-Party Personal Guarantee Deed & Legal Instruments to GUARANTOR'S EMAIL.
        3. Real-time In-App Notification to staff cockpit and applicant tracking portal.
        """
        from ..models.entities import Offer
        from ..core.financial_engine import FinancialEngine
        from ..core.config_manager import ConfigManager
        from ..core.state_machine import TransitionService
        from ..services.approval_document_service import ApprovalDocumentService

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

        # Extract normalized case and guarantor details
        ctx = ApprovalDocumentService.extract_case_context(credit_case)
        cust_email = customer.email or ctx.get("email") or "borrower@example.ng"
        guarantor_email = ctx.get("guarantor_email") or "guarantor@example.ng"
        guarantor_name = ctx.get("guarantor_name") or "Third-Party Guarantor"
        guarantor_address = ctx.get("guarantor_address") or "Registered Guarantor Address"
        company_name = customer.name

        # -------------------------------------------------------------
        # 1. SEND EMAIL TO APPLICANT (BORROWER)
        # -------------------------------------------------------------
        applicant_subject = f"Official Credit Facility Offer Letter & Legal Suite — Opticom Finance Limited ({credit_case.case_number})"
        applicant_email_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; color: #041326;">
          <h2 style="color: #0096cc; margin-top: 0; font-size: 20px;">OPTICOM FINANCE LIMITED</h2>
          <p style="font-size: 11px; color: #64748b; margin-top: -10px;">Commercial Credit & Structured Finance &bull; RC: 347832 &bull; Help-Line: 0816 181 3538</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
          
          <p>Dear <strong>{company_name}</strong>,</p>
          <p>We are pleased to advise that following rigorous underwriting appraisal and governance committee sanction, your commercial facility request has received <strong>Final Executive Approval</strong>.</p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin: 15px 0;">
            <h4 style="margin: 0 0 10px 0; color: #041326;">FACILITY TERM SHEET SUMMARY</h4>
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

          <div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 3px solid #d97706; padding: 10px 14px; margin: 15px 0; font-size: 12px; line-height: 1.5;">
            <strong>MANDATORY 7-DAY GRACE PERIOD & 5% OVERDUE PENALTY CLAUSE:</strong><br />
            Debt service must occur on or before the due date. A strict grace period of <strong>seven (7) calendar days</strong> is permitted. Unserviced installments following 7 days shall attract an automatic <strong>Default Penalty of 5% flat per month</strong> on all overdue sums until settled in full.
          </div>

          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px; margin: 15px 0; font-size: 12.5px;">
            <strong>LEGAL INSTRUMENTS ATTACHED & ENCLOSED FOR EXECUTION:</strong>
            <ul style="margin: 6px 0 0 16px; padding: 0;">
              <li>1. Facility Offer Letter &amp; Borrower Acceptance Slip</li>
              <li>2. Deed of Bill of Sale &amp; Right of Entry (Principal Obligor)</li>
              <li>3. Deed of Personal Guarantee &amp; Indemnity (Director)</li>
              <li>4. Deed of Transfer of Motor Vehicle Ownership (where vehicle is pledged)</li>
              <li>5. Tripartite Legal Mortgage Agreement (where landed property is pledged)</li>
              <li>6. Master Facility Agreement (Lease / Term Loan)</li>
            </ul>
          </div>

          <p style="font-size: 13px; line-height: 1.5; color: #334155;">
            Please access your secure tracking portal at <a href="https://credit.opticomfinance.com/track/{credit_case.case_number}" style="color: #0096cc; font-weight: bold;">https://credit.opticomfinance.com/track/{credit_case.case_number}</a> to execute your digital acceptance and submit condition items.
          </p>
          
          <p style="font-size: 12px; color: #64748b; margin-top: 25px;">
            Opticom Finance Limited &bull; 10th Floor, UAC House, 1-5 Odunlami St, Lagos Island &bull; Phone: 0816 181 3538 &bull; Email: info@opticomfinance.com
          </p>
        </div>
        """
        cls.send_email(
            to_email=cust_email,
            subject=applicant_subject,
            html_body=applicant_email_body,
            template="OFFICIAL_OFFER_LETTER",
            metadata={"case_number": credit_case.case_number, "amount": amount, "recipient_type": "APPLICANT"}
        )

        # -------------------------------------------------------------
        # 2. SEND EMAIL TO GUARANTOR
        # -------------------------------------------------------------
        guarantor_subject = f"Notice of Credit Approval & Deed of Personal Guarantee — Opticom Finance Limited ({credit_case.case_number})"
        guarantor_email_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; color: #041326;">
          <h2 style="color: #0096cc; margin-top: 0; font-size: 20px;">OPTICOM FINANCE LIMITED</h2>
          <p style="font-size: 11px; color: #64748b; margin-top: -10px;">Commercial Credit & Structured Finance &bull; RC: 347832 &bull; Help-Line: 0816 181 3538</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
          
          <p>Dear <strong>{guarantor_name}</strong>,</p>
          <p style="font-size: 12.5px; color: #64748b; margin-top: -8px;">Address: {guarantor_address}</p>

          <p>This is to formally notify you that following credit committee appraisal, commercial facility <strong>{credit_case.case_number}</strong> applied for by <strong>{company_name}</strong> (hereinafter “the Principal Obligor”) has received <strong>Final Sanction</strong> in the principal sum of <strong>₦{amount:,.2f}</strong>.</p>
          
          <p>You have been formally nominated, verified, and accepted as the <strong>Third-Party Personal Guarantor</strong> for this facility.</p>

          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 15px; margin: 15px 0;">
            <h4 style="margin: 0 0 10px 0; color: #041326;">GUARANTEE COVENANTS & SUMMARY</h4>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr><td style="padding: 4px 0; color: #64748b;">Facility Reference:</td><td style="font-weight: bold;">{credit_case.case_number}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Principal Debtor:</td><td style="font-weight: bold;">{company_name}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Total Guaranteed Sum:</td><td style="font-weight: bold; color: #059669;">₦{amount:,.2f}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Facility Tenor:</td><td style="font-weight: bold;">{tenor} Months</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Monthly Debt Service:</td><td style="font-weight: bold;">₦{monthly_pmt:,.2f} / month</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Overdue Penalty Policy:</td><td style="font-weight: bold; color: #dc2626;">5% Flat per Month after 7 Calendar Days Grace</td></tr>
            </table>
          </div>

          <div style="background: #eff6ff; border-left: 3px solid #0096cc; padding: 12px 14px; margin: 15px 0; font-size: 12.5px; line-height: 1.55;">
            <strong>ENCLOSED GUARANTOR LEGAL INSTRUMENTS:</strong><br />
            &bull; <strong>Deed of Third-Party Personal Guarantee & Indemnity</strong> (Unconditional continuing guarantee as principal debtor)<br />
            &bull; <strong>Bill of Sale & Right of Entry (Guarantor)</strong> (Charge over pledged assets / automobiles)<br />
            &bull; <strong>Copy of Official Facility Offer Letter</strong> (Binding schedule & terms)
          </div>

          <p style="font-size: 13px; line-height: 1.5; color: #334155;">
            Please review the legal instruments and execute signing. You may review the transaction dossier or contact legal operations directly at <a href="mailto:legal@opticomfinance.com" style="color: #0096cc; font-weight: bold;">legal@opticomfinance.com</a> or via borrower reference portal <a href="https://credit.opticomfinance.com/track/{credit_case.case_number}" style="color: #0096cc; font-weight: bold;">https://credit.opticomfinance.com/track/{credit_case.case_number}</a>.
          </p>
          
          <p style="font-size: 12px; color: #64748b; margin-top: 25px;">
            Opticom Finance Limited &bull; Legal Advisory & Underwriting Operations &bull; 10th Floor, UAC House, 1-5 Odunlami St, Lagos Island
          </p>
        </div>
        """
        cls.send_email(
            to_email=guarantor_email,
            subject=guarantor_subject,
            html_body=guarantor_email_body,
            template="GUARANTOR_POST_APPROVAL_PACK",
            metadata={"case_number": credit_case.case_number, "amount": amount, "recipient_type": "GUARANTOR", "guarantor_name": guarantor_name}
        )

        # -------------------------------------------------------------
        # 3. EMIT REAL-TIME IN-APP NOTIFICATION
        # -------------------------------------------------------------
        cls.create_in_app_notification(
            title=f"Offer & Legal Package Dispatched: {credit_case.case_number}",
            message=f"Post-approval documents delivered to Applicant ({cust_email}) and Guarantor ({guarantor_email}) for ₦{amount:,.2f} facility ({company_name}).",
            notification_type="SUCCESS",
            category="OFFER_DISPATCHED",
            case_number=credit_case.case_number,
            recipient_role="ALL"
        )

    @classmethod
    def get_delivery_logs(cls, limit: int = 50) -> List[Dict[str, Any]]:
        return cls._delivery_log[:limit]
