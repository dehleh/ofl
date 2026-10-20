"""
Pydantic V2 Schemas for OFL Credit Automation API
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

class DirectApplicationCreate(BaseModel):
    applicant_name: str = Field(..., min_length=2)
    applicant_type: str = Field(default="INDIVIDUAL")  # INDIVIDUAL, SME, CORPORATE
    email: Optional[str] = None
    phone: Optional[str] = None
    bvn: Optional[str] = None
    nin: Optional[str] = None
    rc_number: Optional[str] = None
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
    decision: str  # RECOMMEND_APPROVE, APPROVE, RETURN_FOR_REWORK, REJECT
    actor: str
    role: str  # ANALYST, HRM, BCC, MD
    comments: str
    conditions_mandated: Optional[List[str]] = None

class CAMUpdateRequest(BaseModel):
    executive_summary: Optional[str] = None
    borrower_profile: Optional[str] = None
    facility_structure: Optional[str] = None
    financial_analysis: Optional[str] = None
    risk_and_mitigants: Optional[str] = None
    policy_exceptions: Optional[str] = None
    recommendation: Optional[str] = None
    analyst_sign_off: bool = False
    actor: str = "Credit Analyst"

class OfferGenerateRequest(BaseModel):
    approved_amount: Optional[float] = None
    tenor_months: Optional[int] = None
    interest_rate_pct: Optional[float] = None
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
    nav_reference: str = Field(..., min_length=3)
    amount: float = Field(..., gt=0)
    confirmation_evidence: str = Field(..., min_length=5)
    actor: str = "Treasury Officer"

class ExceptionResolveRequest(BaseModel):
    resolution_notes: str = Field(..., min_length=5)
    resolved_by: str = "Assigned Owner"
    return_to_stage: Optional[str] = None
