"""
Enterprise Credit Underwriting AI Copilot & Chatbot Router
Powered by Google Cloud Vertex AI (Gemini) with Opticom Credit Knowledge Base.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...database import get_db
from ...models.entities import CreditCase, FinancialAssessment
from ...config import settings
from ...integrations.vertex_ai_service import VertexAICamService

router = APIRouter(prefix="/copilot", tags=["AI Copilot & Underwriter Assistant"])

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class CopilotQueryRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    case_id: Optional[str] = None
    persona: Optional[str] = "Credit Analyst"

OPTICOM_CREDIT_POLICY_CONTEXT = """
You are the Opticom Finance Limited (OFL) Senior Underwriting AI Copilot.
You assist credit analysts, risk managers, and credit committee members in evaluating commercial debt facilities.

OPTICOM COMMERCIAL CREDIT POLICY RULES:
- Minimum Facility Ticket: ₦2,000,000 (Facilities <= ₦2,000,000 are routed to BESTO retail platform)
- Maximum Single Obligor Limit: ₦50,000,000 (Facilities > ₦50,000,000 require full Board Credit Committee / MD sanction)
- Maximum Ticket Capability: ₦200,000,000
- Standard Tenor Range: 3 to 24 Months
- Benchmark Interest Pricing: CBN MPR (23.00%) + Commercial Risk Spread (5.00%) = 28.00% APR (Fixed per annum)
- Upfront Processing & Legal Fees: 4.50% (Facility Fee 1.5%, Management 1.5%, Legal & Stamping 1.5%)
- Key Ratios & Hard Bounds:
  * Minimum DSCR (Debt Service Coverage Ratio): 1.20x
  * Minimum ICR (Interest Coverage Ratio): 1.50x
  * Maximum Leverage (Total Debt / Equity): 3.00x
  * Minimum Current Ratio: 1.10x
  * Minimum Forced Sale Value (FSV) Collateral Coverage: 1.20x (120% of requested quantum)
