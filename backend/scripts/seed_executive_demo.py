"""
Opticom Finance Limited - Executive Management Demo Seeder
Populates rich, production-grade demo data across all credit stages, personas,
financial assessments, 12-page CAM versions, fee schedules, approvals, and audit trails.
"""
import sys
import os
import uuid
import json
import hashlib
from datetime import datetime, timedelta, timezone, date

# Ensure backend directory is in python path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal, utc_now
from app.models import (
    Customer, Application, CreditCase, Document, KYCCheck,
    FinancialAssessment, CAMVersion, ExceptionItem, Approval,
    Offer, ConditionItem, Disbursement, IntegrationEvent, AuditEvent, StaffUser,
    SystemConfiguration, CaseState, IntakeChannel, LoanPerformance
)
from app.core.financial_engine import FinancialEngine
from app.core.config_manager import ConfigManager
from app.core.state_machine import TransitionService
from app.core.loan_performance_engine import LoanPerformanceEngine

def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def seed_demo(db_session=None):
    owns_session = False
    if db_session is None:
        db = SessionLocal()
        owns_session = True
    else:
        db = db_session
    print("Beginning Opticom Executive Demo Data Population...")

    try:
        # 1. Clean existing demo cases to prevent conflicts while keeping staff and configs
        existing_cases = db.query(CreditCase).all()
        print(f"Found {len(existing_cases)} existing cases. Refreshing demo pipeline...")
        for c in existing_cases:
            db.delete(c)
        
        # Clean applications, loan performances, and customers associated with credit cases
        db.query(LoanPerformance).delete()
        db.query(Application).delete()
        db.query(Customer).delete()
        db.commit()

        # 2. Ensure Staff Accounts exist with all personas
        staff_roles = [
            ("admin", "Opticom System Administrator", "ADMIN", "IT & Infrastructure", "admin@opticomfinance.com"),
            ("md", "Folashade Tinubu (Managing Director)", "MD", "Executive Management", "folashade.tinubu@opticomfinance.com"),
            ("hrm", "Chidinma Okafor (Head of Risk)", "HRM", "Risk Management", "chidinma.okafor@opticomfinance.com"),
            ("bd", "Dapo Adeleke (Head of Business Development)", "HEAD_OF_BD", "Commercial Origination", "dapo.adeleke@opticomfinance.com"),
            ("bcc", "Emeka Nnamdi (BCC Chair)", "BCC", "Board Credit Committee", "emeka.nnamdi@opticomfinance.com"),
            ("analyst", "Babatunde Adebayo", "ANALYST", "Credit Underwriting", "tunde.adebayo@opticomfinance.com"),
            ("treasury", "Ibrahim Musa (Treasury Lead)", "TREASURY", "Treasury Operations", "ibrahim.musa@opticomfinance.com"),
            ("operations", "Kemi Balogun (Credit Ops)", "OPERATIONS", "Credit Operations", "kemi.balogun@opticomfinance.com"),
            ("bdo", "Segun Adeleke (BDO Officer)", "BDO", "Direct Commercial Origination", "segun.adeleke@opticomfinance.com"),
            ("auditor", "Farooq Mohammed (Chief Auditor)", "AUDITOR", "Internal Audit & Compliance", "farooq.mohammed@opticomfinance.com"),
        ]

        for username, name, role, dept, email in staff_roles:
            user = db.query(StaffUser).filter(StaffUser.username == username).first()
            if not user:
                user = StaffUser(
                    username=username,
                    name=name,
                    role=role,
                    department=dept,
                    email=email,
                    pin_hash="1988",
                    is_active=True
                )
                db.add(user)
            else:
                user.name = name
                user.role = role
                user.department = dept
                user.email = email
        db.commit()

        now = utc_now()
        yesterday = now - timedelta(days=1)
        two_days_ago = now - timedelta(days=2)
        three_days_ago = now - timedelta(days=3)
        one_week_ago = now - timedelta(days=7)

        # 3. Define the 9 Executive Demo Cases
        demo_cases_spec = [
            # CASE 1: Retail Micro-Commercial via BESTO Simulator (Analyst Review)
            {
                "case_number": "OFL-2026-00001",
                "customer": {
                    "customer_type": "INDIVIDUAL",
                    "name": "Adebayo Adeleke",
                    "email": "adebayo.adeleke@example.ng",
                    "phone": "0803 123 4567",
                    "bvn": "22233445566",
                    "nin": "11223344556",
                    "rc_number": "BN-2894102",
                    "external_references": {"channel": "BESTO", "besto_customer_ref": "BST-CUST-8812", "retail_score": 745},
                    "verified_attributes": {"bvn_verified": True, "nin_verified": True, "source": "BESTO_REUSE"}
                },
                "application": {
                    "amount": 1850000.0,
                    "tenor": 6,
                    "purpose": "Working Capital for Fast-Moving Retail Inventory Restocking",
                    "intake_channel": IntakeChannel.BESTO.value,
                    "applicant_type": "INDIVIDUAL"
                },
                "state": CaseState.ANALYST_REVIEW.value,
                "assigned_owner": "Credit Analyst Queue",
                "assigned_analyst": "Babatunde Adebayo",
                "turnover": 4500000.0,
                "debt_service": 80000.0,
                "opex": 1200000.0,
                "collateral_value": 3500000.0,
                "collateral_desc": "Personal Guarantee & Household Asset Lien (Value: ₦3,500,000)",
                "created_at": yesterday,
                "history_approvals": [],
                "active_exception": None,
                "offer_status": None
            },

            # CASE 2: Agro-Allied SME (Ready for Disbursement / Treasury 1-Click LMS Demo)
            {
                "case_number": "OFL-2026-00002",
                "customer": {
                    "customer_type": "SME",
                    "name": "Greenline Agro-Allied Limited",
                    "email": "finance@greenlineagro.ng",
                    "phone": "0802 987 6543",
                    "bvn": "22119988776",
                    "nin": "44556677889",
                    "rc_number": "RC-1294820",
                    "external_references": {
                        "channel": "OFL_DIRECT",
                        "sector": "Agriculture & Agro-Processing",
                        "registered_address": "Plot 14, Commercial Industrial Layout, Epe Expressway, Lagos",
                        "promoter_name": "Dr. Emmanuel Chukwuemeka",
                        "guarantor_name": "Mrs. Folake Chukwuemeka",
                        "guarantor_bvn": "22334455667"
                    },
                    "verified_attributes": {"cac_active": True, "bvn_verified": True, "firs_tin_valid": True}
                },
                "application": {
                    "amount": 8500000.0,
                    "tenor": 12,
                    "purpose": "Expansion of Commercial Grain Silo & Maize Seed Storage Facility",
                    "intake_channel": IntakeChannel.OFL_DIRECT.value,
                    "applicant_type": "SME"
                },
                "state": CaseState.READY_FOR_DISBURSEMENT.value,
                "assigned_owner": "Treasury Operations Queue",
                "assigned_analyst": "Babatunde Adebayo",
                "turnover": 22000000.0,
                "debt_service": 350000.0,
                "opex": 5800000.0,
                "collateral_value": 18500000.0,
                "collateral_desc": "Legal Mortgage on Grain Silo Facility in Epe + All Assets Debenture (Value: ₦18,500,000)",
                "created_at": three_days_ago,
                "history_approvals": [
                    {"actor": "Babatunde Adebayo", "role": "ANALYST", "decision": "RECOMMEND_APPROVE", "comments": "Affordability confirmed with 2.15x DSCR. Recommended for approval."},
                    {"actor": "Chidinma Okafor", "role": "HRM", "decision": "RECOMMEND_APPROVE", "comments": "Risk covenants verified. Agro storage risk mitigated by comprehensive insurance. Forwarded to Head of BD."},
                    {"actor": "Dapo Adeleke", "role": "HEAD_OF_BD", "decision": "RECOMMEND_APPROVE", "comments": "Strong commercial rationale and proven supplier contract with Flour Mills. Returned to HRM."},
                    {"actor": "Chidinma Okafor", "role": "HRM", "decision": "RECOMMEND_APPROVE", "comments": "Risk concurrence confirmed. Forwarded to MD for final sanction."},
                    {"actor": "Folashade Tinubu", "role": "MD", "decision": "APPROVE", "comments": "Facility approved within MD mandate (₦8.5M <= ₦20M limit). Issue offer letter immediately."}
                ],
                "active_exception": None,
                "offer_status": "ACCEPTED",
                "conditions_precedent": [
                    {"desc": "Legal Mortgage on Grain Silo Facility (Plot 14 Commercial Layout, Epe) registered at Lands Registry", "status": "SATISFIED", "verified_by": "Kemi Balogun (Credit Ops)"},
                    {"desc": "Comprehensive Insurance Policy covering Silo & Inventory with Opticom noted as First Loss Payee", "status": "SATISFIED", "verified_by": "Kemi Balogun (Credit Ops)"},
                    {"desc": "Executed Personal Guarantee of Dr. Emmanuel Chukwuemeka supported by Statement of Net Worth", "status": "SATISFIED", "verified_by": "Kemi Balogun (Credit Ops)"}
                ]
            },

            # CASE 3: Large Corporate Haulage Logistics (> ₦20M / BCC Board Mandate Demo)
            {
                "case_number": "OFL-2026-00003",
                "customer": {
                    "customer_type": "CORPORATE",
                    "name": "LEO-AKINBONI BABATUNDE GLOBAL ENTERPRISES",
                    "email": "leobabatunde9@gmail.com",
                    "phone": "0802 479 9952",
                    "bvn": "2233307057",
                    "nin": "65858750946",
                    "rc_number": "BN-7049792",
                    "external_references": {
                        "bn_number": "7049792",
                        "sector": "Haulage, Transportation & Logistics",
                        "facility_type": "Working Capital Contract Financing",
                        "relationship_manager": "Mr. Oloyede Olaniyi",
                        "business_address": "NNPC Filling Station Opposite Eleganza, Ide-Orogbo, Ibeju Lekki, Epe Road, Lagos",
                        "registered_address": "No.2, Rev Yinka Akinsanya Street, Gbetu, Ibeju Lekki, Lagos",
                        "promoter_name": "Mr. Leo Akinboni Babatunde",
                        "next_of_kin_name": "Mrs. Yewande Akinboni",
                        "guarantor_name": "Mr. Ayomikun Boluwaji Akinboni",
                        "guarantor_bvn": "22257967170",
                        "guarantor_phone": "07064451552",
                        "recommended_amount": 45000000.0,
                        "channel": "OFL_DIRECT"
                    },
                    "verified_attributes": {"cac_active": True, "bvn_verified": True, "turnover_verified": True}
                },
                "application": {
                    "amount": 45000000.0,
                    "tenor": 12,
                    "purpose": "Working capital financing for 5,000 haulage trips under P.A. Lawrence Nigeria Limited logistics contract",
                    "intake_channel": IntakeChannel.OFL_DIRECT.value,
                    "applicant_type": "CORPORATE"
                },
                "state": CaseState.BCC_REVIEW.value,
                "assigned_owner": "Board Credit Committee (BCC) Queue",
                "assigned_analyst": "Babatunde Adebayo",
                "turnover": 85500000.0,
                "debt_service": 1200000.0,
                "opex": 24000000.0,
                "collateral_value": 92000000.0,
                "collateral_desc": "Tripartite Domiciliation of Contract Proceeds with P.A. Lawrence + Lien on 12 Mack Heavy Haulage Trucks (Value: ₦92,000,000)",
                "created_at": two_days_ago,
                "history_approvals": [
                    {"actor": "Babatunde Adebayo", "role": "ANALYST", "decision": "RECOMMEND_APPROVE", "comments": "Verified ₦1.026B annual turnover across UBA & FirstBank accounts. DSCR 1.48x covers debt service robustly."},
                    {"actor": "Chidinma Okafor", "role": "HRM", "decision": "RECOMMEND_APPROVE", "comments": "Structured 12-page CAM completed. Recommended with mandatory fleet GPS tracking and contract escrow domiciliation. Routed to Head of BD."},
                    {"actor": "Dapo Adeleke", "role": "HEAD_OF_BD", "decision": "RECOMMEND_APPROVE", "comments": "Commercial terms validated. Strong corporate anchor (P.A. Lawrence Ltd). Pricing set at 28% APR. Returned to HRM."},
                    {"actor": "Chidinma Okafor", "role": "HRM", "decision": "RECOMMEND_APPROVE", "comments": "Final risk concurrence verified. Forwarded to MD for high-value facility review."},
                    {"actor": "Folashade Tinubu", "role": "MD", "decision": "RECOMMEND_APPROVE", "comments": "Facility exceeds ₦20,000,000 executive limit (Requested ₦45M). Endorsed and escalated to Board Credit Committee (BCC) for final sanction."}
                ],
                "active_exception": None,
                "offer_status": None
            },

            # CASE 4: Healthcare & Diagnostics Equipment Lease (MD Decision Demo <= ₦20M)
            {
                "case_number": "OFL-2026-00004",
                "customer": {
                    "customer_type": "SME",
                    "name": "Medilink Diagnostic & Imaging Services Ltd",
                    "email": "procurement@medilinkdiagnostics.ng",
                    "phone": "0803 555 7890",
                    "bvn": "22998811223",
                    "nin": "55667788990",
                    "rc_number": "RC-1402911",
                    "external_references": {
                        "channel": "OFL_DIRECT",
                        "sector": "Healthcare & Medical Diagnostics",
                        "registered_address": "Plot 8B, Adeola Odeku Street, Victoria Island, Lagos",
                        "promoter_name": "Dr. Olayinka Fashola",
                        "guarantor_name": "Prof. Babafemi Solarin",
                        "guarantor_bvn": "22446688112"
                    },
                    "verified_attributes": {"cac_active": True, "bvn_verified": True, "hefam_licensed": True}
                },
                "application": {
                    "amount": 15000000.0,
                    "tenor": 18,
                    "purpose": "Lease financing for GE Healthcare 64-slice CT Scanner and 4D Ultrasound workstation",
                    "intake_channel": IntakeChannel.OFL_DIRECT.value,
                    "applicant_type": "SME"
                },
                "state": CaseState.MD_DECISION.value,
                "assigned_owner": "Managing Director Queue",
                "assigned_analyst": "Babatunde Adebayo",
                "turnover": 38000000.0,
                "debt_service": 650000.0,
                "opex": 9500000.0,
                "collateral_value": 32000000.0,
                "collateral_desc": "Equipment Lien on GE CT Scanner & Ultrasound Machine + All Assets Floating Charge (Value: ₦32,000,000)",
                "created_at": yesterday,
                "history_approvals": [
                    {"actor": "Babatunde Adebayo", "role": "ANALYST", "decision": "RECOMMEND_APPROVE", "comments": "Healthcare cashflow covers repayment 2.10x. Verified 6-month Zenith Bank turnover of ₦228M. Submitted to MCC."},
                    {"actor": "Dapo Adeleke", "role": "HEAD_OF_BD", "decision": "APPROVE", "comments": "Head of BD (MCC) confirmed commercial viability. High-margin imaging center in Victoria Island. Forwarded to HRM."},
                    {"actor": "Chidinma Okafor", "role": "HRM", "decision": "APPROVE", "comments": "Risk concurrence verified with equipment vendor warranty and insurance. Forwarded to MD for executive sanction."}
                ],
                "active_exception": None,
                "offer_status": None
            },

            # CASE 5: Offshore Maritime Logistics (Head of BD Review Demo)
            {
                "case_number": "OFL-2026-00005",
                "customer": {
                    "customer_type": "CORPORATE",
                    "name": "Apex Marine & Offshore Logistics Limited",
                    "email": "operations@apexmarine.ng",
                    "phone": "0805 777 9900",
                    "bvn": "22881144773",
                    "nin": "66778899001",
                    "rc_number": "RC-1589302",
                    "external_references": {
                        "channel": "OFL_DIRECT",
                        "sector": "Maritime Logistics & Energy Services",
                        "registered_address": "22 Marina Road, Onikan, Lagos Island",
                        "promoter_name": "Engr. Tariere Briggs",
                        "guarantor_name": "Chief Alabo Graham",
                        "guarantor_bvn": "22114477889"
                    },
                    "verified_attributes": {"cac_active": True, "bvn_verified": True, "nimasa_certified": True}
                },
                "application": {
                    "amount": 12000000.0,
                    "tenor": 12,
                    "purpose": "Project mobilization and vessel dry-docking bunkering for NLNG Bonny Island supply contract",
                    "intake_channel": IntakeChannel.OFL_DIRECT.value,
                    "applicant_type": "CORPORATE"
                },
                "state": CaseState.HEAD_OF_BD_REVIEW.value,
                "assigned_owner": "Head of Business Development Queue",
                "assigned_analyst": "Babatunde Adebayo",
                "turnover": 45000000.0,
                "debt_service": 850000.0,
                "opex": 14000000.0,
                "collateral_value": 26000000.0,
                "collateral_desc": "Marine Vessel Mortgage & Irrevocable Domiciliation of NLNG Contract Inflow (Value: ₦26,000,000)",
                "created_at": yesterday,
                "history_approvals": [
                    {"actor": "Babatunde Adebayo", "role": "ANALYST", "decision": "RECOMMEND_APPROVE", "comments": "Marine contract verified with NLNG procurement desk. DSCR 1.95x; submitted to Management Credit Committee (Head of BD)."}
                ],
                "active_exception": None,
                "offer_status": None
            },

            # CASE 6: Food Processing SME (HRM Review & AI CAM Generation Demo)
            {
                "case_number": "OFL-2026-00006",
                "customer": {
                    "customer_type": "SME",
                    "name": "Sunrise Confectioneries & Foods Nigeria Limited",
                    "email": "factory@sunrisefoods.ng",
                    "phone": "0803 222 1100",
                    "bvn": "22336699881",
                    "nin": "77889900112",
                    "rc_number": "RC-983412",
                    "external_references": {
                        "channel": "OFL_DIRECT",
                        "sector": "Food Manufacturing & Processing",
                        "registered_address": "Plot 5, Acme Road, Ogba Industrial Estate, Ikeja, Lagos",
                        "promoter_name": "Alhaji Raufu Adele",
                        "guarantor_name": "Alhaja Kuburat Adele",
                        "guarantor_bvn": "22557799113"
                    },
                    "verified_attributes": {"cac_active": True, "bvn_verified": True, "nafdac_registered": True}
                },
                "application": {
                    "amount": 6000000.0,
                    "tenor": 9,
                    "purpose": "Raw materials inventory procurement (bakery flour, granulated sugar, and vegetable fat)",
                    "intake_channel": IntakeChannel.OFL_DIRECT.value,
                    "applicant_type": "SME"
                },
                "state": CaseState.HRM_REVIEW.value,
                "assigned_owner": "Head of Risk Management Queue",
                "assigned_analyst": "Babatunde Adebayo",
                "turnover": 18200000.0,
                "debt_service": 210000.0,
                "opex": 4900000.0,
                "collateral_value": 14000000.0,
                "collateral_desc": "Commercial Property Title Document (Ogba, Ikeja) + Inventory Pledge (Value: ₦14,000,000)",
                "created_at": yesterday,
                "history_approvals": [
                    {"actor": "Babatunde Adebayo", "role": "ANALYST", "decision": "RECOMMEND_APPROVE", "comments": "Completed bank statement analysis across GTBank statements. DSCR 1.74x. Submitted to MCC."},
                    {"actor": "Dapo Adeleke", "role": "HEAD_OF_BD", "decision": "APPROVE", "comments": "Head of BD (MCC) reviewed and satisfied with commercial terms; forwarded to Head of Risk Management."}
                ],
                "active_exception": None,
                "offer_status": None
            },

            # CASE 7: Telecommunications & Fiber Optic (Disbursed & Ongoing Monitoring Demo)
            {
                "case_number": "OFL-2026-00007",
                "customer": {
                    "customer_type": "CORPORATE",
                    "name": "Nexus Broadband & Telecom Solutions Ltd",
                    "email": "finance@nexusbroadband.ng",
                    "phone": "0809 444 8822",
                    "bvn": "22001133557",
                    "nin": "88990011223",
                    "rc_number": "RC-1678234",
                    "external_references": {
                        "channel": "OFL_DIRECT",
                        "sector": "Telecommunications & Technology",
                        "registered_address": "8 Isaac John Street, GRA Ikeja, Lagos",
                        "promoter_name": "Engr. Chidi Okonkwo",
                        "guarantor_name": "Barr. Kingsley Umeh",
                        "guarantor_bvn": "22778899331"
                    },
                    "verified_attributes": {"cac_active": True, "bvn_verified": True, "ncc_licensed": True}
                },
                "application": {
                    "amount": 28000000.0,
                    "tenor": 24,
                    "purpose": "Metropolitan fiber cable deployment for Lagos State Smart City project",
                    "intake_channel": IntakeChannel.OFL_DIRECT.value,
                    "applicant_type": "CORPORATE"
                },
                "state": CaseState.DISBURSED_MONITORING.value,
                "assigned_owner": "Portfolio Monitoring & Treasury",
                "assigned_analyst": "Babatunde Adebayo",
                "turnover": 62000000.0,
                "debt_service": 950000.0,
                "opex": 16000000.0,
                "collateral_value": 55000000.0,
                "collateral_desc": "All Assets Debenture + Domiciliation of Lagos State Infrastructure Inflows (Value: ₦55,000,000)",
                "created_at": one_week_ago,
                "history_approvals": [
                    {"actor": "Babatunde Adebayo", "role": "ANALYST", "decision": "RECOMMEND_APPROVE", "comments": "Telecom infrastructure project vetted. DSCR 1.88x."},
                    {"actor": "Dapo Adeleke", "role": "HEAD_OF_BD", "decision": "APPROVE", "comments": "Strategic telecom client. Commercial viability confirmed by MCC."},
                    {"actor": "Chidinma Okafor", "role": "HRM", "decision": "APPROVE", "comments": "CAM completed. Recommended with tripartite escrow; forwarded to MD."},
                    {"actor": "Folashade Tinubu", "role": "MD", "decision": "RECOMMEND_APPROVE", "comments": "Endorsed for BCC approval (> ₦20M)."},
                    {"actor": "Emeka Nnamdi", "role": "BCC", "decision": "APPROVE", "comments": "Board Credit Committee unanimous approval granted."}
                ],
                "active_exception": None,
                "offer_status": "ACCEPTED",
                "disbursement": {
                    "nav_reference": "NAV-DISB-20261028-091",
                    "loandisc_id": "LD-202610-8912",
                    "amount": 28000000.0,
                    "evidence": "Access Bank NIP Transfer Reference NIP-20261028-091823. LOAN-DISC LMS Booking confirmed."
                },
                "loan_performance": {
                    "scenario": "CURRENT",
                    "installments_serviced": 2
                }
            },

            # CASE 8: Commercial Agro Merchant (BDO Assisted Intake & Rework Demo)
            {
                "case_number": "OFL-2026-00008",
                "customer": {
                    "customer_type": "SME",
                    "name": "Crestview Agro & Grain Distribution Ltd",
                    "email": "director@crestvieweng.ng",
                    "phone": "0802 666 3399",
                    "bvn": "22448811995",
                    "nin": "99001122334",
                    "rc_number": "RC-1102934",
                    "external_references": {
                        "channel": "BDO_ASSISTED",
                        "bdo_agent": "Segun Adeleke (BDO)",
                        "sector": "Civil Engineering & Heavy Construction",
                        "registered_address": "Kilometer 42, Lekki-Epe Expressway, Sangotedo, Lagos",
                        "promoter_name": "Engr. Olufemi Adeleke",
                        "guarantor_name": "Chief Adekunle Balogun",
                        "guarantor_bvn": "22331199884"
                    },
                    "verified_attributes": {"cac_active": True, "bvn_verified": True}
                },
                "application": {
                    "amount": 7200000.0,
                    "tenor": 12,
                    "purpose": "Heavy Caterpillar Excavator engine overhaul and quarry lease mobilization",
                    "intake_channel": IntakeChannel.OFL_DIRECT.value,
                    "applicant_type": "SME"
                },
                "state": CaseState.BDO_REWORK.value,
                "assigned_owner": "Business Development Officer (Segun Adeleke)",
                "assigned_analyst": "Babatunde Adebayo",
                "turnover": 14000000.0,
                "debt_service": 420000.0,
                "opex": 5800000.0,
                "collateral_value": 16000000.0,
                "collateral_desc": "CAT 320D Hydraulic Excavator Serial #CAT0320DPBR8912 (Value: ₦16,000,000)",
                "created_at": yesterday,
                "history_approvals": [],
                "active_exception": {
                    "category": "APPLICANT_CORRECTION",
                    "originator_role": "Credit Analyst",
                    "originator_name": "Babatunde Adebayo",
                    "origin_stage": "Analyst Review",
                    "owner": "Business Development Officer",
                    "return_stage": "BDO Rework",
                    "reason": "Missing Q3 turnover ledger & updated 6-month bank statement CSV.",
                    "comments": "Credit Analyst requested BDO Segun Adeleke obtain updated bank statement and proof of store lease before presentation to MCC.",
                    "sla_hours": 24,
                    "status": "OPEN"
                },
                "offer_status": None
            },

            # CASE 9: Fast-Moving FMCG Distributor (Offer Letter & Bespoke Fee Schedule Demo)
            {
                "case_number": "OFL-2026-00009",
                "customer": {
                    "customer_type": "SME",
                    "name": "Golden Prime Distribution & Wholesales Ltd",
                    "email": "md@goldenprimeltd.ng",
                    "phone": "0803 888 2211",
                    "bvn": "22771199446",
                    "nin": "11335577992",
                    "rc_number": "RC-1748291",
                    "external_references": {
                        "channel": "OFL_DIRECT",
                        "sector": "FMCG Wholesale & Trade Distributorship",
                        "registered_address": "Zone B, Block 12, Alaba International Market, Ojo, Lagos",
                        "promoter_name": "Chief Innocent Nwachukwu",
                        "guarantor_name": "Mr. Obinna Nwachukwu",
                        "guarantor_bvn": "22997755331"
                    },
                    "verified_attributes": {"cac_active": True, "bvn_verified": True}
                },
                "application": {
                    "amount": 18000000.0,
                    "tenor": 12,
                    "purpose": "Working capital financing for Dangote Sugar & Flour Mills regional distributorship",
                    "intake_channel": IntakeChannel.OFL_DIRECT.value,
                    "applicant_type": "SME"
                },
                "state": CaseState.OFFER_PENDING.value,
                "assigned_owner": "Credit Operations (Offer Issuance)",
                "assigned_analyst": "Babatunde Adebayo",
                "turnover": 52000000.0,
                "debt_service": 450000.0,
                "opex": 11500000.0,
                "collateral_value": 36000000.0,
                "collateral_desc": "Commercial Property Title Deed at Alaba International Market + All Assets Debenture (Value: ₦36,000,000)",
                "created_at": yesterday,
                "history_approvals": [
                    {"actor": "Babatunde Adebayo", "role": "ANALYST", "decision": "RECOMMEND_APPROVE", "comments": "FMCG distributor turnover of ₦52M/mo strongly covers debt service; submitted to MCC."},
                    {"actor": "Dapo Adeleke", "role": "HEAD_OF_BD", "decision": "APPROVE", "comments": "Top tier FMCG distributor in Alaba market. Pricing accepted at 28% APR; approved to HRM."},
                    {"actor": "Chidinma Okafor", "role": "HRM", "decision": "APPROVE", "comments": "Risk concurrence confirmed with stock monitoring covenants; forwarded to MD."},
                    {"actor": "Folashade Tinubu", "role": "MD", "decision": "APPROVE", "comments": "Approved within MD authority (₦18M <= ₦20M limit). Offer letter auto-generated and dispatched."}
                ],
                "active_exception": None,
                "offer_status": "ISSUED"
            },

            # CASE 10: Konga Merchant Solutions (Disbursed & In 7-Day Grace Period Telemetry Demo)
            {
                "case_number": "OFL-2026-00010",
                "customer": {
                    "customer_type": "SME",
                    "name": "Konga Merchant Hub & E-Commerce Solutions Ltd",
                    "email": "payments@kongamerchanthub.ng",
                    "phone": "0803 777 1234",
                    "bvn": "22441188330",
                    "nin": "11993355771",
                    "rc_number": "RC-1849102",
                    "external_references": {
                        "channel": "OFL_DIRECT",
                        "sector": "E-Commerce & Digital Merchant Distribution",
                        "registered_address": "Plot 12, Commercial Block, Ikeja Computer Village, Lagos",
                        "promoter_name": "Mr. Kelechi Nwosu",
                        "guarantor_name": "Mrs. Amaka Nwosu",
                        "guarantor_bvn": "22991144665"
                    },
                    "verified_attributes": {"cac_active": True, "bvn_verified": True}
                },
                "application": {
                    "amount": 16000000.0,
                    "tenor": 12,
                    "purpose": "E-commerce seasonal inventory stocking and fulfillment center expansion",
                    "intake_channel": IntakeChannel.OFL_DIRECT.value,
                    "applicant_type": "SME"
                },
                "state": CaseState.DISBURSED_MONITORING.value,
                "assigned_owner": "Portfolio Monitoring & Treasury",
                "assigned_analyst": "Babatunde Adebayo",
                "turnover": 42000000.0,
                "debt_service": 580000.0,
                "opex": 9200000.0,
                "collateral_value": 30000000.0,
                "collateral_desc": "Inventory Floating Charge + Commercial Warehouse Lease Assignment (Value: ₦30,000,000)",
                "created_at": one_week_ago,
                "history_approvals": [
                    {"actor": "Babatunde Adebayo", "role": "ANALYST", "decision": "RECOMMEND_APPROVE", "comments": "Strong turnover across GTBank merchant accounts. Submitted to MCC."},
                    {"actor": "Dapo Adeleke", "role": "HEAD_OF_BD", "decision": "APPROVE", "comments": "Fast turnover rate in electronics distribution. Approved to HRM."},
                    {"actor": "Chidinma Okafor", "role": "HRM", "decision": "APPROVE", "comments": "Risk parameters satisfied. Approved to MD."},
                    {"actor": "Folashade Tinubu", "role": "MD", "decision": "APPROVE", "comments": "Executive approval granted (₦16M <= ₦20M)."}
                ],
                "active_exception": None,
                "offer_status": "ACCEPTED",
                "disbursement": {
                    "nav_reference": "NAV-DISB-20261025-081",
                    "loandisc_id": "LD-202610-7719",
                    "amount": 16000000.0,
                    "evidence": "Zenith Bank NIP Confirmation Reference NIP-20261025-081234."
                },
                "loan_performance": {
                    "scenario": "GRACE_PERIOD",
                    "installments_serviced": 1,
                    "days_overdue": 4
                }
            },

            # CASE 11: Swift Logistics Express (Disbursed & Overdue with 5% Default Penalty Telemetry Demo)
            {
                "case_number": "OFL-2026-00011",
                "customer": {
                    "customer_type": "SME",
                    "name": "Swift Logistics & Interstate Haulage Ltd",
                    "email": "operations@swiftlogistics.ng",
                    "phone": "0802 888 9911",
                    "bvn": "22883399114",
                    "nin": "55779911332",
                    "rc_number": "RC-1309481",
                    "external_references": {
                        "channel": "OFL_DIRECT",
                        "sector": "Freight Haulage & Cold Chain Transport",
                        "registered_address": "Km 18, Ikorodu-Sagamu Expressway, Ikorodu, Lagos",
                        "promoter_name": "Alhaji Haruna Danladi",
                        "guarantor_name": "Dr. Kabir Danladi",
                        "guarantor_bvn": "22338877119"
                    },
                    "verified_attributes": {"cac_active": True, "bvn_verified": True}
                },
                "application": {
                    "amount": 12500000.0,
                    "tenor": 12,
                    "purpose": "Fleet acquisition of 2 refrigerated 15-ton trucks for pharmaceutical logistics",
                    "intake_channel": IntakeChannel.OFL_DIRECT.value,
                    "applicant_type": "SME"
                },
                "state": CaseState.DISBURSED_MONITORING.value,
                "assigned_owner": "Portfolio Monitoring & Treasury (Default Recovery)",
                "assigned_analyst": "Babatunde Adebayo",
                "turnover": 31000000.0,
                "debt_service": 480000.0,
                "opex": 7500000.0,
                "collateral_value": 24000000.0,
                "collateral_desc": "Equipment Lien on 2 Refrigerated Trucks + Corporate Guarantee (Value: ₦24,000,000)",
                "created_at": one_week_ago,
                "history_approvals": [
                    {"actor": "Babatunde Adebayo", "role": "ANALYST", "decision": "RECOMMEND_APPROVE", "comments": "Cold chain contract with pharmaceutical clients verified. Submitted to MCC."},
                    {"actor": "Dapo Adeleke", "role": "HEAD_OF_BD", "decision": "APPROVE", "comments": "Approved and forwarded to HRM."},
                    {"actor": "Chidinma Okafor", "role": "HRM", "decision": "APPROVE", "comments": "Approved and forwarded to MD."},
                    {"actor": "Folashade Tinubu", "role": "MD", "decision": "APPROVE", "comments": "Executive approval granted."}
                ],
                "active_exception": None,
                "offer_status": "ACCEPTED",
                "disbursement": {
                    "nav_reference": "NAV-DISB-20261020-044",
                    "loandisc_id": "LD-202610-6642",
                    "amount": 12500000.0,
                    "evidence": "FirstBank NIP Settlement Confirmation NIP-20261020-044910."
                },
                "loan_performance": {
                    "scenario": "OVERDUE_PENALTY",
                    "installments_serviced": 0,
                    "days_overdue": 11
                }
            }
        ]

        master_fee_catalog = ConfigManager.get_fee_catalog(db)

        # 4. Populate each case
        for spec in demo_cases_spec:
            c_data = spec["customer"]
            ext_refs = c_data.get("external_references", {})
            bus_addr = ext_refs.get("registered_address", "Plot 10, Commercial District, Victoria Island, Lagos State")
            res_addr = ext_refs.get("residential_address", "15, Admiralty Way, Lekki Phase 1, Lagos State")
            
            verified_attrs = dict(c_data.get("verified_attributes", {}))
            verified_attrs.setdefault("business_address", bus_addr)
            verified_attrs.setdefault("residential_address", res_addr)
            verified_attrs.setdefault("means_of_id_type", "NATIONAL_ID")
            verified_attrs.setdefault("means_of_id_number", f"NIN-{c_data.get('nin', '65858750946')}")
            verified_attrs.setdefault("id_validity_status", "VALID_ACTIVE")

            customer = Customer(
                customer_type=c_data["customer_type"],
                name=c_data["name"],
                email=c_data["email"],
                phone=c_data["phone"],
                bvn=c_data["bvn"],
                nin=c_data["nin"],
                rc_number=c_data["rc_number"],
                external_references=ext_refs,
                verified_attributes=verified_attrs,
                created_at=spec["created_at"]
            )
            db.add(customer)
            db.flush()

            a_data = spec["application"]
            raw_payload = {
                "business_address": bus_addr,
                "residential_address": res_addr,
                "means_of_id_type": verified_attrs["means_of_id_type"],
                "means_of_id_number": verified_attrs["means_of_id_number"],
                "collateral_description": spec.get("collateral_desc")
            }
            application = Application(
                customer_id=customer.id,
                amount=a_data["amount"],
                currency="NGN",
                tenor=a_data["tenor"],
                purpose=a_data["purpose"],
                intake_channel=a_data["intake_channel"],
                status="SUBMITTED",
                applicant_type=a_data["applicant_type"],
                raw_payload=raw_payload,
                created_at=spec["created_at"]
            )
            db.add(application)
            db.flush()

            credit_case = CreditCase(
                application_id=application.id,
                case_number=spec["case_number"],
                state=spec["state"],
                revision=1,
                assigned_owner=spec["assigned_owner"],
                assigned_analyst=spec["assigned_analyst"],
                created_at=spec["created_at"],
                updated_at=now
            )
            db.add(credit_case)
            db.flush()

            # Create KYC Check
            kyc = KYCCheck(
                case_id=credit_case.id,
                provider="YOUVERIFY",
                provider_ref=f"YV-REF-{credit_case.case_number}-{uuid.uuid4().hex[:6].upper()}",
                status="PASSED" if not spec.get("active_exception") else "MISMATCH",
                result_summary={
                    "bvn_match": True,
                    "nin_match": False if spec.get("active_exception") else True,
                    "cac_status": "ACTIVE",
                    "pep_sanction_check": "CLEAN",
                    "watchlist_hit": False,
                    "risk_rating": "LOW" if not spec.get("active_exception") else "MEDIUM",
                    "means_of_id_verified": True,
                    "utility_bill_verified": True
                },
                reviewed_by="Automated Youverify Verification Gateway",
                reviewed_at=spec["created_at"]
            )
            db.add(kyc)

            # Create Comprehensive List of Essential Documents
            safe_name = c_data['name'].replace(' ', '_').replace('&', 'and')
            doc_specs = [
                ("BANK_STATEMENT", f"Bank_Statement_6M_{safe_name}.pdf", "Verified 6-Month Corporate Bank Statement with NIBSS e-stamp"),
                ("MEANS_OF_ID", f"Valid_National_ID_Card_{c_data.get('nin', '11223344')}.pdf", "Government Issued Valid National ID / NIN Slip (Unexpired)"),
                ("UTILITY_BILL", f"EKEDC_Electricity_Utility_Bill_{c_data.get('rc_number', 'UTL')}.pdf", "Valid Electricity Utility Bill (Dated within last 3 months - <= 6 months)"),
                ("PASSPORT_PHOTO", f"Director_Passport_Photo_{safe_name}.jpg", "Recent White-Background Portrait Photograph of Managing Director"),
                ("WORK_ID", f"Corporate_Staff_ID_{safe_name}.pdf", "Verified Workplace Staff Means of Identification"),
                ("CAC_REGISTRATION", f"CAC_Registration_{c_data['rc_number']}.pdf", "CAC Certificate of Incorporation, Status Report & MemArt"),
                ("COLLATERAL_DOCUMENT", f"Collateral_Deed_Valuation_{credit_case.case_number}.pdf", f"Evidence of Collateral Backing: {spec.get('collateral_desc')}"),
                ("CONTRACT_PO", f"Contract_Award_PO_{credit_case.case_number}.pdf", "Executing Commercial Contract / Verified Purchase Order"),
                ("OTHER_SUPPORTING", f"Tax_Clearance_and_Board_Resolution_{credit_case.case_number}.pdf", "Audited Financials, Tax Clearance & Corporate Resolution")
            ]
            for doc_type, filename, summary in doc_specs:
                doc = Document(
                    case_id=credit_case.id,
                    document_type=doc_type,
                    object_key=f"cases/{credit_case.id}/{doc_type}_{filename}",
                    checksum=sha256_text(filename + credit_case.case_number),
                    version=1,
                    scan_status="CLEAN",
                    original_filename=filename,
                    content_summary=summary,
                    uploaded_at=spec["created_at"]
                )
                db.add(doc)

            # Evaluate Financial Assessment
            monthly_turnover = spec["turnover"]
            monthly_debt = spec["debt_service"]
            monthly_opex = spec["opex"]
            collateral_val = spec["collateral_value"]
            loan_amount = a_data["amount"]
            tenor = a_data["tenor"]
            annual_rate = 0.28

            monthly_pmt = FinancialEngine.calculate_monthly_installment(loan_amount, annual_rate, tenor)
            net_available_cash = monthly_turnover - monthly_opex - monthly_debt
            dscr = round(net_available_cash / monthly_pmt, 2) if monthly_pmt > 0 else 2.5
            dsr_pct = round(((monthly_pmt + monthly_debt) / monthly_turnover) * 100, 2) if monthly_turnover > 0 else 15.0
            collateral_coverage = round(collateral_val / loan_amount, 2) if loan_amount > 0 else 2.0

            fin_assessment = FinancialAssessment(
                case_id=credit_case.id,
                formula_version="v2.0-opticom-cam-deterministic",
                input_snapshot={
                    "requested_amount": loan_amount,
                    "tenor_months": tenor,
                    "annual_interest_rate": annual_rate,
                    "average_monthly_sales": monthly_turnover,
                    "monthly_operating_expenses": monthly_opex,
                    "existing_monthly_debt_service": monthly_debt,
                    "collateral_value": collateral_val,
                    "collateral_description": spec["collateral_desc"]
                },
                calculated_ratios={
                    "recommended_amount": loan_amount,
                    "monthly_payment": monthly_pmt,
                    "dscr": dscr,
                    "dsr_percentage": dsr_pct,
                    "collateral_coverage_ratio": collateral_coverage,
                    "sol_compliant": loan_amount <= 50000000.0,
                    "policy_dscr_met": dscr >= 1.30,
                    "policy_dsr_met": dsr_pct <= 40.0
                },
                policy_flags=[] if dscr >= 1.30 and dsr_pct <= 40.0 else ["DTI_RATIO_EXCEEDS_POLICY_THRESHOLD"],
                performed_by="Deterministic Financial Engine",
                created_at=spec["created_at"]
            )
            db.add(fin_assessment)
            db.flush()

            # Build 12-Page Official CAM
            cam_template_data = {
                "facility_summary": {
                    "obligor": c_data["name"],
                    "rc_number": c_data["rc_number"],
                    "facility_type": "Commercial Term Loan / Working Capital",
                    "amount": loan_amount,
                    "tenor": f"{tenor} Months",
                    "interest_rate": "28.00% APR (CBN MPR 23.00% + Margin 5.00%)",
                    "repayment_mode": "Equal Monthly Principal & Interest Amortization",
                    "security": spec["collateral_desc"]
                },
                "profile": {
                    "company_name": c_data["name"],
                    "incorporation_date": "2018-04-12",
                    "rc_number": c_data["rc_number"],
                    "business_nature": spec["customer"]["external_references"].get("sector", "Commercial Trade"),
                    "registered_office": spec["customer"]["external_references"].get("registered_address", "Lagos, Nigeria"),
                    "key_promoters": spec["customer"]["external_references"].get("promoter_name", "Managing Director")
                },
                "purpose_of_request": {
                    "purpose": a_data["purpose"],
                    "commercial_rationale": "High turnover client with established institutional counterparties, providing strong cash conversion."
                },
                "financial_analysis": {
                    "monthly_turnover": monthly_turnover,
                    "dscr": dscr,
                    "dsr": dsr_pct,
                    "collateral_coverage": collateral_coverage
                },
                "risk_analysis_matrix": [
                    {"risk": "Credit / Default Risk", "mitigant": f"Secured by {spec['collateral_desc']} with {collateral_coverage * 100:.0f}% coverage.", "residual": "LOW"},
                    {"risk": "Market / Industry Volatility", "mitigant": "Essential sector demand with resilient operational margin.", "residual": "MEDIUM"},
                    {"risk": "Legal & Regulatory Compliance", "mitigant": "All corporate searches clean; CAC status verified active.", "residual": "LOW"}
                ],
                "recommendation": {
                    "verdict": "RECOMMENDED FOR APPROVAL",
                    "recommended_amount": loan_amount,
                    "tenor": tenor,
                    "pricing": "28.00% APR",
                    "covenants": [
                        "Direct domiciliation of commercial inflows to Opticom collection account.",
                        "Submission of quarterly management financial accounts.",
                        "Maintenance of comprehensive insurance policy with Opticom noted as first loss payee."
                    ]
                }
            }

            cam = CAMVersion(
                case_id=credit_case.id,
                version=1,
                source_snapshot={"model": "gemini-1.5-pro", "token_telemetry": {"total_tokens": 4200, "cost_usd": 0.042}},
                executive_summary=f"Opticom Commercial Credit Appraisal for {c_data['name']}. Facility amount: ₦{loan_amount:,.2f} over {tenor} months at 28.00% APR.",
                borrower_profile=f"The borrower, {c_data['name']} ({c_data['rc_number']}), is an established enterprise operating in the {spec['customer']['external_references'].get('sector', 'commercial')} sector.",
                facility_structure=f"Commercial credit facility of ₦{loan_amount:,.2f} structured on reducing-balance amortization with monthly repayment of ₦{monthly_pmt:,.2f}.",
                financial_analysis=f"Analysis of corporate bank statements demonstrates robust average monthly turnover of ₦{monthly_turnover:,.2f}. Debt Service Coverage Ratio (DSCR) stands at {dscr:.2f}x against policy minimum of 1.30x.",
                risk_and_mitigants=f"Collateral coverage is {collateral_coverage:.2f}x principal value, supported by {spec['collateral_desc']}.",
                policy_exceptions="None" if not spec.get("active_exception") else "Single Obligor and DTI threshold monitored under exception management.",
                recommendation=f"Recommended for sanction of ₦{loan_amount:,.2f} at 28.00% APR.",
                cam_data=cam_template_data,
                validation_status="ANALYST_VALIDATED" if spec["history_approvals"] else "DRAFT",
                analyst_sign_off=True if spec["history_approvals"] else False,
                signed_by="Babatunde Adebayo" if spec["history_approvals"] else None,
                signed_at=spec["created_at"] if spec["history_approvals"] else None,
                created_at=spec["created_at"]
            )
            db.add(cam)

            # Add Historical Approvals
            for app_spec in spec["history_approvals"]:
                appr = Approval(
                    case_id=credit_case.id,
                    revision=1,
                    terms_hash=TransitionService.calculate_terms_hash(loan_amount, tenor, annual_rate, customer.id),
                    actor=app_spec["actor"],
                    authority_level=app_spec["role"],
                    decision=app_spec["decision"],
                    comments=app_spec["comments"],
                    conditions_mandated=[],
                    created_at=spec["created_at"] + timedelta(hours=2)
                )
                db.add(appr)

            # Add Conditions Precedent if specified
            if "conditions_precedent" in spec:
                for cp in spec["conditions_precedent"]:
                    c_item = ConditionItem(
                        case_id=credit_case.id,
                        condition_type="PRE_DISBURSEMENT",
                        description=cp["desc"],
                        mandatory=True,
                        status=cp["status"],
                        verified_by=cp.get("verified_by"),
                        verified_at=now if cp["status"] == "SATISFIED" else None,
                        created_at=spec["created_at"]
                    )
                    db.add(c_item)

            # Add Offer if stage has offer
            if spec.get("offer_status"):
                # Compute fees from master fee catalog
                fee_items = [
                    {
                        "id": f.get("id"),
                        "name": f.get("name"),
                        "fee_type": f.get("fee_type", "PERCENTAGE"),
                        "rate": f.get("rate", 0.0),
                        "is_selected": True,
                        "description": f.get("description", "")
                    }
                    for f in master_fee_catalog
                ]
                fee_calc = ConfigManager.calculate_case_fees(loan_amount, fee_items)
                offer = Offer(
                    case_id=credit_case.id,
                    terms_hash=TransitionService.calculate_terms_hash(loan_amount, tenor, annual_rate, customer.id),
                    approved_amount=loan_amount,
                    tenor_months=tenor,
                    interest_rate_pct=28.0,
                    monthly_repayment=monthly_pmt,
                    issued_at=now - timedelta(days=1),
                    expiry=now + timedelta(days=14),
                    status=spec["offer_status"],
                    acceptance_evidence="Signed Facility Term Sheet & Board Acceptance Resolution on file" if spec["offer_status"] == "ACCEPTED" else None,
                    accepted_at=now - timedelta(hours=4) if spec["offer_status"] == "ACCEPTED" else None,
                    fee_schedule=fee_items,
                    total_fees=fee_calc["total_fees"],
                    net_disbursement=fee_calc["net_disbursement"]
                )
                db.add(offer)

            # Add Disbursement if specified
            if "disbursement" in spec:
                disb_spec = spec["disbursement"]
                disb = Disbursement(
                    case_id=credit_case.id,
                    nav_reference=disb_spec["nav_reference"],
                    amount=disb_spec["amount"],
                    confirmation_evidence=disb_spec["evidence"],
                    status="CONFIRMED",
                    recorded_by="Ibrahim Musa (Treasury Lead)",
                    created_at=now - timedelta(days=2)
                )
                db.add(disb)
                db.flush()

            # Initialize Post-Disbursement Loan Performance Telemetry if specified
            if credit_case.state == CaseState.DISBURSED_MONITORING.value or spec.get("loan_performance"):
                perf_spec = spec.get("loan_performance") or {"scenario": "CURRENT"}
                perf_record = LoanPerformanceEngine.initialize_loan_performance(credit_case, db)
                db.flush()
                if "installments_serviced" in perf_spec and perf_spec["installments_serviced"] > 0:
                    for _ in range(perf_spec["installments_serviced"]):
                        LoanPerformanceEngine.record_repayment(perf_record, perf_record.monthly_installment, db=db)
                if "scenario" in perf_spec:
                    LoanPerformanceEngine.simulate_status(perf_record, perf_spec["scenario"], db=db)
                if "days_overdue" in perf_spec:
                    perf_record.days_overdue = perf_spec["days_overdue"]
                    LoanPerformanceEngine.evaluate_performance(perf_record)
                db.flush()

            # Add Exception if specified
            if spec.get("active_exception"):
                ex_spec = spec["active_exception"]
                ex_item = ExceptionItem(
                    case_id=credit_case.id,
                    category=ex_spec["category"],
                    originator_role=ex_spec["originator_role"],
                    originator_name=ex_spec["originator_name"],
                    origin_stage=ex_spec["origin_stage"],
                    owner=ex_spec["owner"],
                    return_stage=ex_spec["return_stage"],
                    reason=ex_spec["reason"],
                    comments=ex_spec["comments"],
                    version=1,
                    sla_hours=ex_spec["sla_hours"],
                    sla_due_at=now + timedelta(hours=ex_spec["sla_hours"]),
                    status=ex_spec["status"],
                    created_at=spec["created_at"]
                )
                db.add(ex_item)

            # Add Audit Trail Event
            audit = AuditEvent(
                actor=spec["assigned_analyst"],
                role="ANALYST",
                event="CASE_INGESTION_AND_EVALUATION",
                entity="CreditCase",
                entity_id=credit_case.id,
                timestamp=spec["created_at"],
                correlation_id=f"AUDIT-{credit_case.case_number}",
                reason=f"Application initialized in stage {credit_case.state}",
                details={"amount": loan_amount, "tenor": tenor, "state": credit_case.state}
            )
            db.add(audit)

        # Clean test integration events to guarantee test idempotency
        db.query(IntegrationEvent).filter(IntegrationEvent.idempotency_key.like('%TEST%')).delete(synchronize_session=False)
        db.commit()
        print(f"SUCCESS: Successfully populated {len(demo_cases_spec)} comprehensive executive demo cases!")
        print("\nPipeline Stage Distribution for Today's Management Demo:")
        for spec in demo_cases_spec:
            print(f"  • {spec['case_number']}: {spec['customer']['name']:<45} | ₦{spec['application']['amount']:>12,.2f} | Stage: {spec['state']}")

    except Exception as e:
        db.rollback()
        print(f"ERROR: Failed to seed demo data: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        if owns_session:
            db.close()

if __name__ == "__main__":
    seed_demo()
