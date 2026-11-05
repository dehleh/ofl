"""
Intake Router: Direct OFL Applications (>₦2m) and BESTO Inbound Webhook/Batch (PRD FR-01, Section 17.1 - 17.4)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Header, Request
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import hashlib
import json

from ...database import get_db, utc_now
from ...config import settings
from ...models import (
    Customer, Application, CreditCase, Document, 
    FinancialAssessment, IntegrationEvent, CaseState, IntakeChannel,
    ExceptionItem, AuditEvent
)
from ...schemas.schemas import DirectApplicationCreate, BestoInboundPayload
from ...core.financial_engine import FinancialEngine
from ...core.webhook_security import verify_hmac_signature
from ...core.config_manager import ConfigManager
from ...integrations.besto_adapter import BestoAdapter

router = APIRouter(prefix="/intake", tags=["Application Intake"])

@router.get("/pricing-policy")
def get_public_pricing_policy(db: Session = Depends(get_db)):
    """
    Public pricing policy endpoint returning active Central Bank of Nigeria (CBN)
    Monetary Policy Rate (MPR), Opticom commercial risk spread, effective APR,
    and upfront fee benchmarks for public repayment calculators.
    """
    return ConfigManager.get_pricing_policy(db)

@router.post("/direct", status_code=status.HTTP_201_CREATED)
def submit_direct_application(
    payload: DirectApplicationCreate,
    db: Session = Depends(get_db)
):
    """
    Submits a high-value direct loan application (> ₦2,000,000) through OFL Portal.
    Rejects or redirects <= ₦2,000,000 applications to BESTO (PRD Section 17.1).
    """
    if payload.amount <= settings.BESTO_MAX_AMOUNT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "CANONICAL_ROUTING_REDIRECTION",
                "message": (
                    f"Loan applications of ₦{payload.amount:,.2f} (<= ₦2,000,000) belong to the BESTO lower-value origination channel. "
                    "Please submit via BESTO or use the BESTO Ingestion endpoint."
                ),
                "threshold_boundary": settings.BESTO_MAX_AMOUNT,
                "recommended_channel": "BESTO"
            }
        )
        
    # Check or create Customer
    customer = None
    if payload.bvn:
        customer = db.query(Customer).filter(Customer.bvn == payload.bvn).first()
        
    if not customer:
        customer = Customer(
            customer_type=payload.applicant_type,
            name=payload.applicant_name,
            email=payload.email,
            phone=payload.phone,
            bvn=payload.bvn,
            nin=payload.nin,
            rc_number=payload.rc_number,
            external_references={"channel": "OFL_DIRECT"}
        )
        db.add(customer)
        db.flush()
        
    # Create Application
    application = Application(
        customer_id=customer.id,
        amount=payload.amount,
        currency="NGN",
        tenor=payload.tenor_months,
        purpose=payload.purpose,
        intake_channel=IntakeChannel.OFL_DIRECT.value,
        status="SUBMITTED",
        applicant_type=payload.applicant_type,
        raw_payload=payload.model_dump()
    )
    db.add(application)
    db.flush()
    
    # Generate Case Number
    case_count = db.query(CreditCase).count() + 1
    case_number = f"OFL-{utc_now().year}-{case_count:05d}"
    
    # Create CreditCase (Initial stage: KYC Pending / Analyst Review)
    credit_case = CreditCase(
        application_id=application.id,
        case_number=case_number,
        state=CaseState.KYC_PENDING.value,
        revision=1,
        assigned_owner="Credit Analyst Queue"
    )
    db.add(credit_case)
    db.flush()
    
    # Attach initial uploaded documents if provided
    if payload.documents:
        for doc in payload.documents:
            d = Document(
                case_id=credit_case.id,
                document_type=doc.get("type", "BANK_STATEMENT"),
                object_key=doc.get("object_key", f"direct/{case_number}/{doc.get('name', 'file')}"),
                checksum=hashlib.sha256(doc.get("name", "file").encode()).hexdigest()[:32],
                version=1,
                scan_status="CLEAN",
                original_filename=doc.get("name", "document.pdf"),
                content_summary=doc.get("summary", "Attached during direct application submission")
            )
            db.add(d)
            
    # Compute Initial Deterministic Financial Assessment (FR-05)
    financial_inputs = {
        "requested_amount": payload.amount,
        "tenor_months": payload.tenor_months,
        "applicant_type": payload.applicant_type,
        "verified_monthly_income": payload.monthly_income,
        "existing_monthly_debt": payload.existing_monthly_debt,
        "estimated_monthly_expenses": payload.estimated_monthly_expenses,
        "collateral_value": payload.collateral_value
    }
    evaluation = FinancialEngine.evaluate(financial_inputs)
    
    financial_assessment = FinancialAssessment(
        case_id=credit_case.id,
        formula_version=evaluation["formula_version"],
        input_snapshot=financial_inputs,
        calculated_ratios=evaluation["calculated_ratios"],
        policy_flags=evaluation["policy_flags"],
        performed_by="Deterministic Financial Rules Engine"
    )
    db.add(financial_assessment)
    
    db.commit()
    db.refresh(credit_case)
    
    return {
        "message": "Direct OFL application submitted successfully.",
        "case_number": credit_case.case_number,
        "case_id": credit_case.id,
        "state": credit_case.state,
        "financial_summary": evaluation["calculated_ratios"],
        "policy_flags": evaluation["policy_flags"]
    }

@router.post("/besto", status_code=status.HTTP_200_OK)
async def ingest_besto_application(
    request: Request,
    payload: BestoInboundPayload,
    x_signature_sha256: Optional[str] = Header(None, alias="X-Signature-SHA256"),
    db: Session = Depends(get_db)
):
    """
    Webhook/API endpoint for inbound BESTO applications (₦300k - ₦2m).
    Enforces HMAC-SHA256 signature verification, idempotency on (source_system, source_application_id) and quarantine handling.
    """
    if x_signature_sha256:
        body_bytes = await request.body()
        if not verify_hmac_signature(body_bytes, x_signature_sha256):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook HMAC SHA-256 signature."
            )

    ok, result = BestoAdapter.ingest_payload(db, payload.model_dump())
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result
        )
    return result

@router.post("/webhooks/youverify")
async def youverify_webhook_handler(
    request: Request,
    x_youverify_signature: Optional[str] = Header(None, alias="x-youverify-signature"),
    db: Session = Depends(get_db)
):
    """
    Inbound webhook receiver for Youverify asynchronous background verifications & status updates.
    Verifies HMAC-SHA256 signature using settings.YOUVERIFY_WEBHOOK_SECRET.
    """
    body_bytes = await request.body()
    webhook_secret = getattr(settings, "YOUVERIFY_WEBHOOK_SECRET", "tKQglemsJkFw4Ci6HoVMQstDsm13ZwfuYXNG")
    
    if x_youverify_signature:
        if not verify_hmac_signature(body_bytes, x_youverify_signature, secret=webhook_secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Youverify webhook HMAC signature."
            )
            
    payload = {}
    try:
        payload = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
    except Exception:
        payload = {}

    event_type = payload.get("event") or payload.get("type", "UNKNOWN")
    data = payload.get("data", {})
    provider_ref = data.get("id") or data.get("verificationId") or f"YV-WEBHOOK-{utc_now().strftime('%Y%m%d%H%M%S')}"

    # Log integration event
    event_log = IntegrationEvent(
        external_system="YOUVERIFY",
        idempotency_key=f"YV-{provider_ref}-{event_type}",
        payload=payload,
        status="PROCESSED"
    )
    db.add(event_log)
    db.commit()

    return {"status": "received", "event": event_type, "provider_ref": provider_ref}

@router.get("/besto/quarantine")
def list_quarantined_payloads(db: Session = Depends(get_db)):
    """
    Returns list of quarantined BESTO submissions for ops inspection (Section 17.4).
    """
    events = db.query(IntegrationEvent).filter(
        IntegrationEvent.external_system == "BESTO",
        IntegrationEvent.status == "FAILED"
    ).order_by(IntegrationEvent.created_at.desc()).all()
    
    return [
        {
            "id": e.id,
            "idempotency_key": e.idempotency_key,
            "error_details": e.error_details,
            "attempt_count": e.attempt_count,
            "created_at": e.created_at.isoformat()
        }
        for e in events
    ]

@router.get("/track/{case_number}")
def track_application_status(
    case_number: str,
    db: Session = Depends(get_db)
):
    """
    Public tracking endpoint for loan applicants.
    Returns safe customer-facing status without exposing private risk deliberations or CAM notes.
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.case_number == case_number) | (CreditCase.id == case_number)
    ).first()
    if not credit_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Application reference not found. Please verify your reference number."
        )

    app_rec = credit_case.application
    cust = app_rec.customer

    state_labels = {
        CaseState.DRAFT.value: "Application Draft",
        CaseState.SUBMITTED.value: "Application Submitted",
        CaseState.KYC_PENDING.value: "Identity & Document Verification",
        CaseState.ANALYST_REVIEW.value: "Credit Appraisal & Underwriting",
        CaseState.HRM_REVIEW.value: "Risk Management Assessment",
        CaseState.BCC_REVIEW.value: "Credit Committee Review",
        CaseState.MD_DECISION.value: "Executive Sanction",
        CaseState.OFFER_PENDING.value: "Offer Letter Issued",
        CaseState.CONDITIONS_PENDING.value: "Offer Accepted - Conditions Precedent Pending",
        CaseState.READY_FOR_DISBURSEMENT.value: "Disbursement Scheduled",
        CaseState.TREASURY_CONFIRMATION_PENDING.value: "Treasury Confirmation Pending",
        CaseState.LOANDISC_SYNC_PENDING.value: "Core Banking Account Provisioning",
        CaseState.DISBURSED_MONITORING.value: "Facility Disbursed",
        CaseState.REJECTED.value: "Application Declined",
        CaseState.WITHDRAWN.value: "Application Withdrawn"
    }

    # Check for pending applicant action items (Flowchart Branch 6: Applicant Correction)
    pending_ex = db.query(ExceptionItem).filter(
        ExceptionItem.case_id == credit_case.id,
        ExceptionItem.status != "RESOLVED",
        ExceptionItem.applicant_action_required == True
    ).first()

    applicant_action = None
    if pending_ex:
        req_info = (pending_ex.action_payload or {}).get("applicant_request", {})
        applicant_action = {
            "exception_id": pending_ex.id,
            "category": pending_ex.category,
            "reason": pending_ex.reason,
            "instructions": req_info.get("message") or pending_ex.comments or pending_ex.reason,
            "requested_documents": req_info.get("requested_documents", []),
            "sla_due_at": pending_ex.sla_due_at.isoformat() if pending_ex.sla_due_at else None
        }

    message = (
        "Action Required: Additional documentation or clarification requested by your Underwriter." if applicant_action
        else "Congratulations! Your facility has been disbursed." if credit_case.state == CaseState.DISBURSED_MONITORING.value
        else "Your loan offer has been issued! Please review terms with your Relationship Manager." if credit_case.state == CaseState.OFFER_PENDING.value
        else "Your credit application has been received and is being appraised by our credit team."
    )

    return {
        "case_number": credit_case.case_number,
        "applicant_name": cust.name,
        "amount": app_rec.amount,
        "tenor": app_rec.tenor,
        "purpose": app_rec.purpose,
        "submitted_at": app_rec.created_at.isoformat(),
        "status_code": credit_case.state,
        "status_label": state_labels.get(credit_case.state, "Processing"),
        "has_active_offer": credit_case.state in [CaseState.OFFER_PENDING.value, CaseState.CONDITIONS_PENDING.value],
        "applicant_action": applicant_action,
        "message": message
    }

