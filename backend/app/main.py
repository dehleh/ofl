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
    from .integrations.vertex_ai_service import VertexAICamService
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
    
    # Generate initial AI CAM for Case 1 using Google Cloud Vertex AI (Gemini)
    VertexAICamService.generate_draft_cam(db, case1, fin1, actor="System Initializer")

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
    
    # Seed 3: Official Opticom Working Capital CAM (₦50m requested, ₦40m recommended for 6 months)
    cust3 = Customer(
        customer_type="SME",
        name="LEO-AKINBONI BABATUNDE GLOBAL ENTERPRISES",
        email="leobabatunde9@gmail.com",
        phone="08024799952",
        rc_number="7049792",
        bvn="2233307057",
        nin="65858750946",
        external_references={
            "bn_number": "7049792",
            "sector": "Haulage and Logistics",
            "facility_type": "Working Capital",
            "relationship_manager": "Mr. Oloyede Olaniyi",
            "business_address": "NNPC Filling Station Opposite Eleganzer company, Ide-orogbo, Ibeju Lekki, Epe road, Lagos, Nigeria",
            "registered_address": "No.2, Rev Yinka Akinsanya Street, Gbetu, Ibeju Lekki, Lagos.",
            "promoter_name": "Mr. Leo Akinboni Babatunde",
            "next_of_kin_name": "Mrs. Yewande Akinboni",
            "guarantor_name": "Mr. Ayomikun Boluwaji Akinboni",
            "guarantor_bvn": "22257967170",
            "guarantor_phone": "07064451552",
            "recommended_amount": 40_000_000.0,
            "channel": "OFL_DIRECT"
        },
        verified_attributes={"cac_active": True, "bvn_verified": True}
    )
    db.add(cust3)
    db.flush()
    
    app3 = Application(
        customer_id=cust3.id,
        amount=50_000_000.0,
        currency="NGN",
        tenor=6,
        purpose="Purchase Order Execution for P.A. Lawrence Nigeria Limited",
        intake_channel=IntakeChannel.OFL_DIRECT.value,
        status="SUBMITTED",
        applicant_type="SME",
        raw_payload={"intake": "direct_portal", "recommended_amount": 40_000_000.0}
    )
    db.add(app3)
    db.flush()
    
    case3 = CreditCase(
        application_id=app3.id,
        case_number="OFL-2026-00003",
        state=CaseState.HRM_REVIEW.value,
        revision=1,
        assigned_owner="Head of Risk Management"
    )
    db.add(case3)
    db.flush()

    # Documents for Case 3 matching CAM
    doc3_1 = Document(
        case_id=case3.id,
        document_type="PURCHASE_ORDER",
        object_key="cases/OFL-2026-00003/PO/PA_Lawrence_PO_5000_Trips.pdf",
        checksum="8f73b821a9c148209eb4718520df9876",
        version=1,
        scan_status="CLEAN",
        original_filename="PA_Lawrence_PO_5000_Trips.pdf",
        content_summary="P.A. Lawrence Nigeria Limited transportation contract for 5,000 trips of sharp sand @ ₦230,000 per trip (Total ₦1.15bn)"
    )
    doc3_2 = Document(
        case_id=case3.id,
        document_type="BANK_STATEMENT",
        object_key="cases/OFL-2026-00003/STATEMENTS/UBA_FirstBank_6M_Inflows.pdf",
        checksum="41c9a1b9204781dfa5b7809623e10874",
        version=1,
        scan_status="CLEAN",
        original_filename="UBA_FirstBank_6M_Inflows.pdf",
        content_summary="6-month bank statements (UBA & FirstBank) showing total credits of ₦1,026,334,729.08"
    )
    doc3_3 = Document(
        case_id=case3.id,
        document_type="VALUATION_REPORT",
        object_key="cases/OFL-2026-00003/COLLATERAL/Valuation_Survey_Landed_Property_Eyinra.pdf",
        checksum="a1b2c3d4e5f67890123456789abcdef0",
        version=1,
        scan_status="CLEAN",
        original_filename="Valuation_Survey_Landed_Property_Eyinra.pdf",
        content_summary="Valuation report on landed building at No. 9 Lawrence Street, Eyinra Village (MV ₦80m, FSV ₦56m) + Toyota 4Runner (FSV ₦19.95m)"
    )
    db.add_all([doc3_1, doc3_2, doc3_3])
    
    fin3_eval = FinancialEngine.evaluate({
        "requested_amount": 40_000_000.0,
        "tenor_months": 6,
        "annual_interest_rate": 0.60,
        "applicant_type": "SME",
        "verified_monthly_income": 142_222_475.22,
        "existing_monthly_debt": 1_000_000.0,
        "estimated_monthly_expenses": 120_361_182.64,
        "collateral_value": 108_500_000.0,
        "collateral_fsv": 75_950_000.0
    })
    fin3 = FinancialAssessment(
        case_id=case3.id,
        formula_version=fin3_eval["formula_version"],
        input_snapshot={
            "verified_monthly_income": 142_222_475.22,
            "average_monthly_sales": 142_222_475.22,
            "recommended_amount": 40_000_000.0
        },
        calculated_ratios=fin3_eval["calculated_ratios"],
        policy_flags=fin3_eval["policy_flags"]
    )
    db.add(fin3)
    
    # Generate the official Opticom 12-page CAM via Vertex AI service
    VertexAICamService.generate_draft_cam(db, case3, fin3, actor="Sadiku Wasiu Adekunle")
    
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
    description="GCP-hosted, human-controlled credit origination and Google Cloud Vertex AI (Gemini) underwriting platform for Opticom Finance House.",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits local frontend and GCP Cloud Run origins
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
