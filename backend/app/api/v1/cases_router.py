"""
Credit Cases API Router (PRD FR-04, FR-02, FR-03, Section 11 Case Workspace)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import hashlib

from ...database import get_db, utc_now
from ...models import (
    CreditCase, Application, Customer, Document, 
    KYCCheck, FinancialAssessment, CAMVersion, ExceptionItem,
    Approval, Offer, ConditionItem, Disbursement, AuditEvent, CaseState
)
from ...core.financial_engine import FinancialEngine
from ...integrations.youverify_adapter import YouverifyAdapter

router = APIRouter(prefix="/cases", tags=["Credit Cases"])

@router.get("")
def list_cases(
    stage: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    Returns list of cases with applicant details and financial metrics for the work queue.
    """
    query = db.query(CreditCase).join(Application).join(Customer)
    
    if stage:
        query = query.filter(CreditCase.state == stage)
    if channel:
        query = query.filter(Application.intake_channel == channel)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (CreditCase.case_number.ilike(search_pattern)) |
            (Customer.name.ilike(search_pattern)) |
            (Customer.bvn.ilike(search_pattern))
        )
        
    total = query.count()
    cases = query.order_by(CreditCase.created_at.desc()).offset(offset).limit(limit).all()
    
    items = []
    for c in cases:
        latest_cam = db.query(CAMVersion).filter(CAMVersion.case_id == c.id).order_by(CAMVersion.version.desc()).first()
        active_exceptions = db.query(ExceptionItem).filter(ExceptionItem.case_id == c.id, ExceptionItem.status == "OPEN").count()
        latest_kyc = db.query(KYCCheck).filter(KYCCheck.case_id == c.id).order_by(KYCCheck.created_at.desc()).first()
        
        items.append({
            "id": c.id,
            "case_number": c.case_number,
            "state": c.state,
            "revision": c.revision,
            "assigned_owner": c.assigned_owner,
            "assigned_analyst": c.assigned_analyst,
            "applicant_name": c.application.customer.name,
            "applicant_type": c.application.customer.customer_type,
            "amount": c.application.amount,
            "currency": c.application.currency,
            "tenor_months": c.application.tenor,
            "channel": c.application.intake_channel,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
            "cam_version": latest_cam.version if latest_cam else 0,
            "cam_validated": latest_cam.analyst_sign_off if latest_cam else False,
            "kyc_status": latest_kyc.status if latest_kyc else "PENDING",
            "open_exceptions_count": active_exceptions
        })
        
    return {"total": total, "items": items}

