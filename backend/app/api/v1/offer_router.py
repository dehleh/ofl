"""
Offer Management and Conditions Precedent Router (PRD FR-12, FR-13, FR-14)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List, Dict, Any, Optional

from ...database import get_db, utc_now
from ...models import CreditCase, Offer, ConditionItem, CaseState, AuditEvent
from ...schemas.schemas import OfferGenerateRequest, OfferActionRequest, ConditionUpdateRequest
from ...core.state_machine import TransitionService
from ...core.financial_engine import FinancialEngine

router = APIRouter(prefix="/cases/{case_id}", tags=["Offer & Conditions Precedent"])

@router.post("/offer")
def generate_credit_offer(
    case_id: str,
    payload: OfferGenerateRequest,
    db: Session = Depends(get_db)
):
    """
    Generates loan offer letter from approved terms (FR-13).
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    amount = payload.approved_amount or credit_case.application.amount
    tenor = payload.tenor_months or credit_case.application.tenor
    interest_rate = payload.interest_rate_pct or 28.0
    
    monthly_repayment = FinancialEngine.calculate_monthly_installment(
        principal=amount,
        annual_rate=interest_rate / 100.0,
        tenor_months=tenor
    )
    
    terms_hash = TransitionService.calculate_terms_hash(
        amount=amount,
        tenor=tenor,
        interest_rate=interest_rate / 100.0,
        applicant_id=credit_case.application.customer_id
    )
    
    now = utc_now()
    expiry = now + timedelta(days=14)  # 14-day validity
    
    offer = Offer(
        case_id=credit_case.id,
        terms_hash=terms_hash,
        approved_amount=amount,
        tenor_months=tenor,
        interest_rate_pct=interest_rate,
        monthly_repayment=monthly_repayment,
        issued_at=now,
        expiry=expiry,
        status="ISSUED"
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)
    
    return {
        "message": "Offer generated successfully.",
        "offer_id": offer.id,
        "approved_amount": amount,
        "monthly_repayment": monthly_repayment,
        "expiry": expiry.isoformat()
    }

@router.post("/offer/action")
def take_offer_action(
    case_id: str,
    payload: OfferActionRequest,
    db: Session = Depends(get_db)
):
    """
    Applicant acceptance, rejection, or renegotiation of offer terms.
    Renegotiation triggers approval invalidation (FR-12).
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    offer = db.query(Offer).filter(
        Offer.case_id == credit_case.id,
        Offer.status == "ISSUED"
    ).first()
    if not offer:
        raise HTTPException(status_code=400, detail="No active issued offer found for this case.")
        
    if payload.action == "ACCEPT":
        offer.status = "ACCEPTED"
        offer.accepted_at = utc_now()
        offer.acceptance_evidence = payload.acceptance_evidence or "Digital acceptance verified via customer portal."
        
        # Advance to CONDITIONS_PENDING
        TransitionService.execute_transition(
            db=db,
            credit_case=credit_case,
            to_state=CaseState.CONDITIONS_PENDING.value,
            actor="Applicant",
            role="APPLICANT",
            reason="Offer formally accepted by borrower."
        )
        
    elif payload.action == "REJECT":
        offer.status = "REJECTED"
        TransitionService.execute_transition(
            db=db,
            credit_case=credit_case,
            to_state=CaseState.WITHDRAWN.value,
            actor="Applicant",
            role="APPLICANT",
            reason="Offer declined by borrower."
        )
        
    elif payload.action == "RENEGOTIATE":
        offer.status = "RENEGOTIATING"
        # FR-12: Invalidate approvals and route back to HRM Review
        new_terms_hash = f"RENEGOTIATING_{utc_now().timestamp()}"
        TransitionService.invalidate_approvals_if_material_change(
            db=db,
            credit_case=credit_case,
            new_terms_hash=new_terms_hash,
            actor="Applicant",
            reason=f"Customer requested renegotiation: {payload.notes or 'Terms adjustment requested'}"
        )
        TransitionService.execute_transition(
            db=db,
            credit_case=credit_case,
            to_state=CaseState.HRM_REVIEW.value,
            actor="Applicant",
            role="APPLICANT",
            reason="Case re-routed for terms renegotiation."
        )
        
    db.commit()
    return {"message": f"Offer action '{payload.action}' processed.", "case_state": credit_case.state}

@router.put("/conditions/{condition_id}")
def update_condition_status(
    case_id: str,
    condition_id: str,
    payload: ConditionUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Updates condition precedent status (e.g., insurance policy, collateral charge) (FR-14).
    """
    condition = db.query(ConditionItem).filter(
        ConditionItem.id == condition_id,
        ConditionItem.case_id == case_id
    ).first()
    if not condition:
        raise HTTPException(status_code=404, detail="Condition item not found.")
        
    condition.status = payload.status
    condition.evidence_ref = payload.evidence_ref
    condition.verified_by = payload.verified_by
    condition.verified_at = utc_now()
    
    # Check if all mandatory conditions are now satisfied
    credit_case = db.query(CreditCase).filter(CreditCase.id == case_id).first()
    unmet = db.query(ConditionItem).filter(
        ConditionItem.case_id == case_id,
        ConditionItem.mandatory == True,
        ConditionItem.status != "SATISFIED"
    ).count()
    
    ready_for_disbursement = (unmet == 0)
    if ready_for_disbursement and credit_case.state == CaseState.CONDITIONS_PENDING.value:
        TransitionService.execute_transition(
            db=db,
            credit_case=credit_case,
            to_state=CaseState.READY_FOR_DISBURSEMENT.value,
            actor=payload.verified_by,
            role="OPERATIONS",
            reason="All mandatory conditions precedent satisfied; ready for Treasury handoff."
        )
        
    db.commit()
    db.refresh(condition)
    
    return {
        "message": f"Condition updated to {payload.status}.",
        "all_mandatory_conditions_satisfied": ready_for_disbursement,
        "case_state": credit_case.state
    }
