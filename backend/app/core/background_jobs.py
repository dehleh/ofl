"""
Asynchronous Background Job & Task Management Service (PRD FR-17, Cloud Tasks / Worker Readiness)
Prevents HTTP request timeouts for heavy operations (OCR extraction, Gemini CAM generation, batch syncing).
"""
import uuid
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Callable
from pydantic import BaseModel

class JobRecord(BaseModel):
    job_id: str
    job_type: str
    status: str  # QUEUED, PROCESSING, COMPLETED, FAILED
    progress_pct: int = 0
    created_at: str
    updated_at: str
    case_id: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class JobManager:
    """
    In-memory and Cloud Tasks compatible asynchronous job registry.
    """
    _jobs: Dict[str, JobRecord] = {}

    @classmethod
    def create_job(cls, job_type: str, case_id: Optional[str] = None) -> str:
        job_id = f"JOB-{uuid.uuid4().hex[:12].upper()}"
        now_iso = datetime.now(timezone.utc).isoformat()
        cls._jobs[job_id] = JobRecord(
            job_id=job_id,
            job_type=job_type,
            status="QUEUED",
            progress_pct=0,
            created_at=now_iso,
            updated_at=now_iso,
            case_id=case_id
        )
        return job_id

    @classmethod
    def get_job(cls, job_id: str) -> Optional[JobRecord]:
        return cls._jobs.get(job_id)

    @classmethod
    def update_status(
        cls, 
        job_id: str, 
        status: str, 
        progress: int = 0, 
        result: Optional[Dict[str, Any]] = None, 
        error: Optional[str] = None
    ):
        if job_id in cls._jobs:
            job = cls._jobs[job_id]
            job.status = status
            job.progress_pct = progress
            job.updated_at = datetime.now(timezone.utc).isoformat()
            if result is not None:
                job.result = result
            if error is not None:
                job.error = error

    @classmethod
    def list_jobs(cls, case_id: Optional[str] = None) -> list:
        if case_id:
            return [j.model_dump() for j in cls._jobs.values() if j.case_id == case_id]
        return [j.model_dump() for j in cls._jobs.values()]
