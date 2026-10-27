"""
Credit Appraisal Memorandum (CAM) Router (PRD FR-06, FR-07, Section 11)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from ...database import get_db, utc_now
from ...models import CreditCase, CAMVersion, FinancialAssessment, AuditEvent, CaseState
from ...schemas.schemas import CAMUpdateRequest
from ...integrations.vertex_ai_service import VertexAICamService
from ...core.state_machine import TransitionService

router = APIRouter(prefix="/cases/{case_id}/cam", tags=["CAM Management"])

@router.post("/generate", status_code=status.HTTP_201_CREATED)
def generate_ai_cam(
    case_id: str,
    actor: str = Query("Credit Analyst"),
    db: Session = Depends(get_db)
):
    """
    Invokes Google Cloud Vertex AI (Gemini) CAM service to draft structured narrative and extract source citations.
    Calculations strictly drawn from deterministic financial assessment (FR-06, FR-28).
    """
    credit_case = db.query(CreditCase).filter(
        (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
    ).first()
    if not credit_case:
        raise HTTPException(status_code=404, detail="Case not found.")
        
    assessment = db.query(FinancialAssessment).filter(
        FinancialAssessment.case_id == credit_case.id
    ).order_by(FinancialAssessment.created_at.desc()).first()
    
    if not assessment:
        raise HTTPException(status_code=400, detail="Cannot draft CAM: Financial assessment has not been generated.")
        
    cam = VertexAICamService.generate_draft_cam(
        db=db,
        credit_case=credit_case,
        financial_assessment=assessment,
        actor=actor
    )
    db.commit()
    db.refresh(cam)
    
    return {
        "message": f"CAM Version {cam.version} generated successfully.",
        "version": cam.version,
        "cam_id": cam.id,
        "executive_summary": cam.executive_summary,
        "evidence_citations": cam.evidence_citations,
        "token_telemetry": cam.source_snapshot.get("token_telemetry")
    }

@router.put("/{version_id}")
def update_cam_version(
    case_id: str,
    version_id: str,
    payload: CAMUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Allows Credit Analyst to edit narrative sections and apply mandatory analyst sign-off (FR-06, FR-07).
    """
    cam = db.query(CAMVersion).filter(
        CAMVersion.id == version_id,
        CAMVersion.case_id == case_id
    ).first()
    if not cam:
        raise HTTPException(status_code=404, detail="CAM version not found.")
        
    if payload.executive_summary is not None:
        cam.executive_summary = payload.executive_summary
    if payload.borrower_profile is not None:
        cam.borrower_profile = payload.borrower_profile
    if payload.facility_structure is not None:
        cam.facility_structure = payload.facility_structure
    if payload.financial_analysis is not None:
        cam.financial_analysis = payload.financial_analysis
    if payload.risk_and_mitigants is not None:
        cam.risk_and_mitigants = payload.risk_and_mitigants
    if payload.policy_exceptions is not None:
        cam.policy_exceptions = payload.policy_exceptions
    if payload.recommendation is not None:
        cam.recommendation = payload.recommendation
        
    if payload.analyst_sign_off:
        cam.analyst_sign_off = True
        cam.signed_by = payload.actor
        cam.signed_at = utc_now()
        cam.validation_status = "ANALYST_VALIDATED"
        
        # Advance case to HRM Review if in Analyst Review
        credit_case = db.query(CreditCase).filter(CreditCase.id == case_id).first()
        if credit_case and credit_case.state == CaseState.ANALYST_REVIEW.value:
            TransitionService.execute_transition(
                db=db,
                credit_case=credit_case,
                to_state=CaseState.HRM_REVIEW.value,
                actor=payload.actor,
                role="ANALYST",
                reason=f"Analyst validated and signed off CAM v{cam.version}"
            )
            
    db.commit()
    db.refresh(cam)
    
    return {
        "message": f"CAM Version {cam.version} updated successfully.",
        "analyst_signed_off": cam.analyst_sign_off,
        "validation_status": cam.validation_status
    }

@router.get("/versions")
def get_cam_versions(case_id: str, db: Session = Depends(get_db)):
    """
    Returns all numbered CAM versions for comparison (FR-07, Section 11).
    """
    versions = db.query(CAMVersion).filter(
        CAMVersion.case_id == case_id
    ).order_by(CAMVersion.version.asc()).all()
    
    return [
        {
            "id": v.id,
            "version": v.version,
            "executive_summary": v.executive_summary,
            "recommendation": v.recommendation,
            "analyst_sign_off": v.analyst_sign_off,
            "signed_by": v.signed_by,
            "created_at": v.created_at.isoformat()
        }
        for v in versions
    ]
