"""
Workflow and Approval Decision Router (PRD FR-08, FR-09, FR-10, FR-11, Section 6)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from ...database import get_db, utc_now
from ...models import (
    CreditCase, Approval, ExceptionItem, CaseState, 
    Offer, ConditionItem
)
from ...schemas.schemas import WorkflowTransitionRequest, ApprovalDecisionRequest
from ...core.state_machine import TransitionService
from ...core.authority_matrix import AuthorityMatrix

router = APIRouter(prefix="/cases/{case_id}", tags=["Workflow & Approvals"])

@router.post("/transition")
def transition_case_state(
    case_id: str,
    payload: WorkflowTransitionRequest,
    db: Session = Depends(get_db)
):
    """
    Executes an authorized state transition with transition invariant checks (Section 6.1).
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    ok, message = TransitionService.execute_transition(
        db=db,
        credit_case=credit_case,
        to_state=payload.to_state,
        actor=payload.actor,
        role=payload.role,
        reason=payload.reason,
        correlation_id=payload.correlation_id,
        details=payload.details
    )
    if not ok:
        raise HTTPException(status_code=400, detail=message)
        
    return {"message": message, "current_state": credit_case.state}

@router.post("/approval")
def submit_approval_decision(
    case_id: str,
    payload: ApprovalDecisionRequest,
    db: Session = Depends(get_db)
):
    """
    Records an official review/approval decision (Analyst, HRM, BCC, MD).
    Enforces delegated authority limits and automated routing to next mandate or Offer Pending.
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    amount = credit_case.application.amount
    terms_hash = TransitionService.calculate_terms_hash(
        amount=amount,
        tenor=credit_case.application.tenor,
        interest_rate=0.28,
        applicant_id=credit_case.application.customer_id
    )
    
    # Check mandate permissions if deciding to APPROVE
    if payload.decision == "APPROVE":
        can_approve, reason = AuthorityMatrix.can_user_approve(payload.role, amount)
        if not can_approve:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Authority limit exceeded: {reason}"
            )
            
    # Record Approval
    approval = Approval(
        case_id=credit_case.id,
        revision=credit_case.revision,
        terms_hash=terms_hash,
        actor=payload.actor,
        authority_level=payload.role.upper(),
        decision=payload.decision,
        comments=payload.comments,
        conditions_mandated=payload.conditions_mandated or []
    )
    db.add(approval)
    
    # Store mandated conditions into condition_items table
    if payload.conditions_mandated:
        for cond_desc in payload.conditions_mandated:
            c_item = ConditionItem(
                case_id=credit_case.id,
                condition_type="PRE_DISBURSEMENT",
                description=cond_desc,
                mandatory=True,
                status="PENDING"
            )
            db.add(c_item)

    # Route based on decision type
    next_state = credit_case.state
    if payload.decision == "RETURN_FOR_REWORK":
        # FR-08, FR-11: Open Exception and return to Analyst Review
        exception_item = ExceptionItem(
            case_id=credit_case.id,
            category="INTERNAL_CAM_CORRECTION",
            origin_stage=credit_case.state,
            owner="Credit Analyst",
            return_stage=CaseState.ANALYST_REVIEW.value,
            reason=f"Rework requested by {payload.role}: {payload.comments}",
            sla_hours=24,
            status="OPEN"
        )
        db.add(exception_item)
        
        ok, msg = TransitionService.execute_transition(
            db=db,
            credit_case=credit_case,
            to_state=CaseState.ANALYST_REVIEW.value,
            actor=payload.actor,
            role=payload.role,
            reason=f"Returned for rework: {payload.comments}"
        )
        next_state = CaseState.ANALYST_REVIEW.value

    elif payload.decision == "REJECT":
        # FR-10: Authorized Final Rejection
        ok, msg = TransitionService.execute_transition(
            db=db,
            credit_case=credit_case,
            to_state=CaseState.REJECTED.value,
            actor=payload.actor,
            role=payload.role,
            reason=f"Official credit decline: {payload.comments}"
        )
        if not ok:
            raise HTTPException(status_code=400, detail=msg)
        next_state = CaseState.REJECTED.value

    elif payload.decision in ["APPROVE", "RECOMMEND_APPROVE"]:
        # Check required chain
        chain = AuthorityMatrix.get_required_approval_chain(amount)
        current_level = payload.role.upper()
        
        # Determine if this level completes the required chain
        highest_required_level = chain[-1]["level"]
        
        if current_level == highest_required_level or payload.decision == "APPROVE":
            # Final authority satisfied -> Advance to OFFER_PENDING
            ok, msg = TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=CaseState.OFFER_PENDING.value,
                actor=payload.actor,
                role=payload.role,
                reason="Facility fully approved by delegated authority; ready for Offer generation."
            )
            next_state = CaseState.OFFER_PENDING.value
        elif current_level == "ANALYST":
            ok, msg = TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=CaseState.HRM_REVIEW.value,
                actor=payload.actor,
                role=payload.role,
                reason="Analyst completed recommendation; routed to Head of Risk Management."
            )
            next_state = CaseState.HRM_REVIEW.value
        elif current_level == "HRM":
            # For > ₦5m, route to BCC
            target_stage = CaseState.BCC_REVIEW.value if amount <= 15_000_000 else CaseState.MD_DECISION.value
            ok, msg = TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=target_stage,
                actor=payload.actor,
                role=payload.role,
                reason=f"HRM endorsed facility; routed to {target_stage} based on authority limits."
            )
            next_state = target_stage
        elif current_level == "BCC":
            ok, msg = TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=CaseState.MD_DECISION.value,
                actor=payload.actor,
                role=payload.role,
                reason="BCC reviewed facility; routed to MD for final decision."
            )
            next_state = CaseState.MD_DECISION.value

    db.commit()
    db.refresh(credit_case)
    
    return {
        "message": f"Approval decision '{payload.decision}' recorded successfully.",
        "case_state": next_state,
        "case_revision": credit_case.revision
    }
