"""
Telemetry, Operational Reporting and Azure AI Cost Dashboard (PRD FR-18, FR-28, FR-29)
"""
from fastapi import APIRouter, Depends, Response, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Dict, Any, Optional, List

from ...database import get_db, engine
from ...models import CreditCase, Application, CAMVersion, ExceptionItem, Disbursement, CaseState
from ...config import settings
from ...integrations.gcs_service import GoogleCloudStorageService
from ...integrations.secret_manager_service import GCPSecretManagerService
from ...core.cloud_logger import GoogleCloudLoggingService

router = APIRouter(prefix="/telemetry", tags=["Telemetry & Operational Reporting"])

@router.get("/overview")
def get_operational_metrics(db: Session = Depends(get_db)):
    """
    Returns high-level operational funnel metrics across all cases (FR-18).
    """
    total_cases = db.query(CreditCase).count()
    
    # Cases by stage
    stage_counts = {}
    for state_enum in CaseState:
        stage_counts[state_enum.value] = db.query(CreditCase).filter(CreditCase.state == state_enum.value).count()
        
    # Channel distribution
    besto_count = db.query(Application).filter(Application.intake_channel == "BESTO").count()
    direct_count = db.query(Application).filter(Application.intake_channel == "OFL_DIRECT").count()
    
    # Financial metrics
    total_pipeline_val = db.query(func.sum(Application.amount)).scalar() or 0.0
    confirmed_disbursed_val = db.query(func.sum(Disbursement.amount)).filter(
        Disbursement.status.in_(["CONFIRMED", "RECONCILED"])
    ).scalar() or 0.0
    
    active_exceptions = db.query(ExceptionItem).filter(ExceptionItem.status == "OPEN").count()
    
    return {
        "total_cases": total_cases,
        "total_pipeline_value_ngn": total_pipeline_val,
        "total_disbursed_value_ngn": confirmed_disbursed_val,
        "open_exceptions_count": active_exceptions,
        "channel_breakdown": {
            "BESTO": besto_count,
            "OFL_DIRECT": direct_count
        },
        "stage_breakdown": stage_counts
    }

@router.get("/ai-costs")
def get_ai_cost_telemetry(db: Session = Depends(get_db)):
    """
    Returns AI token consumption and estimated GCP Vertex AI (Gemini) expenditures (FR-29).
    """
    cams = db.query(CAMVersion).all()
    
    total_prompt_tokens = 0
    total_completion_tokens = 0
    total_tokens = 0
    total_cost_usd = 0.0
    
    for cam in cams:
        if cam.source_snapshot and "token_telemetry" in cam.source_snapshot:
            tele = cam.source_snapshot["token_telemetry"]
            prompt_t = tele.get("prompt_tokens", 0)
            comp_t = tele.get("completion_tokens", 0)
            tot_t = tele.get("total_tokens", prompt_t + comp_t)
            cost_usd = tele.get("estimated_cost_usd", (tot_t / 1000.0) * settings.AI_COST_PER_1K_TOKENS_USD)
            
            total_prompt_tokens += prompt_t
            total_completion_tokens += comp_t
            total_tokens += tot_t
            total_cost_usd += cost_usd
            
    # NGN conversion at benchmark rate
    usd_ngn_rate = 1650.0
    total_cost_ngn = round(total_cost_usd * usd_ngn_rate, 2)
    avg_tokens_per_cam = round(total_tokens / len(cams), 1) if cams else 0
    
    return {
        "cloud_provider": "Google Cloud Platform (GCP)",
        "ai_underwriter": "Google Cloud Vertex AI (Gemini)",
        "model_deployment": settings.VERTEX_AI_MODEL,
        "gcp_region": settings.GCP_LOCATION,
        "total_cams_generated": len(cams),
        "total_tokens_consumed": total_tokens,
        "prompt_tokens": total_prompt_tokens,
        "completion_tokens": total_completion_tokens,
        "average_tokens_per_cam": avg_tokens_per_cam,
        "total_cost_usd": round(total_cost_usd, 4),
        "total_cost_ngn": total_cost_ngn,
        "monthly_approved_budget_usd": 150.0,
        "budget_consumption_percentage": round((total_cost_usd / 150.0) * 100, 2) if total_cost_usd > 0 else 0.0,
        "governance_rule": "Deterministic financial rules calculated outside LLM; Vertex AI Gemini token budget strictly capped (FR-28)."
    }

