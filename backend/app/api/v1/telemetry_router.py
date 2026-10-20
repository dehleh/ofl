"""
Telemetry, Operational Reporting and Azure AI Cost Dashboard (PRD FR-18, FR-28, FR-29)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any

from ...database import get_db
from ...models import CreditCase, Application, CAMVersion, ExceptionItem, Disbursement, CaseState
from ...config import settings

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
    Returns AI token consumption and estimated Azure OpenAI expenditures (FR-29).
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
        "model_deployment": settings.AZURE_OPENAI_DEPLOYMENT_NAME,
        "total_cams_generated": len(cams),
        "total_tokens_consumed": total_tokens,
        "prompt_tokens": total_prompt_tokens,
        "completion_tokens": total_completion_tokens,
        "average_tokens_per_cam": avg_tokens_per_cam,
        "total_cost_usd": round(total_cost_usd, 4),
        "total_cost_ngn": total_cost_ngn,
        "monthly_approved_budget_usd": 150.0,
        "budget_consumption_percentage": round((total_cost_usd / 150.0) * 100, 2) if total_cost_usd > 0 else 0.0,
        "governance_rule": "Deterministic financial rules calculated outside LLM; AI token budget strictly capped (FR-28)."
    }
