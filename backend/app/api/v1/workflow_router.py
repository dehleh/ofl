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
    current_level = payload.role.upper().replace(" ", "_")

    if payload.decision in ["RETURN_FOR_REWORK", "RETURN_TO_BDO"]:
        # Evaluate return originator and route to appropriate prior stage with stakeholder alerts
        if current_level in ["ANALYST", "CREDIT_ANALYST"] or payload.decision == "RETURN_TO_BDO":
            target_stage = CaseState.BDO_REWORK.value
            owner = "Business Development Officer"
            reason = f"Analyst requested missing details/clarification from BDO: {payload.comments}"
        elif current_level in ["HEAD_OF_BD", "BDO_HEAD", "BD"]:
            target_stage = CaseState.ANALYST_REVIEW.value
            owner = "Credit Analyst"
            reason = f"MCC (Head of BD) returned application to Credit Analyst: {payload.comments}"
        elif current_level in ["HRM", "HEAD_OF_RISK_MANAGEMENT"]:
            target_stage = CaseState.ANALYST_REVIEW.value
            owner = "Credit Analyst"
            reason = f"HRM Risk Exception returned to Credit Analyst: {payload.comments}"
            # Notify Credit Analyst and Head of BD simultaneously
            NotificationService.notify_hrm_exception_to_analyst_and_bd(
                case_number=credit_case.case_number,
                obligor_name=credit_case.application.customer.name,
                hrm_actor=payload.actor,
                exception_query=payload.comments
            )
        elif current_level in ["MD", "MANAGING_DIRECTOR", "CEO", "ADMIN", "SYSADMIN"]:
            # MD can return to either HRM (default) or Head of BD
            target_pref = (payload.target_role or "HRM").upper().replace(" ", "_")
            if target_pref in ["HEAD_OF_BD", "BD", "BDO_HEAD"]:
                target_stage = CaseState.HEAD_OF_BD_REVIEW.value
                owner = "Head of Business Development"
            else:
                target_stage = CaseState.HRM_REVIEW.value
                owner = "Head of Risk Management"
            reason = f"MD Executive Query returned to {owner}: {payload.comments}"
            # Notify Analyst, HRM, and Head of BD of MD's return
            NotificationService.notify_md_return_to_stakeholders(
                case_number=credit_case.case_number,
                obligor_name=credit_case.application.customer.name,
                md_actor=payload.actor,
                md_reservation=payload.comments,
                target_role=owner
            )
        else:
            target_stage = CaseState.ANALYST_REVIEW.value
            owner = "Credit Analyst"
            reason = f"Returned for rework by {payload.role}: {payload.comments}"

        exception_item = ExceptionItem(
            case_id=credit_case.id,
            category="INTERNAL_CAM_CORRECTION",
            origin_stage=credit_case.state,
            owner=owner,
            return_stage=target_stage,
            reason=reason,
            sla_hours=24,
            status="OPEN"
        )
        db.add(exception_item)
        
        ok, msg = TransitionService.execute_transition(
            db=db,
            credit_case=credit_case,
            to_state=target_stage,
            actor=payload.actor,
            role=payload.role,
            reason=reason
        )
        if not ok:
            raise HTTPException(status_code=400, detail=msg)
        next_state = target_stage

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

    elif payload.decision in ["APPROVE", "RECOMMEND_APPROVE", "RESUBMIT"]:
        chain = AuthorityMatrix.get_required_approval_chain(amount)
        
        # Check previous approvals for this case revision
        past_approvals = db.query(Approval).filter(
            Approval.case_id == credit_case.id,
            Approval.revision == credit_case.revision
        ).all()
        has_bcc_approval = any(a.authority_level in ["BCC", "BOARD_CREDIT_COMMITTEE"] for a in past_approvals)

        if current_level in ["BDO", "BUSINESS_DEV_OFFICER", "BUSINESS_DEVELOPMENT_OFFICER"]:
            # BDO re-submits application details to Credit Analyst
            ok, msg = TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=CaseState.ANALYST_REVIEW.value,
                actor=payload.actor,
                role=payload.role,
                reason=f"BDO updated customer application details; re-submitted to Credit Analyst: {payload.comments}"
            )
            if not ok:
                raise HTTPException(status_code=400, detail=msg)
            next_state = CaseState.ANALYST_REVIEW.value

        elif current_level in ["ANALYST", "CREDIT_ANALYST"]:
            # 1. Analyst -> Head of Business Development (First reviewer in MCC)
            ok, msg = TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=CaseState.HEAD_OF_BD_REVIEW.value,
                actor=payload.actor,
                role=payload.role,
                reason="Credit Analyst completed CAM & recommendation; forwarded to Management Credit Committee (Head of BD)."
            )
            if not ok:
                raise HTTPException(status_code=400, detail=msg)
            next_state = CaseState.HEAD_OF_BD_REVIEW.value
            NotificationService.notify_mcc_head_of_bd_assignment(
                case_number=credit_case.case_number,
                obligor_name=credit_case.application.customer.name,
                amount=amount,
                analyst_actor=payload.actor
            )

        elif current_level in ["HEAD_OF_BD", "BDO_HEAD", "BD"]:
            # 2. Head of Business Development (MCC) -> HRM
            ok, msg = TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=CaseState.HRM_REVIEW.value,
                actor=payload.actor,
                role=payload.role,
                reason="Head of Business Development (MCC) satisfied and approved; forwarded to Head of Risk Management."
            )
            if not ok:
                raise HTTPException(status_code=400, detail=msg)
            next_state = CaseState.HRM_REVIEW.value

        elif current_level in ["HRM", "HEAD_OF_RISK_MANAGEMENT"]:
            # 3. HRM -> MD
            target_stage = CaseState.MD_DECISION.value
            ok, msg = TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=target_stage,
                actor=payload.actor,
                role=payload.role,
                reason=f"HRM satisfied with credit risk appraisal; forwarded to Managing Director for executive approval (Facility: ₦{amount:,.2f})."
            )
            if not ok:
                raise HTTPException(status_code=400, detail=msg)
            next_state = target_stage

        elif current_level in ["MD", "MANAGING_DIRECTOR", "CEO", "ADMIN", "SYSADMIN"]:
            # 4. MD approves: If amount <= ₦20m, final approval & offer letter auto-generated; else routes to BCC
            if amount <= AuthorityMatrix.TIER_BCC_THRESHOLD or has_bcc_approval:
                ok, msg = TransitionService.execute_transition(
                    db=db,
                    credit_case=credit_case,
                    to_state=CaseState.OFFER_PENDING.value,
                    actor=payload.actor,
                    role=payload.role,
                    reason="Managing Director granted executive facility approval; offer letter auto-generated and dispatched."
                )
                if not ok:
                    raise HTTPException(status_code=400, detail=msg)
                next_state = CaseState.OFFER_PENDING.value
                
                # Auto-generate offer letter and email applicant
                NotificationService.auto_generate_and_email_offer_letter(credit_case=credit_case, db=db)
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
                if not ok:
                    raise HTTPException(status_code=400, detail=msg)
                next_state = CaseState.BCC_REVIEW.value

        elif current_level in ["BCC", "BOARD_CREDIT_COMMITTEE"]:
            # 5. BCC final sanction on facilities > ₦20m
            ok, msg = TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=CaseState.OFFER_PENDING.value,
                actor=payload.actor,
                role=payload.role,
                reason="Board Credit Committee granted final facility approval; offer letter auto-generated and dispatched."
            )
            if not ok:
                raise HTTPException(status_code=400, detail=msg)
            next_state = CaseState.OFFER_PENDING.value
            
            NotificationService.auto_generate_and_email_offer_letter(credit_case=credit_case, db=db)
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
