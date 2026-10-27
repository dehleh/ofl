"""
Exception Management Router (PRD FR-11, Section 6, Architectural Flowchart)
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from ...database import get_db, utc_now, generate_uuid
from ...models import (
    CreditCase, 
    ExceptionItem, 
    AuditEvent, 
    CaseState,
    ExceptionCategory,
    ExceptionOriginator,
    Approval
)
from ...schemas.schemas import (
    ExceptionRaiseRequest, 
    ExceptionActionRequest, 
    ExceptionResolveRequest
)
from ...core.state_machine import TransitionService

router = APIRouter(prefix="/exceptions", tags=["Exceptions Management"])

# Designated flowchart default owners and SLAs
FLOWCHART_CATEGORY_DEFAULTS = {
    "TECHNICAL_FAILURE": {
        "owner": "IT / Integration Owner",
        "sla_hours": 4,
        "default_return_stage": CaseState.ANALYST_REVIEW.value
    },
    "INTERNAL_CORRECTION": {
        "owner": "Credit Analyst",
        "sla_hours": 24,
        "default_return_stage": CaseState.ANALYST_REVIEW.value
    },
    "REJECTION_RECOMMENDATION": {
        "owner": "Authorised Decision-Maker",
        "sla_hours": 24,
        "default_return_stage": CaseState.MD_DECISION.value
    },
    "RISK_RECONSIDERATION": {
        "owner": "HRM",
        "sla_hours": 24,
        "default_return_stage": CaseState.HRM_REVIEW.value
    },
    "WITHDRAWAL_EXPIRY": {
        "owner": "Credit Operations",
        "sla_hours": 48,
        "default_return_stage": CaseState.WITHDRAWN.value
    },
    "APPLICANT_CORRECTION": {
        "owner": "Credit Analyst / BDO",
        "sla_hours": 48,
        "default_return_stage": CaseState.ANALYST_REVIEW.value
    }
}

@router.get("")
def list_exceptions(
    status_filter: Optional[str] = Query(None),
    category_filter: Optional[str] = Query(None),
    case_id_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns exceptions queue with SLA aging, flowchart category, and case references (FR-11).
    """
    query = db.query(ExceptionItem).join(CreditCase)
    if status_filter:
        query = query.filter(ExceptionItem.status == status_filter)
    if category_filter:
        query = query.filter(ExceptionItem.category == category_filter)
    if case_id_filter:
        query = query.filter(ExceptionItem.case_id == case_id_filter)
        
    items = query.order_by(ExceptionItem.created_at.desc()).all()
    
    results = []
    now = utc_now()
    for ex in items:
        # Compute SLA remaining hours
        sla_hours_left = None
        is_breached = False
        if ex.sla_due_at:
            delta = ex.sla_due_at - (ex.resolved_at or now)
            sla_hours_left = round(delta.total_seconds() / 3600, 1)
            is_breached = sla_hours_left < 0

        results.append({
            "id": ex.id,
            "case_id": ex.case_id,
            "case_number": ex.credit_case.case_number,
            "borrower_name": ex.credit_case.application.customer.name,
            "category": ex.category,
            "originator_role": ex.originator_role,
            "originator_name": ex.originator_name or ex.originator_role,
            "origin_stage": ex.origin_stage,
            "return_stage": ex.return_stage,
            "owner": ex.owner,
            "reason": ex.reason,
            "comments": ex.comments,
            "version": ex.version,
            "sla_hours": ex.sla_hours,
            "sla_due_at": ex.sla_due_at.isoformat() if ex.sla_due_at else None,
            "sla_hours_left": sla_hours_left,
            "is_breached": is_breached,
            "status": ex.status,
            "action_payload": ex.action_payload or {},
            "applicant_action_required": ex.applicant_action_required,
            "applicant_response": ex.applicant_response or {},
            "is_material_change": ex.is_material_change,
            "resolution_category": ex.resolution_category,
            "resolution_notes": ex.resolution_notes,
            "resolved_by": ex.resolved_by,
            "resolved_at": ex.resolved_at.isoformat() if ex.resolved_at else None,
            "created_at": ex.created_at.isoformat()
        })
    return results

