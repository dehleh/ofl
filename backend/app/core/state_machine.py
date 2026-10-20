"""
Workflow State Machine and Transition Service (PRD Section 6 & 6.1)
Enforces transition invariants, audit trail logging, and segregation of duties.
"""
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime
import hashlib
import json
from sqlalchemy.orm import Session
from ..models import (
    CreditCase, CaseState, AuditEvent, Approval, 
    ExceptionItem, ConditionItem, Disbursement
)
from ..database import utc_now, generate_uuid

# Allowed primary state transitions
ALLOWED_TRANSITIONS: Dict[str, List[str]] = {
    CaseState.DRAFT.value: [CaseState.SUBMITTED.value, CaseState.WITHDRAWN.value],
    CaseState.SUBMITTED.value: [CaseState.KYC_PENDING.value, CaseState.ANALYST_REVIEW.value, CaseState.REJECTED.value, CaseState.WITHDRAWN.value],
    CaseState.KYC_PENDING.value: [CaseState.ANALYST_REVIEW.value, CaseState.REJECTED.value, CaseState.WITHDRAWN.value],
    CaseState.ANALYST_REVIEW.value: [CaseState.HRM_REVIEW.value, CaseState.KYC_PENDING.value, CaseState.WITHDRAWN.value],
    CaseState.HRM_REVIEW.value: [CaseState.BCC_REVIEW.value, CaseState.MD_DECISION.value, CaseState.OFFER_PENDING.value, CaseState.ANALYST_REVIEW.value, CaseState.REJECTED.value],
    CaseState.BCC_REVIEW.value: [CaseState.MD_DECISION.value, CaseState.OFFER_PENDING.value, CaseState.HRM_REVIEW.value, CaseState.REJECTED.value],
    CaseState.MD_DECISION.value: [CaseState.OFFER_PENDING.value, CaseState.HRM_REVIEW.value, CaseState.REJECTED.value],
    CaseState.OFFER_PENDING.value: [CaseState.CONDITIONS_PENDING.value, CaseState.HRM_REVIEW.value, CaseState.REJECTED.value, CaseState.WITHDRAWN.value],
    CaseState.CONDITIONS_PENDING.value: [CaseState.READY_FOR_DISBURSEMENT.value, CaseState.OFFER_PENDING.value, CaseState.WITHDRAWN.value],
    CaseState.READY_FOR_DISBURSEMENT.value: [CaseState.TREASURY_CONFIRMATION_PENDING.value, CaseState.CONDITIONS_PENDING.value],
    CaseState.TREASURY_CONFIRMATION_PENDING.value: [CaseState.LOANDISC_SYNC_PENDING.value, CaseState.READY_FOR_DISBURSEMENT.value],
    CaseState.LOANDISC_SYNC_PENDING.value: [CaseState.DISBURSED_MONITORING.value],
    CaseState.DISBURSED_MONITORING.value: [],
    CaseState.REJECTED.value: [],
    CaseState.WITHDRAWN.value: []
}

class TransitionService:
    @staticmethod
    def calculate_terms_hash(amount: float, tenor: int, interest_rate: float, applicant_id: str) -> str:
        """
        Calculates SHA-256 fingerprint of critical credit terms for material change detection (FR-12).
        """
        payload = f"{amount:.2f}|{tenor}|{interest_rate:.4f}|{applicant_id}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @classmethod
    def execute_transition(
        cls,
        db: Session,
        credit_case: CreditCase,
        to_state: str,
        actor: str,
        role: str,
        reason: str,
        correlation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, str]:
        """
        Executes a validated state transition with full audit event persistence.
        """
        from_state = credit_case.state
        correlation_id = correlation_id or generate_uuid()
        details = details or {}
        
        # Validation: Check if transition is defined in allowed path
        allowed = ALLOWED_TRANSITIONS.get(from_state, [])
        if to_state not in allowed:
            return False, f"Invalid state transition from '{from_state}' to '{to_state}'."
        
        # Segregation of duties & role authorization checks
        if to_state in [CaseState.REJECTED.value] and role not in ["HRM", "BCC", "MD", "ADMIN"]:
            return False, f"Role '{role}' is not authorized to execute final rejection (FR-10). Only HRM, BCC, or MD may reject."
            
        if to_state == CaseState.READY_FOR_DISBURSEMENT.value:
            # Check conditions precedent (FR-14)
            unmet_mandatory_conditions = db.query(ConditionItem).filter(
                ConditionItem.case_id == credit_case.id,
                ConditionItem.mandatory == True,
                ConditionItem.status != "SATISFIED"
            ).count()
            if unmet_mandatory_conditions > 0:
                return False, f"Cannot transition to Ready for Disbursement: {unmet_mandatory_conditions} mandatory conditions precedent remain unsatisfied (FR-14)."

        if to_state == CaseState.DISBURSED_MONITORING.value:
            # Check that disbursement has been confirmed in Treasury & NAV
            confirmed_disbursement = db.query(Disbursement).filter(
                Disbursement.case_id == credit_case.id,
                Disbursement.status.in_(["CONFIRMED", "RECONCILED"])
            ).first()
            if not confirmed_disbursement:
                return False, "Cannot transition to Disbursed/Monitoring without confirmed Treasury NAV disbursement record."

        # Apply state transition
        credit_case.state = to_state
        credit_case.updated_at = utc_now()
        
        # Create immutable Audit Event
        audit_event = AuditEvent(
            actor=actor,
            role=role,
            event=f"TRANSITION_{from_state.upper()}_TO_{to_state.upper()}",
            entity="CreditCase",
            entity_id=credit_case.case_number,
            correlation_id=correlation_id,
            reason=reason,
            details={
                "from_state": from_state,
                "to_state": to_state,
                "case_revision": credit_case.revision,
                **details
            }
        )
        db.add(audit_event)
        db.commit()
        db.refresh(credit_case)
        
        return True, f"Successfully transitioned to {to_state}."

    @classmethod
    def invalidate_approvals_if_material_change(
        cls,
        db: Session,
        credit_case: CreditCase,
        new_terms_hash: str,
        actor: str,
        reason: str
    ) -> int:
        """
        FR-12: Detects material changes to credit terms and invalidates prior approvals.
        """
        active_approvals = db.query(Approval).filter(
            Approval.case_id == credit_case.id,
            Approval.invalidated_at == None
        ).all()
        
        invalidated_count = 0
        now = utc_now()
        for approval in active_approvals:
            if approval.terms_hash != new_terms_hash:
                approval.invalidated_at = now
                invalidated_count += 1
                
        if invalidated_count > 0:
            credit_case.revision += 1
            # Log audit event for invalidation
            audit = AuditEvent(
                actor=actor,
                role="SYSTEM",
                event="APPROVALS_INVALIDATED_MATERIAL_CHANGE",
                entity="CreditCase",
                entity_id=credit_case.case_number,
                correlation_id=generate_uuid(),
                reason=reason,
                details={
                    "invalidated_count": invalidated_count,
                    "new_revision": credit_case.revision,
                    "new_terms_hash": new_terms_hash
                }
            )
            db.add(audit)
            db.commit()
            
        return invalidated_count