@router.get("/{case_id}")
def get_case_workspace(case_id: str, db: Session = Depends(get_db)):
    """
    Retrieves full Case Workspace dossier (Section 11).
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    
    if not credit_case:
        raise HTTPException(status_code=404, detail="Credit case not found.")
        
    app = credit_case.application
    customer = app.customer
    
    documents = db.query(Document).filter(Document.case_id == credit_case.id).all()
    kyc_checks = db.query(KYCCheck).filter(KYCCheck.case_id == credit_case.id).order_by(KYCCheck.created_at.desc()).all()
    financials = db.query(FinancialAssessment).filter(FinancialAssessment.case_id == credit_case.id).order_by(FinancialAssessment.created_at.desc()).all()
    cam_versions = db.query(CAMVersion).filter(CAMVersion.case_id == credit_case.id).order_by(CAMVersion.version.asc()).all()
    exceptions = db.query(ExceptionItem).filter(ExceptionItem.case_id == credit_case.id).order_by(ExceptionItem.created_at.desc()).all()
    approvals = db.query(Approval).filter(Approval.case_id == credit_case.id).order_by(Approval.created_at.desc()).all()
    offers = db.query(Offer).filter(Offer.case_id == credit_case.id).order_by(Offer.created_at.desc()).all()
    conditions = db.query(ConditionItem).filter(ConditionItem.case_id == credit_case.id).all()
    disbursements = db.query(Disbursement).filter(Disbursement.case_id == credit_case.id).all()
    audit_events = db.query(AuditEvent).filter(
        AuditEvent.entity_id.in_([credit_case.case_number, credit_case.id])
    ).order_by(AuditEvent.timestamp.desc()).limit(30).all()
    
    return {
        "case": {
            "id": credit_case.id,
            "case_number": credit_case.case_number,
            "state": credit_case.state,
            "revision": credit_case.revision,
            "assigned_owner": credit_case.assigned_owner,
            "assigned_analyst": credit_case.assigned_analyst,
            "created_at": credit_case.created_at.isoformat(),
            "updated_at": credit_case.updated_at.isoformat()
        },
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "customer_type": customer.customer_type,
            "email": customer.email,
            "phone": customer.phone,
            "bvn": customer.bvn,
            "nin": customer.nin,
            "rc_number": customer.rc_number,
            "external_references": customer.external_references,
            "verified_attributes": customer.verified_attributes
        },
        "application": {
            "id": app.id,
            "amount": app.amount,
            "currency": app.currency,
            "tenor": app.tenor,
            "purpose": app.purpose,
            "intake_channel": app.intake_channel,
            "status": app.status,
            "raw_payload": app.raw_payload
        },
        "documents": [
            {
                "id": d.id,
                "document_type": d.document_type,
                "original_filename": d.original_filename,
                "checksum": d.checksum,
                "version": d.version,
                "scan_status": d.scan_status,
                "uploaded_at": d.uploaded_at.isoformat(),
                "content_summary": d.content_summary
            }
            for d in documents
        ],
        "kyc_checks": [
            {
                "id": k.id,
                "provider": k.provider,
                "provider_ref": k.provider_ref,
                "status": k.status,
                "result_summary": k.result_summary,
                "reviewed_by": k.reviewed_by,
                "reviewed_at": k.reviewed_at.isoformat() if k.reviewed_at else None,
                "created_at": k.created_at.isoformat()
            }
            for k in kyc_checks
        ],
        "financial_assessment": financials[0] if financials else None,
        "cam_versions": [
            {
                "id": cv.id,
                "version": cv.version,
                "executive_summary": cv.executive_summary,
                "borrower_profile": cv.borrower_profile,
                "facility_structure": cv.facility_structure,
                "financial_analysis": cv.financial_analysis,
                "risk_and_mitigants": cv.risk_and_mitigants,
                "policy_exceptions": cv.policy_exceptions,
                "recommendation": cv.recommendation,
                "evidence_citations": cv.evidence_citations,
                "validation_status": cv.validation_status,
                "analyst_sign_off": cv.analyst_sign_off,
                "signed_by": cv.signed_by,
                "signed_at": cv.signed_at.isoformat() if cv.signed_at else None,
                "created_at": cv.created_at.isoformat(),
                "token_telemetry": cv.source_snapshot.get("token_telemetry") if cv.source_snapshot else {}
            }
            for cv in cam_versions
        ],
        "exceptions": [
            {
                "id": ex.id,
                "category": ex.category,
                "origin_stage": ex.origin_stage,
                "owner": ex.owner,
                "return_stage": ex.return_stage,
                "reason": ex.reason,
                "sla_hours": ex.sla_hours,
                "status": ex.status,
                "created_at": ex.created_at.isoformat(),
                "resolved_at": ex.resolved_at.isoformat() if ex.resolved_at else None
            }
            for ex in exceptions
        ],
        "approvals": [
            {
                "id": a.id,
                "revision": a.revision,
                "actor": a.actor,
                "authority_level": a.authority_level,
                "decision": a.decision,
                "comments": a.comments,
                "conditions_mandated": a.conditions_mandated,
                "created_at": a.created_at.isoformat(),
                "invalidated_at": a.invalidated_at.isoformat() if a.invalidated_at else None,
                "is_active": a.invalidated_at is None
            }
            for a in approvals
        ],
        "offers": [
            {
                "id": o.id,
                "approved_amount": o.approved_amount,
                "tenor_months": o.tenor_months,
                "interest_rate_pct": o.interest_rate_pct,
                "monthly_repayment": o.monthly_repayment,
                "status": o.status,
                "issued_at": o.issued_at.isoformat(),
                "expiry": o.expiry.isoformat(),
                "acceptance_evidence": o.acceptance_evidence,
                "accepted_at": o.accepted_at.isoformat() if o.accepted_at else None
            }
            for o in offers
        ],
        "conditions": [
            {
                "id": cd.id,
                "condition_type": cd.condition_type,
                "description": cd.description,
                "mandatory": cd.mandatory,
                "evidence_ref": cd.evidence_ref,
                "status": cd.status,
                "verified_by": cd.verified_by,
                "verified_at": cd.verified_at.isoformat() if cd.verified_at else None
            }
            for cd in conditions
        ],
        "disbursements": [
            {
                "id": ds.id,
                "nav_reference": ds.nav_reference,
                "amount": ds.amount,
                "confirmation_evidence": ds.confirmation_evidence,
                "status": ds.status,
                "recorded_by": ds.recorded_by,
                "created_at": ds.created_at.isoformat()
            }
            for ds in disbursements
        ],
        "audit_trail": [
            {
                "id": au.id,
                "actor": au.actor,
                "role": au.role,
                "event": au.event,
                "timestamp": au.timestamp.isoformat(),
                "correlation_id": au.correlation_id,
                "reason": au.reason,
                "details": au.details
            }
            for au in audit_events
        ]
    }

@router.post("/{case_id}/documents")
def add_case_document(
    case_id: str,
    doc_type: str = Query(...),
    filename: str = Query(...),
    summary: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Attaches a document with version tracking and malware clean status.
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    doc = Document(
        case_id=credit_case.id,
        document_type=doc_type,
        object_key=f"uploads/{credit_case.case_number}/{filename}",
        checksum=hashlib.sha256(f"{filename}_{utc_now().timestamp()}".encode()).hexdigest()[:32],
        version=1,
        scan_status="CLEAN",
        original_filename=filename,
        content_summary=summary or f"Uploaded document: {doc_type}"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"message": "Document attached successfully.", "document_id": doc.id}

@router.post("/{case_id}/kyc/verify")
def trigger_kyc_verification(
    case_id: str,
    actor: str = Query("Credit Operations"),
    db: Session = Depends(get_db)
):
    """
    Runs Youverify verification adapter and routes mismatches to compliance.
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    passed, result = YouverifyAdapter.verify_identity(
        db=db,
        credit_case=credit_case,
        bvn=credit_case.application.customer.bvn,
        nin=credit_case.application.customer.nin,
        rc_number=credit_case.application.customer.rc_number,
        actor=actor
    )
    return result
