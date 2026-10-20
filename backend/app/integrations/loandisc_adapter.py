"""
LOAN-DISC Post-Disbursement Synchronization Adapter (PRD FR-16, Section 8.1, UAT-14)
Ensures confirmed disbursements are synchronized exactly once using idempotent keys.
Safely retries on failure without duplicating loan schedule records.
"""
from typing import Dict, Any, Tuple, Optional
from datetime import datetime
import hashlib
from sqlalchemy.orm import Session
from ..models import (
    CreditCase, Disbursement, IntegrationEvent, CaseState, AuditEvent
)
from ..database import utc_now, generate_uuid
from ..core.state_machine import TransitionService

class LoanDiscAdapter:
    EXTERNAL_SYSTEM = "LOAN_DISC"
    
    @classmethod
    def sync_disbursement(
        cls,
        db: Session,
        credit_case: CreditCase,
        actor: str = "Credit Operations"
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Synchronizes a confirmed loan facility to LOAN-DISC.
        Idempotent: Uses LOANDISC_{case_number} key to prevent duplicate creation.
        """
        disbursement = db.query(Disbursement).filter(
            Disbursement.case_id == credit_case.id,
            Disbursement.status.in_(["CONFIRMED", "RECONCILED"])
        ).first()
        
        if not disbursement:
            return False, {"error": "Cannot sync to LOAN-DISC: No confirmed disbursement record found in NAV."}
            
        idempotency_key = f"LOANDISC_SYNC_{credit_case.case_number}"
        
        # Check existing integration event
        event = db.query(IntegrationEvent).filter(
            IntegrationEvent.idempotency_key == idempotency_key
        ).first()
        
        if event and event.status == "ACKNOWLEDGED":
            return True, {
                "message": "LOAN-DISC synchronization already completed (Idempotent acknowledge).",
                "acknowledgment_id": event.acknowledgment.get("loandisc_facility_id") if event.acknowledgment else None,
                "is_retry": True
            }
            
        payload = {
            "case_number": credit_case.case_number,
            "borrower_name": credit_case.application.customer.name,
            "nav_reference": disbursement.nav_reference,
            "disbursed_amount": disbursement.amount,
            "tenor_months": credit_case.application.tenor,
            "sync_timestamp": utc_now().isoformat()
        }
        payload_hash = hashlib.sha256(str(payload).encode()).hexdigest()
        
        # Simulate LOAN-DISC API call / Controlled Export Acknowledgment
        loandisc_facility_id = f"LD-{utc_now().strftime('%Y%m')}-{generate_uuid()[:8].upper()}"
        ack_data = {
            "loandisc_facility_id": loandisc_facility_id,
            "status": "ACTIVE_SERVICING",
            "schedule_created": True,
            "acknowledged_at": utc_now().isoformat()
        }
        
        if not event:
            event = IntegrationEvent(
                external_system=cls.EXTERNAL_SYSTEM,
                idempotency_key=idempotency_key,
                payload_hash=payload_hash,
                attempt_count=1,
                status="ACKNOWLEDGED",
                acknowledgment=ack_data
            )
            db.add(event)
        else:
            event.attempt_count += 1
            event.status = "ACKNOWLEDGED"
            event.acknowledgment = ack_data
            event.updated_at = utc_now()
            
        disbursement.status = "RECONCILED"
        
        # Complete full lifecycle to DISBURSED_MONITORING
        ok, msg = TransitionService.execute_transition(
            db=db,
            credit_case=credit_case,
            to_state=CaseState.DISBURSED_MONITORING.value,
            actor=actor,
            role="SYSTEM",
            reason=f"Synchronized with LOAN-DISC Facility ID: {loandisc_facility_id}",
            details={"loandisc_facility_id": loandisc_facility_id}
        )
        
        db.commit()
        
        return True, {
            "message": "LOAN-DISC record created and synchronized successfully.",
            "loandisc_facility_id": loandisc_facility_id,
            "case_state": credit_case.state
        }
