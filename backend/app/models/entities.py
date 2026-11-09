"""
Canonical Entities for OFL Credit Automation Platform (PRD Section 7)
"""
import enum
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, 
    Text, ForeignKey, UniqueConstraint, Enum, JSON
)
from sqlalchemy.orm import relationship
from ..database import Base, generate_uuid, utc_now

class IntakeChannel(str, enum.Enum):
    BESTO = "BESTO"
    OFL_DIRECT = "OFL_DIRECT"

class CaseState(str, enum.Enum):
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    KYC_PENDING = "KYC Pending"
    BDO_REWORK = "BDO Rework"
    ANALYST_REVIEW = "Analyst Review"
    HRM_REVIEW = "HRM Review"
    HEAD_OF_BD_REVIEW = "Head of BD Review"
    BCC_REVIEW = "BCC/Authorisation"
    MD_DECISION = "MD Decision"
    OFFER_PENDING = "Offer Pending"
    CONDITIONS_PENDING = "Conditions Pending"
    READY_FOR_DISBURSEMENT = "Ready for Disbursement"
    TREASURY_CONFIRMATION_PENDING = "Treasury Confirmation Pending"
    LOANDISC_SYNC_PENDING = "LOAN-DISC Sync Pending"
    DISBURSED_MONITORING = "Disbursed/Monitoring"
    REJECTED = "Rejected"
    WITHDRAWN = "Withdrawn"

class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    customer_type = Column(String(30), default="INDIVIDUAL")  # INDIVIDUAL, SME, CORPORATE
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    bvn = Column(String(20), nullable=True)
    nin = Column(String(20), nullable=True)
    rc_number = Column(String(50), nullable=True)
    external_references = Column(JSON, default=dict)
    verified_attributes = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utc_now)
    
    applications = relationship("Application", back_populates="customer")

class Application(Base):
    __tablename__ = "applications"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="NGN")
    tenor = Column(Integer, nullable=False)  # in months
    purpose = Column(Text, nullable=False)
    intake_channel = Column(String(30), default=IntakeChannel.OFL_DIRECT.value)
    status = Column(String(30), default="SUBMITTED")
    applicant_type = Column(String(30), default="INDIVIDUAL")
    raw_payload = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utc_now)
    
    customer = relationship("Customer", back_populates="applications")
    credit_case = relationship("CreditCase", back_populates="application", uselist=False)

class CreditCase(Base):
    __tablename__ = "credit_cases"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id"), nullable=False, unique=True)
    case_number = Column(String(50), unique=True, nullable=False, index=True)
    state = Column(String(50), default=CaseState.SUBMITTED.value, nullable=False)
    revision = Column(Integer, default=1, nullable=False)
    assigned_owner = Column(String(100), default="Credit Analyst Queue")
    assigned_analyst = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    application = relationship("Application", back_populates="credit_case")
    documents = relationship("Document", back_populates="credit_case", cascade="all, delete-orphan")
    kyc_checks = relationship("KYCCheck", back_populates="credit_case", cascade="all, delete-orphan")
    financial_assessments = relationship("FinancialAssessment", back_populates="credit_case", cascade="all, delete-orphan")
    cam_versions = relationship("CAMVersion", back_populates="credit_case", cascade="all, delete-orphan")
    exceptions = relationship("ExceptionItem", back_populates="credit_case", cascade="all, delete-orphan")
    approvals = relationship("Approval", back_populates="credit_case", cascade="all, delete-orphan")
    offers = relationship("Offer", back_populates="credit_case", cascade="all, delete-orphan")
    conditions = relationship("ConditionItem", back_populates="credit_case", cascade="all, delete-orphan")
    disbursements = relationship("Disbursement", back_populates="credit_case", cascade="all, delete-orphan")
    loan_performance = relationship("LoanPerformance", back_populates="credit_case", uselist=False, cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("credit_cases.id"), nullable=False)
    document_type = Column(String(50), nullable=False)
    object_key = Column(String(500), nullable=False)
    checksum = Column(String(64), nullable=False)
    version = Column(Integer, default=1)
    scan_status = Column(String(30), default="CLEAN")  # CLEAN, PENDING, INFECTED
    retention_class = Column(String(30), default="STANDARD_CREDIT_7_YEARS")
    original_filename = Column(String(255), nullable=False)
    content_summary = Column(Text, nullable=True)
    analysis_results = Column(JSON, default=dict)
    uploaded_at = Column(DateTime, default=utc_now)
    
    credit_case = relationship("CreditCase", back_populates="documents")

