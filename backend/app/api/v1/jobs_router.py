"""
Asynchronous Jobs & Long-Running Operations Router
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, status
from typing import Optional, Dict, Any

from ...core.background_jobs import JobManager
from ...database import get_db, SessionLocal
from ...models import CreditCase
from ...integrations.bank_statement_analyzer import BankStatementAnalyzer

router = APIRouter(prefix="/jobs", tags=["Asynchronous Tasks"])

def background_analyze_statement_worker(
    job_id: str,
    case_id: str,
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    actor: str
):
    """
    Background worker thread executing OCR extraction and statement analytics.
    """
    JobManager.update_status(job_id, status="PROCESSING", progress=25)
    db = SessionLocal()
    try:
        credit_case = db.query(CreditCase).filter(
            (CreditCase.id == case_id) | (CreditCase.case_number == case_id)
        ).first()
        if not credit_case:
            JobManager.update_status(job_id, status="FAILED", progress=0, error="Credit case not found.")
            return

        JobManager.update_status(job_id, status="PROCESSING", progress=60)
        doc = BankStatementAnalyzer.process_and_attach_statement(
            db=db,
            credit_case=credit_case,
            file_bytes=file_bytes,
            filename=filename,
            mime_type=mime_type,
            actor=actor
        )

        JobManager.update_status(
            job_id, 
            status="COMPLETED", 
            progress=100, 
            result={
                "document_id": doc.id,
                "filename": doc.original_filename,
                "analysis": doc.analysis_results
            }
        )
    except Exception as e:
        JobManager.update_status(job_id, status="FAILED", progress=0, error=str(e))
    finally:
        db.close()

@router.get("/{job_id}")
def get_job_status(job_id: str):
    """
    Returns live progress and results of a long-running background task.
    """
    job = JobManager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Background job ID not found.")
    return job.model_dump()

@router.get("")
def list_jobs(case_id: Optional[str] = None):
    """
    Lists active and completed background tasks.
    """
    return JobManager.list_jobs(case_id=case_id)
