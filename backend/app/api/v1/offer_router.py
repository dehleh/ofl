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
from ...core.config_manager import ConfigManager
from ...integrations.notification_service import NotificationService
from pydantic import BaseModel

class CaseFeeUpdateRequest(BaseModel):
    fees: List[Dict[str, Any]]
    actor: Optional[str] = "Credit Analyst"

class CaseFeeCalculateRequest(BaseModel):
    principal: Optional[float] = None
    fees: List[Dict[str, Any]]

router = APIRouter(prefix="/cases/{case_id}", tags=["Offer & Conditions Precedent"])

@router.get("/fees")
def get_case_fees(
    case_id: str,
    db: Session = Depends(get_db)
):
    """
    Returns the applicable facility fee schedule for this credit case,
    calculated against the requested/approved principal amount.
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Case not found.")

    amount = credit_case.application.amount if credit_case.application else 0.0
    latest_offer = db.query(Offer).filter(
        Offer.case_id == credit_case.id
    ).order_by(Offer.issued_at.desc()).first()

    master_catalog = ConfigManager.get_fee_catalog(db)

    # If the case already has a fee schedule saved on an offer, use it
    if latest_offer and latest_offer.fee_schedule:
        fee_items = latest_offer.fee_schedule
    else:
        # Build default fee selection from master catalog
        fee_items = [
            {
                "id": f.get("id"),
                "name": f.get("name"),
                "fee_type": f.get("fee_type", "PERCENTAGE"),
                "rate": f.get("rate", 0.0),
                "is_selected": f.get("is_mandatory_default", True),
                "description": f.get("description", "")
            }
            for f in master_catalog
        ]

    calc_breakdown = ConfigManager.calculate_case_fees(amount, fee_items)
    return {
        "case_id": credit_case.id,
        "case_number": credit_case.case_number,
        "principal": amount,
        "fee_schedule": fee_items,
        "calculation": calc_breakdown
    }

@router.put("/fees")
def update_case_fees(
    case_id: str,
    payload: CaseFeeUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Updates the selected fees and bespoke fee inclusions for a credit case.
    Saves the computed breakdown onto the active or staged Offer record.
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Case not found.")

    amount = credit_case.application.amount if credit_case.application else 0.0
    calc = ConfigManager.calculate_case_fees(amount, payload.fees)

    # Update or associate with latest offer if present
    latest_offer = db.query(Offer).filter(
        Offer.case_id == credit_case.id
    ).order_by(Offer.issued_at.desc()).first()

    if latest_offer:
        latest_offer.fee_schedule = payload.fees
        latest_offer.total_fees = calc["total_fees"]
        latest_offer.net_disbursement = calc["net_disbursement"]
        db.commit()

    return {
        "message": "Case fee schedule updated successfully.",
        "case_id": credit_case.id,
        "case_number": credit_case.case_number,
        "calculation": calc
    }

@router.post("/fees/calculate")
def calculate_preview_fees(
    case_id: str,
    payload: CaseFeeCalculateRequest,
    db: Session = Depends(get_db)
):
    """
    Live real-time preview computation of fees without persisting changes.
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    principal = payload.principal if payload.principal is not None else (
        credit_case.application.amount if credit_case and credit_case.application else 0.0
    )
    calc = ConfigManager.calculate_case_fees(principal, payload.fees)
    return calc

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
    
    # Calculate fee deductions and net disbursement
    selected_fees = payload.fee_schedule
    if not selected_fees:
        master_catalog = ConfigManager.get_fee_catalog(db)
        selected_fees = [
            {
                "id": f.get("id"),
                "name": f.get("name"),
                "fee_type": f.get("fee_type", "PERCENTAGE"),
                "rate": f.get("rate", 0.0),
                "is_selected": f.get("is_mandatory_default", True),
                "description": f.get("description", "")
            }
            for f in master_catalog
        ]
    fee_calc = ConfigManager.calculate_case_fees(amount, selected_fees)

    offer = Offer(
        case_id=credit_case.id,
        terms_hash=terms_hash,
        approved_amount=amount,
        tenor_months=tenor,
        interest_rate_pct=interest_rate,
        monthly_repayment=monthly_repayment,
        issued_at=now,
        expiry=expiry,
        status="ISSUED",
        fee_schedule=fee_calc["itemized_fees"],
        total_fees=fee_calc["total_fees"],
        net_disbursement=fee_calc["net_disbursement"]
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)

    # Multi-channel notification to borrower
    cust = credit_case.application.customer
    NotificationService.notify_offer_issued(
        case_number=credit_case.case_number,
        customer_phone=cust.phone or "+2348024799952",
        customer_email=cust.email or "borrower@example.ng",
        approved_amount=amount,
        tenor_months=tenor,
        monthly_repayment=monthly_repayment
    )
    
    return {
        "message": "Offer generated successfully.",
        "offer_id": offer.id,
        "approved_amount": amount,
        "monthly_repayment": monthly_repayment,
        "total_fees": fee_calc["total_fees"],
        "net_disbursement": fee_calc["net_disbursement"],
        "fee_schedule": fee_calc["itemized_fees"],
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