class KYCCheck(Base):
    __tablename__ = "kyc_checks"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("credit_cases.id"), nullable=False)
    provider = Column(String(50), default="YOUVERIFY")  # YOUVERIFY, BESTO_REUSE, MANUAL
    provider_ref = Column(String(100), unique=True, nullable=False, index=True)
    status = Column(String(30), default="PASSED")  # PASSED, MISMATCH, FAILED, PENDING
    result_summary = Column(JSON, default=dict)
    reviewed_by = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    
    credit_case = relationship("CreditCase", back_populates="kyc_checks")

class FinancialAssessment(Base):
    __tablename__ = "financial_assessments"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("credit_cases.id"), nullable=False)
    formula_version = Column(String(20), default="v1.1-2026")
    input_snapshot = Column(JSON, nullable=False)
    calculated_ratios = Column(JSON, nullable=False)
    policy_flags = Column(JSON, default=list)
    performed_by = Column(String(100), default="Deterministic Financial Engine")
    created_at = Column(DateTime, default=utc_now)
    
    credit_case = relationship("CreditCase", back_populates="financial_assessments")

class CAMVersion(Base):
    __tablename__ = "cam_versions"
    __table_args__ = (
        UniqueConstraint("case_id", "version", name="uq_case_cam_version"),
    )
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("credit_cases.id"), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    source_snapshot = Column(JSON, default=dict)
    executive_summary = Column(Text, nullable=True)
    borrower_profile = Column(Text, nullable=True)
    facility_structure = Column(Text, nullable=True)
    financial_analysis = Column(Text, nullable=True)
    risk_and_mitigants = Column(Text, nullable=True)
    policy_exceptions = Column(Text, nullable=True)
    recommendation = Column(Text, nullable=True)
    cam_data = Column(JSON, default=dict)  # Structured 12-page Opticom CAM template payload
    evidence_citations = Column(JSON, default=list)
    validation_status = Column(String(30), default="DRAFT")  # DRAFT, ANALYST_VALIDATED, REJECTED
    analyst_sign_off = Column(Boolean, default=False)
    signed_by = Column(String(100), nullable=True)
    signed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    
    credit_case = relationship("CreditCase", back_populates="cam_versions")

class ExceptionCategory(str, enum.Enum):
    TECHNICAL_FAILURE = "TECHNICAL_FAILURE"
    INTERNAL_CORRECTION = "INTERNAL_CORRECTION"
    REJECTION_RECOMMENDATION = "REJECTION_RECOMMENDATION"
    RISK_RECONSIDERATION = "RISK_RECONSIDERATION"
    WITHDRAWAL_EXPIRY = "WITHDRAWAL_EXPIRY"
    APPLICANT_CORRECTION = "APPLICANT_CORRECTION"

class ExceptionOriginator(str, enum.Enum):
    APPLICANT = "APPLICANT"
    ANALYST = "ANALYST"
    HRM = "HRM"
    BCC = "BCC"
    MD = "MD"
    SYSTEM = "SYSTEM"

