"""
BESTO Ingestion and Adapter Module (PRD Section 17.1 - 17.4, FR-21 - FR-25)
Handles validation, deduplication on (source_system, source_application_id),
quarantine handling for malformed payloads, and KYC evidence reuse.
"""
from typing import Dict, Any, Tuple, Optional
from datetime import datetime
import hashlib
import json
from sqlalchemy.orm import Session
from ..models import (
    Customer, Application, CreditCase, KYCCheck, 
    Document, ExceptionItem, IntegrationEvent, AuditEvent,
    IntakeChannel, CaseState
)
from ..config import settings
from ..database import utc_now, generate_uuid, generate_next_case_number
from ..core.financial_engine import FinancialEngine

class BestoAdapter:
    SOURCE_SYSTEM = "BESTO"
    
    @classmethod
    def ingest_payload(
        cls, 
        db: Session, 
        payload: Dict[str, Any],
        correlation_id: Optional[str] = None
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Ingests a submitted BESTO application with strict idempotency and validation.
        """
        correlation_id = correlation_id or payload.get("correlation_id") or generate_uuid()
        raw_json = json.dumps(payload, sort_keys=True)
        payload_hash = hashlib.sha256(raw_json.encode("utf-8")).hexdigest()
        
        source_app_id = payload.get("source_application_id")
        if not source_app_id:
            # Quarantine payload
            cls._quarantine_event(db, "MISSING_SOURCE_APPLICATION_ID", payload, payload_hash, correlation_id)
            return False, {"error": "Missing required field: source_application_id", "quarantined": True}
            
        idempotency_key = f"BESTO_{source_app_id}"
        
        # FR-22: Check for existing case with this (source_system, source_application_id)
        existing_event = db.query(IntegrationEvent).filter(
            IntegrationEvent.idempotency_key == idempotency_key
        ).first()
        
        if existing_event:
            # Replay detected! Do not create duplicate case
            existing_case = db.query(CreditCase).join(Application).filter(
                Application.raw_payload["source_application_id"].as_string() == source_app_id
            ).first()
            
            existing_event.attempt_count += 1
            existing_event.updated_at = utc_now()
            db.commit()
            
            return True, {
                "message": "Duplicate BESTO application acknowledged (idempotent replay). No duplicate case created.",
                "case_number": existing_case.case_number if existing_case else None,
                "case_id": existing_case.id if existing_case else None,
                "is_replay": True,
                "attempt_count": existing_event.attempt_count
            }
            
        # Amount validation: ₦300,000 to ₦2,000,000 inclusive (Section 17.1, 17.3)
        requested_amount = float(payload.get("requested_amount_ngn", 0.0))
        if requested_amount < settings.BESTO_MIN_AMOUNT or requested_amount > settings.BESTO_MAX_AMOUNT:
            cls._quarantine_event(
                db, 
                "AMOUNT_OUT_OF_BESTO_BOUNDS", 
                payload, 
                payload_hash, 
                correlation_id,
                f"Amount ₦{requested_amount:,.2f} is outside BESTO canonical range (₦{settings.BESTO_MIN_AMOUNT:,.2f} - ₦{settings.BESTO_MAX_AMOUNT:,.2f})"
            )
            return False, {
                "error": f"Requested amount ₦{requested_amount:,.2f} is outside BESTO boundary [₦300,000 - ₦2,000,000].",
                "quarantined": True
            }
            
        applicant_details = payload.get("applicant_details", {})
        applicant_name = applicant_details.get("name")
        if not applicant_name:
            cls._quarantine_event(db, "MISSING_APPLICANT_NAME", payload, payload_hash, correlation_id)
            return False, {"error": "Applicant name is mandatory.", "quarantined": True}
            
        # Create Customer or reuse existing by BVN / email
        bvn = applicant_details.get("bvn")
        customer = None
        if bvn:
            customer = db.query(Customer).filter(Customer.bvn == bvn).first()
            
        if not customer:
            customer = Customer(
                customer_type="INDIVIDUAL",
                name=applicant_name,
                email=applicant_details.get("email"),
                phone=applicant_details.get("phone"),
                bvn=bvn,
                nin=applicant_details.get("nin"),
                external_references={"besto_customer_ref": payload.get("customer_reference")},
                verified_attributes=applicant_details.get("verified_attributes", {})
            )
            db.add(customer)
            db.flush()
            
        # Create Application
        tenor_months = int(payload.get("tenor_months", 12))
        application = Application(
            customer_id=customer.id,
            amount=requested_amount,
            currency="NGN",
            tenor=tenor_months,
            purpose=payload.get("purpose", "Working Capital / Business Support"),
            intake_channel=IntakeChannel.BESTO.value,
            status="SUBMITTED",
            applicant_type="INDIVIDUAL",
            raw_payload=payload
        )
        db.add(application)
        db.flush()
        
        # Generate immutable sequential Case Number
        case_number = generate_next_case_number(db)
        
        # CreditCase creation (FR-21)
        credit_case = CreditCase(
            application_id=application.id,
            case_number=case_number,
            state=CaseState.ANALYST_REVIEW.value,  # Enters analyst queue after validation
            revision=1,
            assigned_owner="Credit Analyst Queue"
        )
        db.add(credit_case)
        db.flush()
        
        # FR-25: KYC Evidence Reuse
        kyc_evidence = payload.get("kyc_evidence")
        if kyc_evidence and kyc_evidence.get("status") in ["VERIFIED", "PASSED"]:
            kyc_check = KYCCheck(
                case_id=credit_case.id,
                provider="BESTO_REUSE",
                provider_ref=kyc_evidence.get("provider_ref", f"BESTO-KYC-{source_app_id}"),
                status="PASSED",
                result_summary=kyc_evidence,
                reviewed_by="BESTO Integration System",
                reviewed_at=utc_now()
            )
            db.add(kyc_check)
        else:
            # FR-25 / Acceptance: Incomplete KYC enters an owned verification exception without losing case
            kyc_check = KYCCheck(
                case_id=credit_case.id,
                provider="BESTO_REUSE",
                provider_ref=f"BESTO-KYC-PENDING-{source_app_id}",
                status="PENDING",
                result_summary={"note": "BESTO payload did not include full verified KYC evidence"}
            )
            db.add(kyc_check)
            
            kyc_exception = ExceptionItem(
                case_id=credit_case.id,
                category="KYC_MISMATCH",
                origin_stage=CaseState.KYC_PENDING.value,
                owner="KYC Officer / Compliance",
                return_stage=CaseState.ANALYST_REVIEW.value,
                reason="Incomplete KYC evidence from BESTO intake. Manual or Youverify verification required.",
                sla_hours=12,
                status="OPEN"
            )
            db.add(kyc_exception)
            
        # Ingest Document Manifest if present
        for doc_item in (payload.get("document_manifest") or []):
            doc = Document(
                case_id=credit_case.id,
                document_type=doc_item.get("type", "BANK_STATEMENT"),
                object_key=doc_item.get("url", f"besto/{source_app_id}/{doc_item.get('name', 'doc')}"),
                checksum=hashlib.sha256(doc_item.get("name", "doc").encode()).hexdigest()[:32],
                version=1,
                scan_status="CLEAN",
                original_filename=doc_item.get("name", "document.pdf"),
                content_summary=doc_item.get("summary", "Document provided via BESTO submission")
            )
            db.add(doc)
            
        # Record Integration Event (FR-23)
        event = IntegrationEvent(
            external_system=cls.SOURCE_SYSTEM,
            idempotency_key=idempotency_key,
            payload_hash=payload_hash,
            attempt_count=1,
            status="ACKNOWLEDGED",
            acknowledgment={
                "case_number": case_number,
                "case_id": credit_case.id,
                "accepted_at": utc_now().isoformat()
            }
        )
        db.add(event)
        
        # Audit Log
        audit = AuditEvent(
            actor="BESTO_CONNECTOR",
            role="SYSTEM",
            event="BESTO_APPLICATION_INGESTED",
            entity="CreditCase",
            entity_id=case_number,
            correlation_id=correlation_id,
            reason="Inbound BESTO loan application intake and canonical mapping",
            details={
                "source_application_id": source_app_id,
                "amount": requested_amount,
                "kyc_reused": bool(kyc_evidence and kyc_evidence.get("status") in ["VERIFIED", "PASSED"])
            }
        )
        db.add(audit)
        
        db.commit()
        db.refresh(credit_case)
        
        return True, {
            "message": "BESTO application successfully ingested into OFL credit pipeline.",
            "case_number": case_number,
            "case_id": credit_case.id,
            "is_replay": False
        }

    @classmethod
    def _quarantine_event(
        cls, 
        db: Session, 
        error_code: str, 
        payload: Dict[str, Any], 
        payload_hash: str, 
        correlation_id: str,
        details: Optional[str] = None
    ):
        event = IntegrationEvent(
            external_system=cls.SOURCE_SYSTEM,
            idempotency_key=f"QUARANTINE_{correlation_id}_{utc_now().timestamp()}",
            payload_hash=payload_hash,
            attempt_count=1,
            status="FAILED",
            error_details=f"[{error_code}] {details or 'Payload validation failed.'}"
        )
        db.add(event)
        
        audit = AuditEvent(
            actor="BESTO_CONNECTOR",
            role="SYSTEM",
            event="BESTO_PAYLOAD_QUARANTINED",
            entity="IntegrationEvent",
            entity_id=event.idempotency_key,
            correlation_id=correlation_id,
            reason=error_code,
            details={"error_code": error_code, "details": details}
        )
        db.add(audit)
        db.commit()
