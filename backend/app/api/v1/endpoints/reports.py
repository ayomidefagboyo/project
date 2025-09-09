"""
Financial reports endpoints
"""

from fastapi import APIRouter, Depends
from app.core.security import require_auth
from typing import Dict, Any

router = APIRouter()


@router.get("/")
async def get_reports(current_user: Dict[str, Any] = Depends(require_auth())):
    """Get reports - TODO: Implement"""
    return {"message": "Reports endpoint - Coming soon"}


@router.get("/daily")
async def get_daily_report(current_user: Dict[str, Any] = Depends(require_auth())):
    """Get daily report - TODO: Implement"""
    return {"message": "Daily report - Coming soon"}


@router.get("/monthly")
async def get_monthly_report(current_user: Dict[str, Any] = Depends(require_auth())):
    """Get monthly report - TODO: Implement"""
    return {"message": "Monthly report - Coming soon"}