class ExceptionItem(Base):
    __tablename__ = "exceptions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("credit_cases.id"), nullable=False)
    category = Column(String(50), nullable=False)  # Flowchart 6 categories
    originator_role = Column(String(50), default="ANALYST")  # APPLICANT, ANALYST, HRM, BCC, MD, SYSTEM
    originator_name = Column(String(100), nullable=True)
    origin_stage = Column(String(50), nullable=False)
    owner = Column(String(100), nullable=False)  # Designated owner per category
    return_stage = Column(String(50), nullable=False)
    reason = Column(Text, nullable=False)
    comments = Column(Text, nullable=True)
    version = Column(Integer, default=1)
    sla_hours = Column(Integer, default=24)
    sla_due_at = Column(DateTime, nullable=True)
    status = Column(String(30), default="OPEN")  # OPEN, IN_PROGRESS, RESOLVED, WAIVED
    
    # Flowchart specific tracking payload
    action_payload = Column(JSON, default=dict)
    applicant_action_required = Column(Boolean, default=False)
    applicant_response = Column(JSON, default=dict)
    
    # Resolution and Convergence tracking
    is_material_change = Column(Boolean, default=False)
    resolution_category = Column(String(50), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolved_by = Column(String(100), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    
    credit_case = relationship("CreditCase", back_populates="exceptions")

class Approval(Base):
    __tablename__ = "approvals"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("credit_cases.id"), nullable=False)
    revision = Column(Integer, nullable=False)
    terms_hash = Column(String(64), nullable=False)
    actor = Column(String(100), nullable=False)
    authority_level = Column(String(50), nullable=False)  # ANALYST, HRM, BCC, MD
    decision = Column(String(50), nullable=False)  # RECOMMEND_APPROVE, APPROVE, RETURN_FOR_REWORK, REJECT
    comments = Column(Text, nullable=True)
    conditions_mandated = Column(JSON, default=list)
    created_at = Column(DateTime, default=utc_now)
    invalidated_at = Column(DateTime, nullable=True)  # Populated if material change occurs
    
    credit_case = relationship("CreditCase", back_populates="approvals")

class Offer(Base):
    __tablename__ = "offers"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("credit_cases.id"), nullable=False)
    terms_hash = Column(String(64), nullable=False)
    approved_amount = Column(Float, nullable=False)
    tenor_months = Column(Integer, nullable=False)
    interest_rate_pct = Column(Float, nullable=False)
    monthly_repayment = Column(Float, nullable=False)
    issued_at = Column(DateTime, default=utc_now)
    created_at = Column(DateTime, default=utc_now)
    expiry = Column(DateTime, nullable=False)
    status = Column(String(30), default="ISSUED")  # ISSUED, ACCEPTED, REJECTED, EXPIRED, RENEGOTIATING
    acceptance_evidence = Column(Text, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    fee_schedule = Column(JSON, default=list)  # Itemized list of selected fees and amounts
    total_fees = Column(Float, default=0.0)    # Total upfront fee deduction
    net_disbursement = Column(Float, default=0.0) # Principal - total_fees
    
    credit_case = relationship("CreditCase", back_populates="offers")

class ConditionItem(Base):
    __tablename__ = "condition_items"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("credit_cases.id"), nullable=False)
    condition_type = Column(String(30), default="PRE_DISBURSEMENT")  # PRE_DISBURSEMENT, POST_DISBURSEMENT
    description = Column(Text, nullable=False)
    mandatory = Column(Boolean, default=True)
    evidence_ref = Column(String(255), nullable=True)
    verified_by = Column(String(100), nullable=True)
    status = Column(String(30), default="PENDING")  # PENDING, SATISFIED, WAIVED
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    
    credit_case = relationship("CreditCase", back_populates="conditions")

class Disbursement(Base):
    __tablename__ = "disbursements"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("credit_cases.id"), nullable=False)
    nav_reference = Column(String(100), unique=True, nullable=True, index=True)
    amount = Column(Float, nullable=False)
    confirmation_evidence = Column(Text, nullable=True)
    status = Column(String(30), default="PENDING_CONFIRMATION")  # PENDING_CONFIRMATION, CONFIRMED, RECONCILED, FAILED
    recorded_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=utc_now)
    
    credit_case = relationship("CreditCase", back_populates="disbursements")