- Core Banking & LMS: LOAN-DISC is the sole Loan Management System for loan booking and automated disbursement execution.
- Head Office: 10th Floor, UAC House, 1-5 Odunlami St, Lagos Island, Lagos 101001, Nigeria.
"""

def generate_offline_copilot_response(
    query: str, 
    case_context: Optional[str] = None, 
    persona: str = "Credit Analyst"
) -> str:
    q = query.lower()

    if "mpr" in q or "apr" in q or "interest" in q or "rate" in q:
        return (
            "### Interest Rate & Pricing Architecture\n\n"
            "* **CBN Monetary Policy Rate (MPR)**: Currently **23.00%**. This is the macroeconomic baseline set by the Central Bank of Nigeria.\n"
            "* **Opticom Facility APR**: **28.00% APR** (calculated as `23% MPR + 5% Commercial Risk Spread`).\n"
            "* **Upfront Fees**: ~4.5% total (1.5% management, 1.5% facility appraisal, 1.5% legal & perfection).\n\n"
            "> **Policy Note**: When the CBN MPC adjusts the MPR, Opticom's Asset & Liability Committee (ALCO) reviews spreads to maintain risk-adjusted margin."
        )

    if "dscr" in q or "ratio" in q or "formula" in q:
        return (
            "### Opticom Credit Ratio Benchmarks & Formulas\n\n"
            "1. **Debt Service Coverage Ratio (DSCR)**: `Net Operating Income (NOI) / Total Debt Service (P+I)`\n"
            "   * *Opticom Benchmark*: **>= 1.20x** (Breaches trigger a policy exception requiring HRM review).\n"
            "2. **Interest Coverage Ratio (ICR)**: `EBITDA / Annual Interest Expense`\n"
            "   * *Opticom Benchmark*: **>= 1.50x**.\n"
            "3. **Collateral Coverage (FSV)**: `Forced Sale Value of Collateral / Facility Quantum`\n"
            "   * *Opticom Benchmark*: **>= 1.20x (120%)**.\n"
            "4. **Current Ratio**: `Current Assets / Current Liabilities`\n"
            "   * *Opticom Benchmark*: **>= 1.10x**."
        )

    if "limit" in q or "obligor" in q or "authority" in q or "sanction" in q:
        return (
            "### Opticom Credit Delegation & Authority Matrix\n\n"
            "* **Head of Risk Management (HRM)**: Approvals up to **₦5,000,000**.\n"
            "* **Board Credit Committee (BCC)**: Sanction authority up to **₦15,000,000**.\n"
            "* **Managing Director / CEO (MD)**: Sanction authority for facilities **> ₦15,000,000 (Unlimited)**.\n"
            "* **Single Obligor Limit (SOL)**: **₦50,000,000** per corporate group.\n"
            "* **Maximum Facility Ticket**: **₦200,000,000**."
        )

    if case_context and ("case" in q or "summar" in q or "risk" in q or "borrower" in q or "this" in q):
        return (
            f"### Active Case Credit Assessment\n\n"
            f"{case_context}\n\n"
            f"**Underwriting Recommendations for {persona}**:\n"
            f"* **Cashflow Capacity**: Verify 6-month historical bank turnover against debt service installment.\n"
            f"* **Security Perfection**: Ensure Deed of Legal Mortgage and personal guarantee of principal promoter are executed prior to disbursement.\n"
            f"* **Core Booking**: Upon final sanction by MD, Treasury executes 1-click booking directly into LOAN-DISC."
        )

    return (
        f"### Opticom Underwriting Copilot Response\n\n"
        f"Hello {persona}, I am your AI Underwriting Copilot. I can assist you with:\n\n"
        f"1. **Active Case Synthesis**: Summarizing obligor creditworthiness, turnover, and collateral coverage.\n"
        f"2. **Policy Verification**: Checking DSCR, ICR, and Single Obligor Limits against Opticom policy.\n"
        f"3. **Repayment Amortization**: Structuring commercial facilities at **28% APR**.\n"
        f"4. **CAM Drafting**: Suggesting risk mitigants and conditions precedent for approval.\n\n"
        f"Feel free to ask any question regarding credit cases, ratios, or underwriting policy!"
    )

@router.post("/chat")
def chat_with_copilot(payload: CopilotQueryRequest, db: Session = Depends(get_db)):
    """
    Staff conversational AI Copilot endpoint.
    Grounds responses on the active credit case and Opticom credit policy rules.
    """
    case_context = None
    if payload.case_id:
        c = db.query(CreditCase).filter(
            (CreditCase.id == payload.case_id) | (CreditCase.case_number == payload.case_id)
        ).first()
        if c and c.application:
            app = c.application
            cust = app.customer
            fin = db.query(FinancialAssessment).filter(FinancialAssessment.case_id == c.id).first()
            ratios = fin.calculated_ratios if fin else {}
            
            case_context = (
                f"* **Case Number**: `{c.case_number}`\n"
                f"* **Borrower Name**: **{cust.name}** ({cust.customer_type})\n"
                f"* **Requested Quantum**: ₦{app.requested_amount:,.2f} over {app.requested_tenor_months} months\n"
                f"* **Facility Type / Purpose**: {app.facility_type} ({app.purpose})\n"
                f"* **Current State**: `{c.state}`\n"
                f"* **Calculated DSCR**: {ratios.get('dscr', 'N/A')}x\n"
                f"* **Collateral Coverage**: {ratios.get('collateral_coverage_ratio', 'N/A')}x\n"
                f"* **Monthly Installment**: ₦{ratios.get('estimated_monthly_installment', 0):,.2f}"
            )

    # Attempt Google Cloud Vertex AI (Gemini) via centralized VertexAICamService
    if settings.VERTEX_AI_ENABLED and settings.GCP_PROJECT_ID:
        try:
            prompt = f"{OPTICOM_CREDIT_POLICY_CONTEXT}\n\n"
            if case_context:
                prompt += f"ACTIVE CASE CONTEXT:\n{case_context}\n\n"
            prompt += f"CURRENT STAFF PERSONA: {payload.persona}\n\n"
            prompt += f"STAFF QUERY: {payload.message}\n"
            
            gemini_reply = VertexAICamService.ask_gemini(prompt)
            if gemini_reply:
                return {
                    "reply": gemini_reply,
                    "provider": f"Google Cloud Vertex AI ({settings.VERTEX_AI_MODEL})",
                    "grounded_on_case": bool(payload.case_id)
                }
        except Exception:
            pass  # Fall back gracefully to deterministic intelligence

    # High-fidelity offline Copilot response
    reply = generate_offline_copilot_response(
        query=payload.message, 
        case_context=case_context, 
        persona=payload.persona or "Credit Analyst"
    )
    return {
        "reply": reply,
        "provider": "Opticom Credit Copilot Intelligence Engine",
        "grounded_on_case": bool(payload.case_id)
    }
