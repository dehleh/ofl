"""
In-App Notifications Router for Enterprise Staff Cockpit Tray & Real-time Alerts
"""
from fastapi import APIRouter, Depends, Query, status
from typing import Optional, List, Dict, Any

from ...core.security import get_current_user, TokenPayload
from ...integrations.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["In-App Notifications"])


@router.get("", response_model=List[Dict[str, Any]])
def list_notifications(
    role: Optional[str] = Query(None, description="Filter notifications by target role"),
    unread_only: bool = Query(False, description="Filter for unread notifications only"),
    limit: int = Query(50, description="Max notifications to retrieve"),
    current_user: Optional[TokenPayload] = Depends(get_current_user)
):
    """
    Fetch in-app notifications for the cockpit alert bell tray.
    """
    effective_role = role or (current_user.role if current_user else "ALL")
    return NotificationService.get_in_app_notifications(
        role=effective_role,
        unread_only=unread_only,
        limit=limit
    )


@router.post("/{notification_id}/read", status_code=status.HTTP_200_OK)
def mark_notification_read(
    notification_id: str,
    current_user: Optional[TokenPayload] = Depends(get_current_user)
):
    """
    Mark a single in-app notification as read.
    """
    success = NotificationService.mark_in_app_read(notification_id)
    return {"id": notification_id, "success": success}


@router.post("/mark-all-read", status_code=status.HTTP_200_OK)
def mark_all_notifications_read(
    role: Optional[str] = Query(None),
    current_user: Optional[TokenPayload] = Depends(get_current_user)
):
    """
    Mark all in-app notifications as read for current role or system.
    """
    effective_role = role or (current_user.role if current_user else "ALL")
    success = NotificationService.mark_all_in_app_read(role=effective_role)
    return {"role": effective_role, "success": success}

