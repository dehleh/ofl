"""
Exception Management Router (PRD FR-11, Section 6)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from ...database import get_db, utc_now
from ...models import CreditCase, ExceptionItem, AuditEvent, CaseState
from ...schemas.schemas import ExceptionResolveRequest
from ...core.state_machine import TransitionService

router = APIRouter(prefix="/exceptions", tags=["Exceptions Management"])

@router.get("")
def list_exceptions(
    status_filter: Optional[str] = Query("OPEN"),
    db: Session = Depends(get_db)
):
    """
    Returns exceptions queue with SLA aging and case references (FR-11).
    """
    query = db.query(ExceptionItem).join(CreditCase)
    if status_filter:
        query = query.filter(ExceptionItem.status == status_filter)
        
    items = query.order_by(ExceptionItem.created_at.desc()).all()
    return [
        {
            "id": ex.id,
            "case_id": ex.case_id,
            "case_number": ex.credit_case.case_number,
            "borrower_name": ex.credit_case.application.customer.name,
            "category": ex.category,
            "origin_stage": ex.origin_stage,
            "return_stage": ex.return_stage,
            "owner": ex.owner,
            "reason": ex.reason,
            "sla_hours": ex.sla_hours,
            "status": ex.status,
            "created_at": ex.created_at.isoformat()
        }
        for ex in items
    ]

@router.post("/{exception_id}/resolve")
def resolve_exception(
    exception_id: str,
    payload: ExceptionResolveRequest,
    db: Session = Depends(get_db)
):
    """
    Resolves an exception item and returns the case to its required workflow stage (FR-11).
    """
    exception_item = db.query(ExceptionItem).filter(ExceptionItem.id == exception_id).first()
    if not exception_item:
        raise HTTPException(status_code=404, detail="Exception not found.")
        
    exception_item.status = "RESOLVED"
    exception_item.resolved_at = utc_now()
    
    credit_case = exception_item.credit_case
    return_stage = payload.return_to_stage or exception_item.return_stage
    
    # If case was parked or returned, transition back to return_stage
    if credit_case.state != return_stage:
        TransitionService.execute_transition(
            db=db,
            credit_case=credit_case,
            to_state=return_stage,
            actor=payload.resolved_by,
            role="EXCEPTION_HANDLER",
            reason=f"Exception resolved: {payload.resolution_notes}"
        )
        
    db.commit()
    db.refresh(exception_item)
    
    return {
        "message": "Exception resolved successfully.",
        "case_state": credit_case.state,
        "resolved_at": exception_item.resolved_at.isoformat()
    }