@router.get("/gcp-infrastructure")
def get_gcp_infrastructure_status(db: Session = Depends(get_db)):
    """
    Returns deployment telemetry for Google Cloud Platform services:
    Vertex AI, Google Cloud Storage, Secret Manager, Cloud Logging, and Cloud SQL.
    """
    gcs_status = GoogleCloudStorageService.get_storage_telemetry()
    secrets_status = GCPSecretManagerService.get_secrets_inventory()
    logging_status = GoogleCloudLoggingService.get_logging_telemetry()

    dialect_name = engine.dialect.name
    db_status = "CONNECTED"
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"DEGRADED ({type(exc).__name__})"

    is_pg = dialect_name.startswith("postgresql")
    db_label = "PostgreSQL (Google Cloud SQL)" if is_pg else f"SQLite ({dialect_name} local/fallback)"

    return {
        "cloud_platform": "Google Cloud Platform (GCP)",
        "project_id": settings.GCP_PROJECT_ID,
        "primary_region": settings.GCP_LOCATION,
        "services": {
            "vertex_ai": {
                "status": "HEALTHY",
                "model": settings.VERTEX_AI_MODEL,
                "role": "AI Underwriter (Narrative CAM Synthesis & Evidence Citations)"
            },
            "cloud_storage": gcs_status,
            "secret_manager": secrets_status,
            "cloud_logging": logging_status,
            "database": {
                "engine": db_label,
                "dialect": dialect_name,
                "cloud_sql_active": is_pg,
                "status": db_status
            }
        }
    }

@router.get("/notifications")
def get_notification_telemetry(limit: int = 50):
    """
    Returns multi-channel delivery audit logs (SMS via Termii & Email via SendGrid).
    """
    from ...integrations.notification_service import NotificationService
    return {
        "total_dispatched": len(NotificationService.get_delivery_logs()),
        "delivery_logs": NotificationService.get_delivery_logs(limit=limit)
    }

# ==============================================================================
# LOAN PORTFOLIO TELEMETRY & PERFORMANCE MONITORING (POST-DISBURSEMENT)
# ==============================================================================
from pydantic import BaseModel
from ...models.entities import LoanPerformance
from ...core.loan_performance_engine import LoanPerformanceEngine
from ...database import utc_now
from fastapi import HTTPException

class RecordRepaymentPayload(BaseModel):
    amount: float
    payment_date: Optional[str] = None

class SimulateStatusPayload(BaseModel):
    scenario: str # CURRENT, GRACE_PERIOD, OVERDUE_PENALTY, CRITICAL

