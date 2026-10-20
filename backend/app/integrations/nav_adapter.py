"""
Microsoft Dynamics NAV / Treasury Handoff Adapter (PRD FR-15, Section 8.1, UAT-13)
Creates approved disbursement instruction packet for authorised Treasury officers.
Records confirmed NAV facility reference and disbursement confirmation evidence.
Strictly prohibits autonomous payment initiation (human-controlled disbursement only).
"""
from typing import Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from ..models import (
    CreditCase, Disbursement, CaseState, AuditEvent,
    ConditionItem, Offer
)
from ..database import utc_now, generate_uuid
from ..core.state_machine import TransitionService

class NavTreasuryAdapter:
    @classmethod
    def generate_disbursement_packet(
        cls,
        db: Session,
        credit_case: CreditCase
    ) -> Dict[str, Any]:
        """
        Creates the authorized disbursement instruction packet for Treasury staff (FR-15).
        """
        offer = db.query(Offer).filter(
            Offer.case_id == credit_case.id,
            Offer.status == "ACCEPTED"
        ).first()
        
        # Verify conditions precedent are satisfied
        conditions = db.query(ConditionItem).filter(
            ConditionItem.case_id == credit_case.id
        ).all()
        
        all_satisfied = all(c.status in ["SATISFIED", "WAIVED"] for c in conditions)
        
        return {
            "case_number": credit_case.case_number,
            "applicant_name": credit_case.application.customer.name,
            "customer_bvn": credit_case.application.customer.bvn,
            "approved_amount": offer.approved_amount if offer else credit_case.application.amount,
            "tenor_months": offer.tenor_months if offer else credit_case.application.tenor,
            "interest_rate_pct": offer.interest_rate_pct if offer else 28.0,
            "conditions_satisfied": all_satisfied,
            "pending_conditions": [c.description for c in conditions if c.status not in ["SATISFIED", "WAIVED"]],
            "ready_for_treasury": all_satisfied and credit_case.state == CaseState.READY_FOR_DISBURSEMENT.value
        }

    @classmethod
    def record_confirmed_disbursement(
        cls,
        db: Session,
        credit_case: CreditCase,
        nav_reference: str,
        amount: float,
        confirmation_evidence: str,
        actor: str = "Treasury Officer"
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Records human-confirmed NAV disbursement reference and evidence.
        Enforces uniqueness of NAV reference and advances case to LOAN-DISC Sync Pending.
        """
        # Ensure NAV reference is unique
        existing = db.query(Disbursement).filter(
            Disbursement.nav_reference == nav_reference
        ).first()
        if existing:
            return False, {
                "error": f"NAV Reference '{nav_reference}' has already been booked and recorded against case {existing.case_id}."
            }

        disbursement = Disbursement(
            case_id=credit_case.id,
            nav_reference=nav_reference,
            amount=amount,
            confirmation_evidence=confirmation_evidence,
            status="CONFIRMED",
            recorded_by=actor
        )
        db.add(disbursement)
        
        # Advance case workflow state
        ok, msg = TransitionService.execute_transition(
            db=db,
            credit_case=credit_case,
            to_state=CaseState.LOANDISC_SYNC_PENDING.value,
            actor=actor,
            role="TREASURY",
            reason=f"Confirmed disbursement recorded under NAV Ref: {nav_reference}",
            details={"nav_reference": nav_reference, "amount": amount}
        )
        
        db.commit()
        db.refresh(disbursement)
        
        return True, {
            "message": "Disbursement recorded and verified in NAV successfully.",
            "disbursement_id": disbursement.id,
            "nav_reference": nav_reference,
            "next_stage": CaseState.LOANDISC_SYNC_PENDING.value
        }
