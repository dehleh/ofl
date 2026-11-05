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
from ...integrations.notification_service import NotificationService

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
        chain = AuthorityMatrix.get_required_approval_chain(amount)
        current_level = payload.role.upper().replace(" ", "_")
        
        # Check previous approvals for this case revision
        past_approvals = db.query(Approval).filter(
            Approval.case_id == credit_case.id,
            Approval.revision == credit_case.revision
        ).all()
        has_bd_approval = any(a.authority_level in ["HEAD_OF_BD", "BDO_HEAD", "BD"] for a in past_approvals)
        has_bcc_approval = any(a.authority_level in ["BCC", "BOARD_CREDIT_COMMITTEE"] for a in past_approvals)

        if current_level == "ANALYST":
            # 1. Analyst -> HRM
            ok, msg = TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=CaseState.HRM_REVIEW.value,
                actor=payload.actor,
                role=payload.role,
                reason="Analyst completed CAM and recommendation; routed to Head of Risk Management."
            )
            next_state = CaseState.HRM_REVIEW.value

        elif current_level == "HRM":
            # 2. HRM: If Head of BD has not reviewed yet, HRM endorses and routes to Head of BD!
            if not has_bd_approval:
                ok, msg = TransitionService.execute_transition(
                    db=db,
                    credit_case=credit_case,
                    to_state=CaseState.HEAD_OF_BD_REVIEW.value,
                    actor=payload.actor,
                    role=payload.role,
                    reason="HRM completed initial risk assessment; routed to Head of Business Development for commercial review."
                )
                next_state = CaseState.HEAD_OF_BD_REVIEW.value
            else:
                # 4. BD has already reviewed; now HRM gives final risk concurrence and routes to MD
                target_stage = CaseState.MD_DECISION.value
                ok, msg = TransitionService.execute_transition(
                    db=db,
                    credit_case=credit_case,
                    to_state=target_stage,
                    actor=payload.actor,
                    role=payload.role,
                    reason=f"HRM concurred with BD recommendation; routed to Managing Director for executive approval (Facility: ₦{amount:,.2f})."
                )
                next_state = target_stage

        elif current_level in ["HEAD_OF_BD", "BDO_HEAD", "BD"]:
            # 3. Head of BD provides commercial recommendation/approval -> returns to HRM!
            ok, msg = TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=CaseState.HRM_REVIEW.value,
                actor=payload.actor,
                role=payload.role,
                reason="Head of Business Development completed commercial review; returned to HRM for final risk concurrence."
            )
            next_state = CaseState.HRM_REVIEW.value

        elif current_level in ["MD", "MANAGING_DIRECTOR", "CEO"]:
            # 5. If amount <= ₦20m, MD provides final sanction! If > ₦20m, routes to BCC!
            if amount <= AuthorityMatrix.TIER_BCC_THRESHOLD or has_bcc_approval:
                ok, msg = TransitionService.execute_transition(
                    db=db,
                    credit_case=credit_case,
                    to_state=CaseState.OFFER_PENDING.value,
                    actor=payload.actor,
                    role=payload.role,
                    reason="Managing Director granted final facility approval; ready for Offer letter and disbursement initiation."
                )
                next_state = CaseState.OFFER_PENDING.value
                NotificationService.notify_finance_and_disbursement_initiated(
                    case_number=credit_case.case_number,
                    obligor_name=credit_case.application.customer.name,
                    amount=amount,
                    final_approver=payload.actor,
                    approver_role="Managing Director"
                )
            else:
                # Facility > ₦20m mandates Board Credit Committee (BCC) final approval
                ok, msg = TransitionService.execute_transition(
                    db=db,
                    credit_case=credit_case,
                    to_state=CaseState.BCC_REVIEW.value,
                    actor=payload.actor,
                    role=payload.role,
                    reason=f"MD endorsed commercial facility exceeding ₦20m (₦{amount:,.2f}); routed to Board Credit Committee for final sanction."
                )
                next_state = CaseState.BCC_REVIEW.value

        elif current_level in ["BCC", "BOARD_CREDIT_COMMITTEE"]:
            # 6. BCC final sanction on facilities > ₦20m!
            ok, msg = TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=CaseState.OFFER_PENDING.value,
                actor=payload.actor,
                role=payload.role,
                reason="Board Credit Committee granted final facility approval; ready for Offer letter and disbursement initiation."
            )
            next_state = CaseState.OFFER_PENDING.value
            NotificationService.notify_finance_and_disbursement_initiated(
                case_number=credit_case.case_number,
                obligor_name=credit_case.application.customer.name,
                amount=amount,
                final_approver=payload.actor,
                approver_role="Board Credit Committee"
            )

    db.commit()
    db.refresh(credit_case)
    
    return {
        "message": f"Approval decision '{payload.decision}' recorded successfully.",
        "case_state": next_state,
        "case_revision": credit_case.revision
    }