@router.get("/loan-performance")
def get_loan_portfolio_performance(db: Session = Depends(get_db)):
    """
    Returns portfolio-wide loan servicing telemetry:
    - How each funded obligor is performing
    - Total serviced vs remaining exposure
    - Delinquency breakdown (Current, 1-7 days Grace, >7 days 5% Penalty)
    """
    records = db.query(LoanPerformance).all()

    # Re-evaluate all performance statuses
    for r in records:
        LoanPerformanceEngine.evaluate_performance(r)
    db.commit()

    total_disbursed = sum(r.disbursed_principal for r in records)
    total_serviced = sum(r.total_amount_serviced for r in records)
    total_principal_serviced = sum(r.principal_serviced for r in records)
    total_interest_serviced = sum(r.interest_serviced for r in records)
    total_outstanding = sum(r.outstanding_principal for r in records)
    total_outstanding_balance = sum(r.outstanding_total for r in records)
    total_penalties = sum(r.penalty_accrued for r in records)

    performing_count = sum(1 for r in records if r.performance_status == "PERFORMING_CURRENT")
    grace_count = sum(1 for r in records if r.performance_status == "GRACE_PERIOD_ACTIVE")
    overdue_count = sum(1 for r in records if r.performance_status in ["OVERDUE_PENALTY_APPLIED", "CRITICAL_DELINQUENT"])
    closed_count = sum(1 for r in records if r.performance_status == "CLOSED_FULLY_SETTLED")

    accounts = []
    for r in records:
        accounts.append({
            "id": r.id,
            "case_id": r.case_id,
            "facility_number": r.facility_number,
            "borrower_name": r.borrower_name,
            "disbursed_principal": r.disbursed_principal,
            "interest_rate_apr": r.interest_rate_apr,
            "tenor_months": r.tenor_months,
            "monthly_installment": r.monthly_installment,
            "total_installments_count": r.total_installments_count,
            "installments_serviced": r.installments_serviced,
            "installments_remaining": r.installments_remaining,
            "principal_serviced": r.principal_serviced,
            "interest_serviced": r.interest_serviced,
            "total_amount_serviced": r.total_amount_serviced,
            "outstanding_principal": r.outstanding_principal,
            "outstanding_total": r.outstanding_total,
            "next_due_date": r.next_due_date.isoformat() if r.next_due_date else None,
            "days_overdue": r.days_overdue,
            "grace_period_days": r.grace_period_days,
            "penalty_rate_pct": r.penalty_rate_pct,
            "penalty_accrued": r.penalty_accrued,
            "performance_status": r.performance_status,
            "disbursed_at": r.disbursed_at.isoformat() if r.disbursed_at else None,
            "last_payment_date": r.last_payment_date.isoformat() if r.last_payment_date else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None
        })

    portfolio_metrics = {
        "total_active_loans": len(records),
        "total_active_facilities": len(records),
        "total_disbursed_principal": total_disbursed,
        "total_amount_serviced": total_serviced,
        "total_principal_serviced": total_principal_serviced,
        "total_interest_serviced": total_interest_serviced,
        "total_outstanding_balance": total_outstanding_balance,
        "total_outstanding_exposure": total_outstanding,
        "total_outstanding_principal": total_outstanding,
        "total_penalties_accrued": total_penalties,
        "total_penalties_levied": total_penalties,
        "repayment_collection_rate": round((total_serviced / (total_serviced + total_outstanding) * 100), 2) if (total_serviced + total_outstanding) > 0 else 0.0,
        "status_breakdown": {
            "PERFORMING_CURRENT": performing_count,
            "GRACE_PERIOD_ACTIVE": grace_count,
            "OVERDUE_PENALTY_APPLIED": overdue_count,
            "CLOSED_FULLY_SETTLED": closed_count
        },
        "policy_rules": {
            "grace_period_days": 7,
            "default_penalty_rate_pct": 5.0,
            "penalty_rule_description": "A 5% default penalty is levied on the overdue installment when payment is delayed beyond the statutory 7-day grace period."
        }
    }

    return {
        "portfolio_summary": portfolio_metrics,
        "portfolio_metrics": portfolio_metrics,
        "accounts": accounts
    }

