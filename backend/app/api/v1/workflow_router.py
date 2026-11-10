"""
Workflow and Approval Decision Router (PRD FR-08, FR-09, FR-10, FR-11, Section 6)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import (
    CreditCase, Approval, ExceptionItem, CaseState, 
    ConditionItem
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
    current_level = payload.role.upper().replace(" ", "_")
    if payload.decision == "APPROVE" and current_level not in ["HRM", "HEAD_OF_RISK_MANAGEMENT", "HEAD_OF_BD", "BD", "BDO_HEAD"]:
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
    db.flush()
    
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
    response_message = f"Approval decision '{payload.decision}' recorded successfully."

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
        # Check previous approvals for this case revision
        past_approvals = db.query(Approval).filter(
            Approval.case_id == credit_case.id,
            Approval.revision == credit_case.revision,
            Approval.invalidated_at.is_(None)
        ).all()

        bcc_approvals = [
            a for a in past_approvals
            if a.authority_level in ["BCC", "BOARD_CREDIT_COMMITTEE"]
            and a.decision in ["APPROVE", "RECOMMEND_APPROVE"]
        ]
        distinct_bcc_actors = list(dict.fromkeys([a.actor for a in bcc_approvals if a.actor]))
        has_bcc_quorum = len(distinct_bcc_actors) >= 2

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
            response_message = "BDO updated customer details and forwarded to Credit Analyst."

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
            response_message = "Credit Analyst recommended case and forwarded to Head of Business Development (MCC)."

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
            response_message = "Head of Business Development (MCC) approved and forwarded to Head of Risk Management."

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
            response_message = "HRM completed risk review and forwarded to Managing Director for final executive sanction."

        elif current_level in ["MD", "MANAGING_DIRECTOR", "CEO", "ADMIN", "SYSADMIN"]:
            # 4. MD approves: If amount <= ₦20m, final approval & offer letter auto-generated; else routes to BCC
            if amount <= AuthorityMatrix.TIER_BCC_THRESHOLD or has_bcc_quorum:
                ok, msg = TransitionService.execute_transition(
                    db=db,
                    credit_case=credit_case,
                    to_state=CaseState.OFFER_PENDING.value,
                    actor=payload.actor,
                    role=payload.role,
                    reason="Managing Director granted executive facility approval; offer letter and legal document suite auto-generated."
                )
                if not ok:
                    raise HTTPException(status_code=400, detail=msg)
                next_state = CaseState.OFFER_PENDING.value
                
                # Auto-generate offer letter and accompanying post-approval legal document suite
                from ...services.approval_document_service import ApprovalDocumentService
                ApprovalDocumentService.generate_case_documents(credit_case=credit_case, db=db)
                NotificationService.auto_generate_and_email_offer_letter(credit_case=credit_case, db=db)
                NotificationService.notify_finance_and_disbursement_initiated(
                    case_number=credit_case.case_number,
                    obligor_name=credit_case.application.customer.name,
                    amount=amount,
                    final_approver=payload.actor,
                    approver_role="Managing Director"
                )
                response_message = "Managing Director granted executive facility approval. Complete legal offer document package auto-generated and dispatched."
            else:
                # Facility > ₦20m mandates Board Credit Committee (BCC) final approval (Quorum: 2 of 3 members)
                ok, msg = TransitionService.execute_transition(
                    db=db,
                    credit_case=credit_case,
                    to_state=CaseState.BCC_REVIEW.value,
                    actor=payload.actor,
                    role=payload.role,
                    reason=f"MD endorsed commercial facility exceeding ₦20m (₦{amount:,.2f}); routed to Board Credit Committee for final sanction (2 of 3 member quorum required)."
                )
                if not ok:
                    raise HTTPException(status_code=400, detail=msg)
                next_state = CaseState.BCC_REVIEW.value
                NotificationService.notify_bcc_board_convened(
                    case_number=credit_case.case_number,
                    obligor_name=credit_case.application.customer.name,
                    amount=amount,
                    md_actor=payload.actor
                )
                response_message = f"Facility exceeds ₦20m (₦{amount:,.2f}). MD approved and routed to Board Credit Committee (BCC) for 2-of-3 quorum sanction."

        elif current_level in ["BCC", "BOARD_CREDIT_COMMITTEE"]:
            # Hard invariant: MD endorsement is mandatory before BCC quorum can approve
            has_md_approval = any(
                a.authority_level in ["MD", "MANAGING_DIRECTOR", "CEO", "ADMIN"] and 
                a.decision in ["APPROVE", "RECOMMEND_APPROVE"]
                for a in past_approvals
            )
            if not has_md_approval:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Managing Director (MD) endorsement is mandatory before Board Credit Committee (BCC) quorum can convene."
                )

            # 5. BCC 2-of-3 Quorum on facilities > ₦20m
            if len(distinct_bcc_actors) >= 2:
                ok, msg = TransitionService.execute_transition(
                    db=db,
                    credit_case=credit_case,
                    to_state=CaseState.OFFER_PENDING.value,
                    actor=payload.actor,
                    role=payload.role,
                    reason=f"Board Credit Committee quorum achieved ({len(distinct_bcc_actors)}/3 members approved: {', '.join(distinct_bcc_actors)}). Final facility approval granted."
                )
                if not ok:
                    raise HTTPException(status_code=400, detail=msg)
                next_state = CaseState.OFFER_PENDING.value
                
                from ...services.approval_document_service import ApprovalDocumentService
                ApprovalDocumentService.generate_case_documents(credit_case=credit_case, db=db)
                NotificationService.auto_generate_and_email_offer_letter(credit_case=credit_case, db=db)
                NotificationService.notify_finance_and_disbursement_initiated(
                    case_number=credit_case.case_number,
                    obligor_name=credit_case.application.customer.name,
                    amount=amount,
                    final_approver=f"BCC Quorum ({', '.join(distinct_bcc_actors)})",
                    approver_role="Board Credit Committee"
                )
                response_message = f"Board Credit Committee quorum achieved ({len(distinct_bcc_actors)}/3 members approved: {', '.join(distinct_bcc_actors)}). Facility approved and legal document package generated."
            else:
                # Quorum not yet reached (e.g. 1 of 2 approved, awaiting 1 more member)
                next_state = CaseState.BCC_REVIEW.value
                NotificationService.notify_bcc_quorum_progress(
                    case_number=credit_case.case_number,
                    obligor_name=credit_case.application.customer.name,
                    approving_actor=payload.actor,
                    approved_count=len(distinct_bcc_actors),
                    required_count=2
                )
                response_message = f"BCC approval recorded for {payload.actor}. Quorum progress: {len(distinct_bcc_actors)} of 2 required Board member approvals recorded (Awaiting 1 more BCC member approval)."

    db.commit()
    db.refresh(credit_case)
    
    return {
        "message": response_message,
        "case_state": next_state,
        "case_revision": credit_case.revision,
        "bcc_quorum": {
            "required": 2,
            "total": 3,
            "approved_count": len(distinct_bcc_actors),
            "approved_members": distinct_bcc_actors,
            "quorum_achieved": len(distinct_bcc_actors) >= 2
        } if current_level in ["BCC", "BOARD_CREDIT_COMMITTEE"] or amount > AuthorityMatrix.TIER_BCC_THRESHOLD else None
    }


@router.get("/bcc-status")
def get_bcc_quorum_status(
    case_id: str,
    db: Session = Depends(get_db)
):
    """
    Returns the BCC 2-of-3 quorum status for facilities exceeding ₦20m.
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Case not found.")

    board_members = [
        {"name": "Emeka Nnamdi", "role": "BCC Chair", "email": "emeka.nnamdi@opticomfinance.com"},
        {"name": "Alhaji Aliyu Dangote", "role": "BCC Member - Risk Trustee", "email": "aliyu.dangote@opticomfinance.com"},
        {"name": "Mrs. Zainab Ahmed", "role": "BCC Member - Legal Trustee", "email": "zainab.ahmed@opticomfinance.com"}
    ]

    past_approvals = db.query(Approval).filter(
        Approval.case_id == credit_case.id,
        Approval.revision == credit_case.revision,
        Approval.invalidated_at.is_(None),
        Approval.authority_level.in_(["BCC", "BOARD_CREDIT_COMMITTEE"]),
        Approval.decision.in_(["APPROVE", "RECOMMEND_APPROVE"])
    ).all()

    approving_actors = {a.actor.lower() for a in past_approvals if a.actor}
    members_status = []
    for bm in board_members:
        has_approved = any(
            bm["name"].lower() in act 
            or bm["email"].lower() in act
            or ("emeka" in act if "emeka" in bm["name"].lower() else False)
            or ("aliyu" in act if "aliyu" in bm["name"].lower() else False)
            or ("zainab" in act if "zainab" in bm["name"].lower() else False)
            for act in approving_actors
        )
        members_status.append({
            "name": bm["name"],
            "role": bm["role"],
            "email": bm["email"],
            "has_approved": has_approved
        })

    approved_count = sum(1 for m in members_status if m["has_approved"])
    if approved_count < len(approving_actors):
        approved_count = len(approving_actors)

    return {
        "case_id": credit_case.id,
        "case_number": credit_case.case_number,
        "amount": credit_case.application.amount if credit_case.application else 0.0,
        "is_bcc_tier": (credit_case.application.amount or 0.0) > AuthorityMatrix.TIER_BCC_THRESHOLD,
        "required_quorum": 2,
        "total_members": 3,
        "approved_count": approved_count,
        "quorum_achieved": approved_count >= 2,
        "members": members_status
    }
