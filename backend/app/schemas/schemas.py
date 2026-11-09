"""
Pydantic V2 Schemas for OFL Credit Automation API
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

class BVNResolveRequest(BaseModel):
    bvn: str = Field(..., min_length=10, max_length=11)

class DirectApplicationCreate(BaseModel):
    applicant_name: str = Field(..., min_length=2)
    applicant_type: str = Field(default="INDIVIDUAL")  # INDIVIDUAL, SME, CORPORATE
    email: Optional[str] = None
    phone: Optional[str] = None
    bvn: Optional[str] = None
    nin: Optional[str] = None
    rc_number: Optional[str] = None
    business_address: Optional[str] = None
    residential_address: Optional[str] = None
    means_of_id_type: Optional[str] = None  # NATIONAL_ID, NIN_SLIP, VOTERS_CARD, PASSPORT, DRIVERS_LICENSE
    means_of_id_number: Optional[str] = None
    collateral_description: Optional[str] = None
    facility_type: Optional[str] = None
    amount: float = Field(..., gt=0)
    tenor_months: int = Field(..., ge=1, le=84)
    purpose: str = Field(..., min_length=5)
    monthly_income: float = Field(..., ge=0)
    existing_monthly_debt: float = Field(default=0.0, ge=0)
    estimated_monthly_expenses: float = Field(default=0.0, ge=0)
    collateral_value: float = Field(default=0.0, ge=0)
    documents: Optional[List[Dict[str, Any]]] = None

class BestoInboundPayload(BaseModel):
    source_system: str = Field(default="BESTO")
    source_application_id: str = Field(...)
    customer_reference: Optional[str] = None
    requested_amount_ngn: float = Field(...)
    applicant_details: Dict[str, Any] = Field(...)
    kyc_evidence: Optional[Dict[str, Any]] = None
    document_manifest: Optional[List[Dict[str, Any]]] = None
    submitted_at: Optional[str] = None
    schema_version: str = Field(default="1.0")
    correlation_id: Optional[str] = None

class WorkflowTransitionRequest(BaseModel):
    to_state: str
    actor: str = Field(default="Staff Reviewer")
    role: str = Field(default="ANALYST")
    reason: str = Field(..., min_length=3)
    correlation_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class ApprovalDecisionRequest(BaseModel):
    decision: str  # RECOMMEND_APPROVE, APPROVE, RETURN_FOR_REWORK, RETURN_TO_BDO, REJECT
    actor: str
    role: str  # ANALYST, HEAD_OF_BD, HRM, BCC, MD
    comments: str
    conditions_mandated: Optional[List[str]] = None
    target_role: Optional[str] = None  # Optional target when returning (e.g., HRM, HEAD_OF_BD, BDO)

class CAMUpdateRequest(BaseModel):
    executive_summary: Optional[str] = None
    borrower_profile: Optional[str] = None
    facility_structure: Optional[str] = None
    financial_analysis: Optional[str] = None
    risk_and_mitigants: Optional[str] = None
    policy_exceptions: Optional[str] = None
    recommendation: Optional[str] = None
    cam_data: Optional[Dict[str, Any]] = None
    analyst_sign_off: bool = False
    actor: str = "Credit Analyst"

class OfferGenerateRequest(BaseModel):
    approved_amount: Optional[float] = None
    tenor_months: Optional[int] = None
    interest_rate_pct: Optional[float] = None
    fee_schedule: Optional[List[Dict[str, Any]]] = None
    actor: str = "Credit Operations"

class OfferActionRequest(BaseModel):
    action: str  # ACCEPT, REJECT, RENEGOTIATE
    acceptance_evidence: Optional[str] = None
    notes: Optional[str] = None

class ConditionUpdateRequest(BaseModel):
    status: str  # SATISFIED, WAIVED, PENDING
    evidence_ref: Optional[str] = None
    verified_by: str = "Credit Operations"

class TreasuryDisbursementRequest(BaseModel):
    amount: Optional[float] = None
    nav_reference: Optional[str] = None
    disbursement_reference: Optional[str] = None
    confirmation_evidence: Optional[str] = None
    actor: str = "Treasury Officer"

class ExceptionRaiseRequest(BaseModel):
    case_id: str
    category: str = Field(..., description="Flowchart category: TECHNICAL_FAILURE, INTERNAL_CORRECTION, REJECTION_RECOMMENDATION, RISK_RECONSIDERATION, WITHDRAWAL_EXPIRY, APPLICANT_CORRECTION")
    originator_role: str = Field("ANALYST", description="APPLICANT, ANALYST, HRM, BCC, MD, SYSTEM")
    originator_name: Optional[str] = None
    reason: str = Field(..., min_length=3)
    comments: Optional[str] = None
    sla_hours: Optional[int] = None
    action_payload: Optional[Dict[str, Any]] = None

class ExceptionActionRequest(BaseModel):
    action_type: str = Field(..., description="RETRY_TECHNICAL, SEND_APPLICANT_REQUEST, APPLICANT_RESPONSE, ANALYST_VALIDATE, REJECTION_DECISION, HRM_COORDINATE, WITHDRAWAL_DECISION")
    actor: str = "Credit Staff"
    decision: Optional[str] = None  # "REJECT", "FURTHER_ASSESSMENT", "CLOSE", "RENEW"
    notes: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class ExceptionResolveRequest(BaseModel):
    resolution_notes: str = Field(..., min_length=5)
    resolved_by: str = "Assigned Owner"
    return_to_stage: Optional[str] = None
    is_material_change: bool = False
    new_terms: Optional[Dict[str, Any]] = None
    resolution_category: Optional[str] = None
