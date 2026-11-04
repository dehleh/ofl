"""
Treasury Facility Booking and LOAN-DISC Synchronization Router
Sole Core Banking & LMS Integration for Opticom Finance Limited.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from ...database import get_db
from ...models import CreditCase
from ...schemas.schemas import TreasuryDisbursementRequest
from ...integrations.loandisc_adapter import LoanDiscAdapter

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
        
    packet = LoanDiscAdapter.generate_disbursement_packet(db, credit_case)
    return packet

@router.post("/confirm")
@router.post("/disburse-loandisc")
def book_and_disburse_loandisc(
    case_id: str,
    payload: Optional[TreasuryDisbursementRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Directly books and syncs authorized credit facility into LOAN-DISC automatically in 1 click (FR-15 / FR-16).
    Enforces idempotency, creates repayment schedule, and advances case to Disbursed / Monitoring.
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    req = payload or TreasuryDisbursementRequest()
    ref = req.disbursement_reference or req.nav_reference
    
    ok, result = LoanDiscAdapter.book_and_disburse(
        db=db,
        credit_case=credit_case,
        amount=req.amount or credit_case.application.amount,
        disbursement_reference=ref,
        confirmation_evidence=req.confirmation_evidence,
        actor=req.actor or "Treasury Officer"
    )
    if not ok:
        raise HTTPException(status_code=400, detail=result.get("error", "Booking failed"))

    return result

@router.post("/sync-loandisc")
def sync_to_loandisc(
    case_id: str,
    actor: str = Query("Treasury Operations"),
    db: Session = Depends(get_db)
):
    """
    Pushes or retries loan facility synchronization with LOAN-DISC using idempotent delivery keys (FR-16).
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
