"""
Audit Trail API Router (PRD FR-18, Non-Functional Audit, Section 7)
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ...database import get_db
from ...models import AuditEvent

router = APIRouter(prefix="/audit", tags=["Audit Trail"])

@router.get("")
def list_audit_events(
    entity: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    Returns append-only audit trail records for compliance and audit reviewers (PRD Section 4).
    """
    query = db.query(AuditEvent)
    if entity:
        query = query.filter(AuditEvent.entity == entity)
    if actor:
        query = query.filter(AuditEvent.actor.ilike(f"%{actor}%"))
        
    total = query.count()
    events = query.order_by(AuditEvent.timestamp.desc()).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "items": [
            {
                "id": ev.id,
                "actor": ev.actor,
                "role": ev.role,
                "event": ev.event,
                "entity": ev.entity,
                "entity_id": ev.entity_id,
                "timestamp": ev.timestamp.isoformat(),
                "correlation_id": ev.correlation_id,
                "reason": ev.reason,
                "details": ev.details
            }
            for ev in events
        ]
    }
