"""
OFL Credit Automation & AI-Assisted Underwriting Platform
FastAPI Application Entrypoint
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import settings
from .database import engine, Base, SessionLocal
from .api.v1.intake_router import router as intake_router
from .api.v1.cases_router import router as cases_router
from .api.v1.cam_router import router as cam_router
from .api.v1.workflow_router import router as workflow_router
from .api.v1.offer_router import router as offer_router
from .api.v1.treasury_router import router as treasury_router
from .api.v1.exceptions_router import router as exceptions_router
from .api.v1.telemetry_router import router as telemetry_router
from .api.v1.audit_router import router as audit_router

def seed_initial_demo_data():
    """
    Seeds initial realistic demonstration cases for UAT walkthrough.
    """
    db = SessionLocal()
    from .models import (
        Customer, Application, CreditCase, Document, KYCCheck,
        FinancialAssessment, CAMVersion, ConditionItem, Offer,
        CaseState, IntakeChannel
    )
    from .core.financial_engine import FinancialEngine
    from .integrations.azure_ai_service import AzureAICamService
    from .database import utc_now
    
    if db.query(CreditCase).count() > 0:
        db.close()
        return

    # Seed 1: BESTO Ingested Loan (₦1,500,000) - Analyst Review
    cust1 = Customer(
        customer_type="INDIVIDUAL",
        name="Adebayo Adeleke",
        email="adebayo.adeleke@example.ng",
        phone="+234 803 123 4567",
        bvn="22233445566",
        nin="11223344556",
        external_references={"besto_customer_ref": "BST-CUST-8812"},
        verified_attributes={"bvn_verified": True, "source": "BESTO_REUSE"}
    )
    db.add(cust1)
    db.flush()
    
    app1 = Application(
        customer_id=cust1.id,
        amount=1_500_000.0,
        currency="NGN",
        tenor=12,
        purpose="Retail store inventory expansion",
        intake_channel=IntakeChannel.BESTO.value,
        status="SUBMITTED",
        applicant_type="INDIVIDUAL",
        raw_payload={"source_system": "BESTO", "source_application_id": "BST-APP-9901"}
    )
    db.add(app1)
    db.flush()
    
    case1 = CreditCase(
        application_id=app1.id,
        case_number="OFL-2026-00001",
        state=CaseState.ANALYST_REVIEW.value,
        revision=1,
        assigned_owner="Credit Analyst Queue"
    )
    db.add(case1)
    db.flush()
    
    # Financial assessment for Case 1
    fin1_eval = FinancialEngine.evaluate({
        "requested_amount": 1_500_000.0,
        "tenor_months": 12,
        "applicant_type": "INDIVIDUAL",
        "verified_monthly_income": 450_000.0,
        "existing_monthly_debt": 30_000.0,
        "estimated_monthly_expenses": 180_000.0,
        "collateral_value": 0.0
    })
    fin1 = FinancialAssessment(
        case_id=case1.id,
        formula_version=fin1_eval["formula_version"],
        input_snapshot={"verified_monthly_income": 450000.0},
        calculated_ratios=fin1_eval["calculated_ratios"],
        policy_flags=fin1_eval["policy_flags"]
    )
    db.add(fin1)
    
    kyc1 = KYCCheck(
        case_id=case1.id,
        provider="BESTO_REUSE",
        provider_ref="BESTO-KYC-BST-APP-9901",
        status="PASSED",
        result_summary={"verified": True, "bvn_match": True, "provenance": "BESTO"}
    )
    db.add(kyc1)
    
    doc1 = Document(
        case_id=case1.id,
        document_type="BANK_STATEMENT",
        object_key="besto/BST-APP-9901/bank_stmt.pdf",
        checksum="e3b0c44298fc1c149afbf4c8996fb924",
        version=1,
        scan_status="CLEAN",
        original_filename="Adebayo_Bank_Statement_6M.pdf",
        content_summary="6-month bank statement showing average monthly turnover of ₦520,000"
    )
    db.add(doc1)
    
    # Generate initial AI CAM for Case 1
    AzureAICamService.generate_draft_cam(db, case1, fin1, actor="System Initializer")

    # Seed 2: OFL Direct Loan (₦8,500,000) - Ready for Disbursement (Conditions Pending -> Satisfied)
    cust2 = Customer(
        customer_type="SME",
        name="Greenline Agro-Allied Limited",
        email="finance@greenlineagro.ng",
        phone="+234 802 987 6543",
        rc_number="RC-1294820",
        bvn="22119988776",
        external_references={"channel": "OFL_DIRECT"}
    )
    db.add(cust2)
    db.flush()
    
    app2 = Application(
        customer_id=cust2.id,
        amount=8_500_000.0,
        currency="NGN",
        tenor=18,
        purpose="Procurement of grain sorting and packaging machinery",
        intake_channel=IntakeChannel.OFL_DIRECT.value,
        status="SUBMITTED",
        applicant_type="SME",
        raw_payload={"intake": "direct_portal"}
    )
    db.add(app2)
    db.flush()
    
    case2 = CreditCase(
        application_id=app2.id,
        case_number="OFL-2026-00002",
        state=CaseState.READY_FOR_DISBURSEMENT.value,
        revision=1,
        assigned_owner="Treasury / Operations"
    )
    db.add(case2)
    db.flush()
    
    fin2_eval = FinancialEngine.evaluate({
        "requested_amount": 8_500_000.0,
        "tenor_months": 18,
        "applicant_type": "SME",
        "verified_monthly_income": 2_800_000.0,
        "existing_monthly_debt": 250_000.0,
        "estimated_monthly_expenses": 1_100_000.0,
        "collateral_value": 14_000_000.0
    })
    fin2 = FinancialAssessment(
        case_id=case2.id,
        formula_version=fin2_eval["formula_version"],
        input_snapshot={"verified_monthly_income": 2800000.0},
        calculated_ratios=fin2_eval["calculated_ratios"],
        policy_flags=fin2_eval["policy_flags"]
    )
    db.add(fin2)
    
    kyc2 = KYCCheck(
        case_id=case2.id,
        provider="YOUVERIFY",
        provider_ref="YV-20261020-00821",
        status="PASSED",
        result_summary={"cac_verified": True, "directors_verified": True}
    )
    db.add(kyc2)
    
    # Conditions satisfied for Case 2
    cond2_1 = ConditionItem(
        case_id=case2.id,
        condition_type="PRE_DISBURSEMENT",
        description="Comprehensive insurance on grain processing machinery with Opticom noted as first loss payee",
        mandatory=True,
        status="SATISFIED",
        evidence_ref="INS-POL-2026-9921",
        verified_by="Credit Operations"
    )
    cond2_2 = ConditionItem(
        case_id=case2.id,
        condition_type="PRE_DISBURSEMENT",
        description="Legal charge registration at Corporate Affairs Commission (CAC)",
        mandatory=True,
        status="SATISFIED",
        evidence_ref="CAC-CHARGE-DOC-774",
        verified_by="Legal Counsel"
    )
    db.add_all([cond2_1, cond2_2])
    
    offer2 = Offer(
        case_id=case2.id,
        terms_hash="TERMS_HASH_CASE_2_VALIDATED",
        approved_amount=8_500_000.0,
        tenor_months=18,
        interest_rate_pct=26.0,
        monthly_repayment=576_210.45,
        status="ACCEPTED",
        acceptance_evidence="Signed offer letter uploaded with board resolution dated 2026-10-18.",
        expiry=utc_now()
    )
    db.add(offer2)
    
    # Seed 3: Corporate Facility (₦25,000,000) - MD Decision
    cust3 = Customer(
        customer_type="CORPORATE",
        name="Horizon Logistics & Haulage PLC",
        email="treasury@horizonlogistics.ng",
        phone="+234 809 555 1234",
        rc_number="RC-883921",
        bvn="22334499001",
        external_references={"channel": "OFL_DIRECT"}
    )
    db.add(cust3)
    db.flush()
    
    app3 = Application(
        customer_id=cust3.id,
        amount=25_000_000.0,
        currency="NGN",
        tenor=24,
        purpose="Fleet acquisition - 5 prime mover diesel trucks",
        intake_channel=IntakeChannel.OFL_DIRECT.value,
        status="SUBMITTED",
        applicant_type="CORPORATE",
        raw_payload={"intake": "direct_portal"}
    )
    db.add(app3)
    db.flush()
    
    case3 = CreditCase(
        application_id=app3.id,
        case_number="OFL-2026-00003",
        state=CaseState.MD_DECISION.value,
        revision=1,
        assigned_owner="Managing Director"
    )
    db.add(case3)
    db.flush()
    
    fin3_eval = FinancialEngine.evaluate({
        "requested_amount": 25_000_000.0,
        "tenor_months": 24,
        "applicant_type": "CORPORATE",
        "verified_monthly_income": 9_500_000.0,
        "existing_monthly_debt": 1_200_000.0,
        "estimated_monthly_expenses": 4_200_000.0,
        "collateral_value": 40_000_000.0
    })
    fin3 = FinancialAssessment(
        case_id=case3.id,
        formula_version=fin3_eval["formula_version"],
        input_snapshot={"verified_monthly_income": 9500000.0},
        calculated_ratios=fin3_eval["calculated_ratios"],
        policy_flags=fin3_eval["policy_flags"]
    )
    db.add(fin3)
    
    AzureAICamService.generate_draft_cam(db, case3, fin3, actor="Senior Risk Analyst")
    
    db.commit()
    db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    Base.metadata.create_all(bind=engine)
    seed_initial_demo_data()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Azure-hosted, human-controlled credit origination and AI-assisted underwriting platform for Opticom Finance House.",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits local frontend and Azure App Service origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(intake_router, prefix="/api/v1")
app.include_router(cases_router, prefix="/api/v1")
app.include_router(cam_router, prefix="/api/v1")
app.include_router(workflow_router, prefix="/api/v1")
app.include_router(offer_router, prefix="/api/v1")
app.include_router(treasury_router, prefix="/api/v1")
app.include_router(exceptions_router, prefix="/api/v1")
app.include_router(telemetry_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT
    }

@app.get("/")
def root():
    return {
        "platform": settings.APP_NAME,
        "client": "Opticom Finance House",
        "vendor": "CyberCapSec Limited",
        "documentation": "/docs",
        "api_v1": "/api/v1"
    }
