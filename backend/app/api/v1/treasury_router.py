"""
Treasury Confirmation and LOAN-DISC Synchronisation Router (PRD FR-15, FR-16, Section 11)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from ...database import get_db
from ...models import CreditCase
from ...schemas.schemas import TreasuryDisbursementRequest
from ...integrations.nav_adapter import NavTreasuryAdapter
from ...integrations.loandisc_adapter import LoanDiscAdapter
from ...integrations.notification_service import NotificationService

router = APIRouter(prefix="/cases/{case_id}/treasury", tags=["Treasury & LOAN-DISC"])

@router.get("/packet")
def get_treasury_disbursement_packet(
    case_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieves authorized disbursement packet for Treasury officers (FR-15).
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    packet = NavTreasuryAdapter.generate_disbursement_packet(db, credit_case)
    return packet

@router.post("/confirm")
def record_nav_disbursement(
    case_id: str,
    payload: TreasuryDisbursementRequest,
    db: Session = Depends(get_db)
):
    """
    Records confirmed Microsoft Dynamics NAV facility/disbursement reference.
    Enforces uniqueness and advances case to LOAN-DISC Sync Pending.
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    ok, result = NavTreasuryAdapter.record_confirmed_disbursement(
        db=db,
        credit_case=credit_case,
        nav_reference=payload.nav_reference,
        amount=payload.amount,
        confirmation_evidence=payload.confirmation_evidence,
        actor=payload.actor
    )
    if not ok:
        raise HTTPException(status_code=400, detail=result["error"])
        
    # Multi-channel notification to borrower confirming disbursement
    cust = credit_case.application.customer
    NotificationService.notify_case_disbursed(
        case_number=credit_case.case_number,
        customer_phone=cust.phone or "+2348024799952",
        customer_email=cust.email or "borrower@example.ng",
        amount=payload.amount,
        nav_reference=payload.nav_reference
    )

    return result

@router.post("/sync-loandisc")
def sync_to_loandisc(
    case_id: str,
    actor: str = Query("Credit Operations"),
    db: Session = Depends(get_db)
):
    """
    Pushes confirmed loan facility to LOAN-DISC using idempotent delivery keys (FR-16).
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    ok, result = LoanDiscAdapter.sync_disbursement(
        db=db,
        credit_case=credit_case,
        actor=actor
    )
    if not ok:
        raise HTTPException(status_code=400, detail=result.get("error", "Sync failed"))
        
    return result