@router.get("/{exception_id}")
def get_exception_details(
    exception_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieves full details of a single exception item.
    """
    ex = db.query(ExceptionItem).filter(ExceptionItem.id == exception_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exception not found.")
        
    now = utc_now()
    sla_hours_left = None
    is_breached = False
    if ex.sla_due_at:
        delta = ex.sla_due_at - (ex.resolved_at or now)
        sla_hours_left = round(delta.total_seconds() / 3600, 1)
        is_breached = sla_hours_left < 0

    return {
        "id": ex.id,
        "case_id": ex.case_id,
        "case_number": ex.credit_case.case_number,
        "borrower_name": ex.credit_case.application.customer.name,
        "category": ex.category,
        "originator_role": ex.originator_role,
        "originator_name": ex.originator_name or ex.originator_role,
        "origin_stage": ex.origin_stage,
        "return_stage": ex.return_stage,
        "owner": ex.owner,
        "reason": ex.reason,
        "comments": ex.comments,
        "version": ex.version,
        "sla_hours": ex.sla_hours,
        "sla_due_at": ex.sla_due_at.isoformat() if ex.sla_due_at else None,
        "sla_hours_left": sla_hours_left,
        "is_breached": is_breached,
        "status": ex.status,
        "action_payload": ex.action_payload or {},
        "applicant_action_required": ex.applicant_action_required,
        "applicant_response": ex.applicant_response or {},
        "is_material_change": ex.is_material_change,
        "resolution_category": ex.resolution_category,
        "resolution_notes": ex.resolution_notes,
        "resolved_by": ex.resolved_by,
        "resolved_at": ex.resolved_at.isoformat() if ex.resolved_at else None,
        "created_at": ex.created_at.isoformat()
    }

@router.post("/raise", status_code=status.HTTP_201_CREATED)
def raise_exception(
    payload: ExceptionRaiseRequest,
    db: Session = Depends(get_db)
):
    """
    Raises a new exception adhering to Opticom's 6-category flowchart:
    Applicant / Analyst / HRM / BCC / MD / System -> Record Exception:
    Case ID + Reason + Originator Owner + Comments + SLA + Version.
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == payload.case_id) | (CreditCase.case_number == payload.case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Credit case not found.")

    category_key = payload.category.upper().replace(" ", "_")
    defaults = FLOWCHART_CATEGORY_DEFAULTS.get(category_key, {
        "owner": "Credit Analyst",
        "sla_hours": 24,
        "default_return_stage": credit_case.state
    })

    sla_hours = payload.sla_hours or defaults["sla_hours"]
    sla_due = utc_now() + timedelta(hours=sla_hours)
    assigned_owner = defaults["owner"]
    
    # Return stage defaults to origin stage unless specified otherwise
    return_stage = defaults.get("default_return_stage", credit_case.state)

    action_payload = payload.action_payload or {}
    applicant_req = (category_key == "APPLICANT_CORRECTION")

    exception_item = ExceptionItem(
        case_id=credit_case.id,
        category=category_key,
        originator_role=payload.originator_role.upper(),
        originator_name=payload.originator_name or payload.originator_role,
        origin_stage=credit_case.state,
        owner=assigned_owner,
        return_stage=return_stage,
        reason=payload.reason,
        comments=payload.comments,
        version=credit_case.revision,
        sla_hours=sla_hours,
        sla_due_at=sla_due,
        status="OPEN",
        action_payload=action_payload,
        applicant_action_required=applicant_req
    )
    db.add(exception_item)
    db.flush()

    # Audit event for recording exception
    audit = AuditEvent(
        actor=payload.originator_name or payload.originator_role,
        role=payload.originator_role.upper(),
        event="EXCEPTION_RECORDED",
        entity="CreditCase",
        entity_id=credit_case.case_number,
        correlation_id=generate_uuid(),
        reason=payload.reason,
        details={
            "exception_id": exception_item.id,
            "category": category_key,
            "assigned_owner": assigned_owner,
            "sla_hours": sla_hours,
            "version": credit_case.revision,
            "comments": payload.comments
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(exception_item)

    return {
        "message": f"Exception recorded successfully under category: {category_key}",
        "exception_id": exception_item.id,
        "case_number": credit_case.case_number,
        "category": exception_item.category,
        "assigned_owner": exception_item.owner,
        "sla_due_at": exception_item.sla_due_at.isoformat() if exception_item.sla_due_at else None,
        "status": exception_item.status
    }

@router.post("/{exception_id}/action")
def execute_exception_action(
    exception_id: str,
    payload: ExceptionActionRequest,
    db: Session = Depends(get_db)
):
    """
    Executes an intermediate flowchart step for a category:
    - Branch 1: RETRY_TECHNICAL
    - Branch 3: REJECTION_DECISION (Reject vs Further Assessment)
    - Branch 4: HRM_COORDINATE
    - Branch 5: WITHDRAWAL_DECISION (Close vs Renew)
    - Branch 6: SEND_APPLICANT_REQUEST / APPLICANT_RESPONSE / ANALYST_VALIDATE
    """
    ex = db.query(ExceptionItem).filter(ExceptionItem.id == exception_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exception not found.")
        
    credit_case = ex.credit_case
    action_type = payload.action_type.upper()
    existing_payload = dict(ex.action_payload or {})

    # BRANCH 1: Technical Failure
    if action_type == "RETRY_TECHNICAL":
        retry_count = existing_payload.get("retry_count", 0) + 1
        existing_payload["retry_count"] = retry_count
        existing_payload["last_retry_at"] = utc_now().isoformat()
        existing_payload["last_retry_by"] = payload.actor
        existing_payload["last_retry_notes"] = payload.notes
        ex.action_payload = existing_payload

        if payload.decision == "RESTORE":
            ex.status = "RESOLVED"
            ex.resolved_at = utc_now()
            ex.resolved_by = payload.actor
            ex.resolution_notes = f"Technical integration reconciled: {payload.notes}"
            ex.resolution_category = "RESTORE_STATE"
            # Restore state if needed
            if credit_case.state != ex.return_stage:
                TransitionService.execute_transition(
                    db=db,
                    credit_case=credit_case,
                    to_state=ex.return_stage,
                    actor=payload.actor,
                    role="IT_OWNER",
                    reason="Restored original workflow state following technical reconciliation"
                )

    # BRANCH 3: Rejection Recommendation Decision
    elif action_type == "REJECTION_DECISION":
        if payload.decision == "REJECT":
            # Flowchart: Record Final Rejection (Reason + Authority + Date) -> Release Approved Notification -> Notify Applicant + Close Case
            ex.status = "RESOLVED"
            ex.resolved_at = utc_now()
            ex.resolved_by = payload.actor
            ex.resolution_notes = payload.notes or "Final Rejection confirmed by Authorised Decision-Maker"
            ex.resolution_category = "REJECTED"
            existing_payload["final_rejection"] = {
                "reason": payload.notes,
                "authority": payload.actor,
                "date": utc_now().isoformat()
            }
            ex.action_payload = existing_payload

            # Transition case to REJECTED
            TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=CaseState.REJECTED.value,
                actor=payload.actor,
                role="AUTHORISED_DECISION_MAKER",
                reason=f"Final Rejection: {payload.notes}"
            )
        elif payload.decision == "FURTHER_ASSESSMENT":
            # Flowchart: Route to HRM -> HRM Coordinates Reassessment -> Analyst Revises
            ex.owner = "HRM"
            ex.status = "IN_PROGRESS"
            existing_payload["reassessment_routed_at"] = utc_now().isoformat()
            existing_payload["decision_maker_instructions"] = payload.notes
            ex.action_payload = existing_payload
            
            TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=CaseState.HRM_REVIEW.value,
                actor=payload.actor,
                role="AUTHORISED_DECISION_MAKER",
                reason=f"Routed to HRM for Reassessment: {payload.notes}"
            )

    # BRANCH 4: Risk Reconsideration / HRM Coordination
    elif action_type == "HRM_COORDINATE":
        ex.owner = "Credit Analyst"
        ex.status = "IN_PROGRESS"
        existing_payload["hrm_coordination"] = {
            "coordinated_by": payload.actor,
            "coordinated_at": utc_now().isoformat(),
            "instructions": payload.notes
        }
        ex.action_payload = existing_payload
        
        TransitionService.execute_transition(
            db=db,
            credit_case=credit_case,
            to_state=CaseState.ANALYST_REVIEW.value,
            actor=payload.actor,
            role="HRM",
            reason=f"HRM Reassessment coordination: {payload.notes}"
        )

    # BRANCH 5: Withdrawal / Expiry Rules Validation
    elif action_type == "WITHDRAWAL_DECISION":
        if payload.decision == "CLOSE":
            ex.status = "RESOLVED"
            ex.resolved_at = utc_now()
            ex.resolved_by = payload.actor
            ex.resolution_notes = payload.notes or "Case closed under withdrawal/expiry rules"
            ex.resolution_category = "CLOSED_WITHDRAWN"
            TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=CaseState.WITHDRAWN.value,
                actor=payload.actor,
                role="CREDIT_OPERATIONS",
                reason=f"Withdrawn/Expired: {payload.notes}"
            )
        elif payload.decision == "RENEW":
            ex.status = "RESOLVED"
            ex.resolved_at = utc_now()
            ex.resolved_by = payload.actor
            ex.resolution_notes = payload.notes or "Facility renewal authorized"
            ex.resolution_category = "RENEWED"

    # BRANCH 6: Applicant Correction Loop
    elif action_type == "SEND_APPLICANT_REQUEST":
        ex.applicant_action_required = True
        ex.status = "OPEN"
        existing_payload["applicant_request"] = {
            "requested_by": payload.actor,
            "requested_at": utc_now().isoformat(),
            "message": payload.notes,
            "requested_documents": (payload.details or {}).get("documents", [])
        }
        ex.action_payload = existing_payload

    elif action_type == "APPLICANT_RESPONSE":
        ex.applicant_action_required = False
        ex.status = "IN_PROGRESS"
        ex.applicant_response = {
            "submitted_at": utc_now().isoformat(),
            "notes": payload.notes,
            "documents": (payload.details or {}).get("documents", [])
        }

    elif action_type == "ANALYST_VALIDATE":
        # Check if changes resolve the exception: "Resolved? No -> Send Specific Request; Yes -> Analyst Validates Changes"
        if payload.decision == "NO":
            ex.applicant_action_required = True
            ex.status = "OPEN"
            existing_payload["validation_result"] = {
                "validated": False,
                "feedback": payload.notes,
                "validated_by": payload.actor,
                "validated_at": utc_now().isoformat()
            }
            ex.action_payload = existing_payload
        else:
            existing_payload["validation_result"] = {
                "validated": True,
                "feedback": payload.notes,
                "validated_by": payload.actor,
                "validated_at": utc_now().isoformat()
            }
            ex.action_payload = existing_payload
            ex.status = "IN_PROGRESS"

    db.commit()
    db.refresh(ex)

    return {
        "message": f"Action '{action_type}' processed successfully.",
        "exception_id": ex.id,
        "status": ex.status,
        "applicant_action_required": ex.applicant_action_required,
        "owner": ex.owner,
        "case_state": credit_case.state
    }

@router.post("/{exception_id}/resolve")
def resolve_exception(
    exception_id: str,
    payload: ExceptionResolveRequest,
    db: Session = Depends(get_db)
):
    """
    Resolves an exception item and executes convergence logic (PRD Section 6.1 & Flowchart):
    
    Convergence Decision: Material Credit Change?
    - YES: Invalidate affected approvals -> Restart applicable approval chain.
    - NO: Return to required reviewer with original comments.
    """
    ex = db.query(ExceptionItem).filter(ExceptionItem.id == exception_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exception not found.")
        
    credit_case = ex.credit_case
    ex.status = "RESOLVED"
    ex.resolved_at = utc_now()
    ex.resolved_by = payload.resolved_by
    ex.resolution_notes = payload.resolution_notes
    ex.is_material_change = payload.is_material_change
    ex.resolution_category = payload.resolution_category or "RESOLVED"

    invalidated_approvals_count = 0

    if payload.is_material_change:
        # Flowchart: Invalidate Affected Approvals -> Restart Applicable Approval Chain
        # Bumping terms hash triggers invalidation of any active approvals
        new_terms_hash = f"MATERIAL_EXCEPTION_CHANGE_REV_{credit_case.revision+1}_{utc_now().timestamp()}"
        invalidated_approvals_count = TransitionService.invalidate_approvals_if_material_change(
            db=db,
            credit_case=credit_case,
            new_terms_hash=new_terms_hash,
            actor=payload.resolved_by,
            reason=f"Exception resolution material change: {payload.resolution_notes}"
        )

        # Restart applicable approval chain: return to Analyst Review
        restart_stage = CaseState.ANALYST_REVIEW.value
        TransitionService.execute_transition(
            db=db,
            credit_case=credit_case,
            to_state=restart_stage,
            actor=payload.resolved_by,
            role="EXCEPTION_HANDLER",
            reason=f"Restarting approval chain due to material credit change: {payload.resolution_notes}"
        )
    else:
        # Flowchart: Non-material change -> Return to required reviewer with original comments
        return_stage = payload.return_to_stage or ex.return_stage
        if credit_case.state != return_stage:
            TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=return_stage,
                actor=payload.resolved_by,
                role="EXCEPTION_HANDLER",
                reason=f"Exception resolved (non-material): {payload.resolution_notes}"
            )

    db.commit()
    db.refresh(ex)
    
    return {
        "message": "Exception resolved successfully.",
        "case_state": credit_case.state,
        "is_material_change": payload.is_material_change,
        "invalidated_approvals_count": invalidated_approvals_count,
        "case_revision": credit_case.revision,
        "resolved_at": ex.resolved_at.isoformat()
    }