@router.post("/track/{case_number}/respond-exception")
def respond_to_applicant_exception(
    case_number: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    Public endpoint for loan applicants to fulfill Applicant Correction requests (Flowchart Branch 6).
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.case_number == case_number) | (CreditCase.id == case_number)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Application reference not found.")

    exception_id = payload.get("exception_id")
    query = db.query(ExceptionItem).filter(
        ExceptionItem.case_id == credit_case.id,
        ExceptionItem.status != "RESOLVED"
    )
    if exception_id:
        query = query.filter(ExceptionItem.id == exception_id)
    else:
        query = query.filter(ExceptionItem.applicant_action_required == True)

    ex = query.first()
    if not ex:
        raise HTTPException(status_code=400, detail="No active applicant clarification request found for this application.")

    notes = payload.get("notes", "Clarification provided by applicant via portal")
    docs = payload.get("documents", [])

    # Attach any newly provided documents
    if docs:
        for doc in docs:
            d = Document(
                case_id=credit_case.id,
                document_type=doc.get("type", "ADDITIONAL_EVIDENCE"),
                object_key=doc.get("object_key", f"direct/{credit_case.case_number}/{doc.get('name', 'replacement_file')}"),
                checksum=hashlib.sha256(doc.get("name", "replacement_file").encode()).hexdigest()[:32],
                version=credit_case.revision,
                scan_status="CLEAN",
                original_filename=doc.get("name", "replacement_doc.pdf"),
                content_summary=doc.get("summary", "Uploaded by applicant in response to exception correction")
            )
            db.add(d)

    ex.applicant_action_required = False
    ex.status = "IN_PROGRESS"
    ex.applicant_response = {
        "submitted_at": utc_now().isoformat(),
        "notes": notes,
        "documents": [d.get("name") for d in docs] if docs else []
    }

    # Audit event
    audit = AuditEvent(
        actor="Applicant",
        role="APPLICANT",
        event="APPLICANT_EXCEPTION_FULFILLED",
        entity="CreditCase",
        entity_id=credit_case.case_number,
        correlation_id=ex.id,
        reason=notes,
        details={"documents_count": len(docs), "exception_id": ex.id}
    )
    db.add(audit)
    db.commit()

    return {
        "message": "Information and documents submitted successfully. Your Underwriter will review the updates shortly.",
        "case_number": credit_case.case_number,
        "exception_id": ex.id,
        "status": ex.status
    }