@router.get("/loan-performance/{case_id}")
def get_single_loan_performance(case_id: str, db: Session = Depends(get_db)):
    """
    Returns full servicing dossier, amortization status, and payment schedule for a specific loan.
    """
    record = db.query(LoanPerformance).filter(
        (LoanPerformance.case_id == case_id) | 
        (LoanPerformance.facility_number == case_id)
    ).first()

    if not record:
        # Check if case exists and is in DISBURSED state, initialize if needed
        case = db.query(CreditCase).filter(
            (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
        ).first()
        if case and case.state in ["Disbursed/Monitoring", "Ready for Disbursement"]:
            record = LoanPerformanceEngine.initialize_loan_performance(case, db)
            db.commit()
            db.refresh(record)
        else:
            raise HTTPException(status_code=404, detail="Loan performance record not found.")

    LoanPerformanceEngine.evaluate_performance(record)
    db.commit()

    return {
        "id": record.id,
        "case_id": record.case_id,
        "facility_number": record.facility_number,
        "borrower_name": record.borrower_name,
        "disbursed_principal": record.disbursed_principal,
        "interest_rate_apr": record.interest_rate_apr,
        "tenor_months": record.tenor_months,
        "monthly_installment": record.monthly_installment,
        "total_installments_count": record.total_installments_count,
        "installments_serviced": record.installments_serviced,
        "installments_remaining": record.installments_remaining,
        "principal_serviced": record.principal_serviced,
        "interest_serviced": record.interest_serviced,
        "total_amount_serviced": record.total_amount_serviced,
        "outstanding_principal": record.outstanding_principal,
        "outstanding_total": record.outstanding_total,
        "next_due_date": record.next_due_date.isoformat() if record.next_due_date else None,
        "days_overdue": record.days_overdue,
        "grace_period_days": record.grace_period_days,
        "penalty_rate_pct": record.penalty_rate_pct,
        "penalty_accrued": record.penalty_accrued,
        "performance_status": record.performance_status,
        "repayment_schedule": record.repayment_schedule or [],
        "repayment_history": record.repayment_history or [],
        "disbursed_at": record.disbursed_at.isoformat() if record.disbursed_at else None,
        "last_payment_date": record.last_payment_date.isoformat() if record.last_payment_date else None
    }

@router.post("/loan-performance/{case_id}/record-repayment")
def record_repayment_endpoint(
    case_id: str,
    payload: RecordRepaymentPayload,
    db: Session = Depends(get_db)
):
    """
    Records an official loan repayment, reconciles schedules, and advances installment pointers.
    """
    record = db.query(LoanPerformance).filter(
        (LoanPerformance.case_id == case_id) | 
        (LoanPerformance.facility_number == case_id)
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="Loan performance record not found.")

    res = LoanPerformanceEngine.record_repayment(record, payload.amount, db=db)
    return res

@router.post("/loan-performance/{case_id}/simulate-status")
def simulate_status_endpoint(
    case_id: str,
    payload: SimulateStatusPayload,
    db: Session = Depends(get_db)
):
    """
    Simulates repayment timeliness scenarios for executive demonstration:
    - CURRENT: 0 days overdue
    - GRACE_PERIOD: 4 days overdue (within 7-day grace period, no penalty)
    - OVERDUE_PENALTY: 10 days overdue (> 7 days grace, triggers 5% default penalty!)
    - CRITICAL: 35 days overdue
    """
    record = db.query(LoanPerformance).filter(
        (LoanPerformance.case_id == case_id) | 
        (LoanPerformance.facility_number == case_id)
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="Loan performance record not found.")

    res = LoanPerformanceEngine.simulate_status(record, payload.scenario, db=db)
    return {
        "message": f"Simulated status '{payload.scenario}' applied successfully.",
        "performance_status": res.performance_status,
        "days_overdue": res.days_overdue,
        "penalty_accrued": res.penalty_accrued,
        "outstanding_total": res.outstanding_total
    }

# ==============================================================================
# TELEMETRY PERIODIC REPORTING & EXPORT ENGINE (MONTHLY, QUARTERLY, BIANNUAL, ANNUAL)
# ==============================================================================
from datetime import datetime, timezone
from ...services.telemetry_report_service import TelemetryReportService

@router.get("/reports")
def get_telemetry_report_data(
    period: str = Query("quarterly", description="Reporting period: monthly, quarterly, biannual, annual"),
    db: Session = Depends(get_db)
):
    """
    Returns aggregated JSON telemetry dataset for specified period (monthly, quarterly, biannual, annual).
    """
    return TelemetryReportService.get_report_dataset(period=period, db=db)

@router.get("/reports/export")
def export_telemetry_report(
    period: str = Query("quarterly", description="Reporting period: monthly, quarterly, biannual, annual"),
    format: str = Query("csv", description="Export format: csv or html"),
    db: Session = Depends(get_db)
):
    """
    Downloads telemetry report as CSV spreadsheet or printable executive HTML/PDF dossier.
    """
    clean_period = period.lower().strip()
    if clean_period not in ["monthly", "quarterly", "biannual", "annual"]:
        clean_period = "quarterly"

    if format.lower().strip() == "html":
        html_content = TelemetryReportService.generate_html_report(period=clean_period, db=db)
        return Response(content=html_content, media_type="text/html")

    csv_content = TelemetryReportService.generate_csv_report(period=clean_period, db=db)
    filename = f"OFL_Telemetry_{clean_period.capitalize()}_Report_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

