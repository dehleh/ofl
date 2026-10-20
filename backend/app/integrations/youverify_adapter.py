"""
Youverify Identity and Business Verification Adapter (PRD FR-03, Section 8.1)
Simulates Youverify API with mock sandbox and production-ready structure.
Enforces manual KYC exception routing on mismatch (no auto-override).
"""
from typing import Dict, Any, Tuple, Optional
from datetime import datetime
import hashlib
from sqlalchemy.orm import Session
from ..models import KYCCheck, ExceptionItem, CreditCase, AuditEvent, CaseState
from ..database import utc_now, generate_uuid
from ..config import settings

class YouverifyAdapter:
    @classmethod
    def verify_identity(
        cls,
        db: Session,
        credit_case: CreditCase,
        bvn: Optional[str] = None,
        nin: Optional[str] = None,
        rc_number: Optional[str] = None,
        actor: str = "Credit Operations"
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Initiates a verification check with Youverify.
        Stores request/response references, timestamps, and routes mismatches to compliance.
        """
        provider_ref = f"YV-{utc_now().strftime('%Y%m%d%H%M%S')}-{generate_uuid()[:6]}"
        
        # Check if already verified
        existing = db.query(KYCCheck).filter(
            KYCCheck.case_id == credit_case.id,
            KYCCheck.status == "PASSED"
        ).first()
        if existing:
            return True, {
                "message": "KYC already verified.",
                "provider_ref": existing.provider_ref,
                "status": existing.status
            }

        # Deterministic simulation for testing UAT-04 and UAT-05:
        # If BVN starts with '999', simulate mismatch for exception testing
        # If BVN starts with '000', simulate service outage
        status = "PASSED"
        summary = {
            "bvn_verified": True,
            "face_match_confidence": 0.94,
            "sanctions_pep_clean": True,
            "provider": "Youverify v2.1"
        }
        
        if bvn and bvn.startswith("999"):
            status = "MISMATCH"
            summary = {
                "bvn_verified": False,
                "reason": "Name on BVN record does not match registered application details.",
                "discrepancy_score": 0.65,
                "provider": "Youverify v2.1"
            }
        elif bvn and bvn.startswith("000"):
            status = "FAILED"
            summary = {
                "error": "Youverify gateway timeout / upstream service unreachable.",
                "retryable": True
            }

        kyc_check = KYCCheck(
            case_id=credit_case.id,
            provider="YOUVERIFY",
            provider_ref=provider_ref,
            status=status,
            result_summary=summary,
            reviewed_by=actor if status == "PASSED" else None,
            reviewed_at=utc_now() if status == "PASSED" else None
        )
        db.add(kyc_check)
        
        # Route to KYC exception on mismatch or failure (FR-03, UAT-04)
        if status in ["MISMATCH", "FAILED"]:
            exception_item = ExceptionItem(
                case_id=credit_case.id,
                category="KYC_MISMATCH" if status == "MISMATCH" else "TECHNICAL_FAILURE",
                origin_stage=credit_case.state,
                owner="KYC / Compliance Officer",
                return_stage=CaseState.ANALYST_REVIEW.value,
                reason=f"Youverify verification yielded {status}: {summary.get('reason') or summary.get('error')}",
                sla_hours=12,
                status="OPEN"
            )
            db.add(exception_item)
            
        audit = AuditEvent(
            actor=actor,
            role="SYSTEM",
            event="YOUVERIFY_CHECK_EXECUTED",
            entity="KYCCheck",
            entity_id=provider_ref,
            correlation_id=generate_uuid(),
            reason=f"Status: {status}",
            details=summary
        )
        db.add(audit)
        db.commit()
        db.refresh(kyc_check)
        
        return (status == "PASSED"), {
            "provider_ref": provider_ref,
            "status": status,
            "summary": summary
        }