class IntegrationEvent(Base):
    __tablename__ = "integration_events"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    external_system = Column(String(50), nullable=False)  # BESTO, YOUVERIFY, NAV, LOANDISC, AZURE_AI
    idempotency_key = Column(String(150), unique=True, nullable=False, index=True)
    payload_hash = Column(String(64), nullable=False)
    attempt_count = Column(Integer, default=1)
    status = Column(String(30), default="QUEUED")  # QUEUED, PROCESSING, ACKNOWLEDGED, FAILED, DEAD_LETTER
    acknowledgment = Column(JSON, nullable=True)
    error_details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

class AuditEvent(Base):
    __tablename__ = "audit_events"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    actor = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)
    event = Column(String(100), nullable=False)
    entity = Column(String(50), nullable=False)
    entity_id = Column(String(100), nullable=False)
    timestamp = Column(DateTime, default=utc_now, index=True)
    correlation_id = Column(String(100), nullable=False, index=True)
    reason = Column(Text, nullable=True)
    details = Column(JSON, default=dict)

class SystemConfiguration(Base):
    __tablename__ = "system_configurations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    category = Column(String(50), nullable=False, index=True)  # SSO, MFA, EMAIL, SMS, POLICY
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(JSON, nullable=False, default=dict)
    is_secret = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    updated_by = Column(String(100), default="SYSTEM_INITIALIZER")
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

class StaffUser(Base):
    __tablename__ = "staff_users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)  # ANALYST, HRM, BCC, MD, TREASURY, IT_OWNER, BDO, ADMIN
    department = Column(String(100), default="Credit Operations")
    pin_hash = Column(String(255), default="1988")
    is_active = Column(Boolean, default=True)
    permissions = Column(JSON, default=list)
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    last_login_at = Column(DateTime, nullable=True)

class LoanPerformance(Base):
    """
    Loan Servicing & Portfolio Telemetry (Post-Disbursement Performance Tracking).
    Tracks repayment timeliness, servicing progress, remaining balance,
    and applies a 5% penalty when repayment is overdue beyond 7 days grace.
    """
    __tablename__ = "loan_performances"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("credit_cases.id"), nullable=False, unique=True, index=True)
    facility_number = Column(String(50), nullable=False, index=True)
    borrower_name = Column(String(255), nullable=False)
    disbursed_principal = Column(Float, nullable=False)
    interest_rate_apr = Column(Float, default=28.0)
    tenor_months = Column(Integer, nullable=False)
    monthly_installment = Column(Float, nullable=False)
    total_installments_count = Column(Integer, nullable=False)
    installments_serviced = Column(Integer, default=0)
    installments_remaining = Column(Integer, nullable=False)
    principal_serviced = Column(Float, default=0.0)
    interest_serviced = Column(Float, default=0.0)
    total_amount_serviced = Column(Float, default=0.0)
    outstanding_principal = Column(Float, nullable=False)
    outstanding_total = Column(Float, nullable=False)
    next_due_date = Column(DateTime, nullable=True)
    days_overdue = Column(Integer, default=0)
    grace_period_days = Column(Integer, default=7)
    penalty_rate_pct = Column(Float, default=5.0)
    penalty_accrued = Column(Float, default=0.0)
    performance_status = Column(String(50), default="PERFORMING_CURRENT") # PERFORMING_CURRENT, GRACE_PERIOD_ACTIVE, OVERDUE_PENALTY_APPLIED, CRITICAL_DELINQUENT, CLOSED_FULLY_SETTLED
    repayment_schedule = Column(JSON, default=list)
    repayment_history = Column(JSON, default=list)
    disbursed_at = Column(DateTime, default=utc_now)
    last_payment_date = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    credit_case = relationship("CreditCase", back_populates="loan_performance")

