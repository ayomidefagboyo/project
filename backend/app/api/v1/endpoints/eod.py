"""
EOD (End of Day) reporting endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any, Optional
from datetime import datetime
import uuid
from app.core.security import require_auth
from app.core.database import get_supabase_admin, Tables
from app.schemas.reports import EODCreate, EODUpdate, EnhancedDailyReport, EODListResponse
from app.services.eod_service import eod_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def _log_audit_entry(
    supabase,
    outlet_id: str,
    user: Dict[str, Any],
    action: str,
    entity_type: str,
    entity_id: str,
    details: str
):
    try:
        supabase.table(Tables.AUDIT_ENTRIES).insert({
            "id": str(uuid.uuid4()),
            "outlet_id": outlet_id,
            "user_id": user.get("id"),
            "user_name": user.get("name") or user.get("email") or "Unknown",
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "details": details,
            "timestamp": datetime.utcnow().isoformat(),
        }).execute()
    except Exception as audit_error:
        logger.warning(f"Failed to write EOD audit entry: {audit_error}")


@router.post("/reports", response_model=EnhancedDailyReport)
async def create_eod_report(
    eod_data: EODCreate,
    outlet_id: Optional[str] = Query(None, description="Outlet ID"),
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """Create EOD report"""
    try:
        # Use outlet_id from query param or try to get from user context
        if not outlet_id:
            outlet_id = current_user.get('outlet_id')

        if not outlet_id:
            logger.warning(f"No outlet_id found for user {current_user.get('id')}")
            raise HTTPException(status_code=400, detail="No outlet specified")

        user_id = current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")

        logger.info(f"Creating EOD report for outlet {outlet_id}, user {user_id}")
        report = await eod_service.create_eod_report(eod_data, outlet_id, user_id)

        report_id = getattr(report, "id", None)
        if not report_id and isinstance(report, dict):
            report_id = report.get("id")
        if report_id:
            supabase = get_supabase_admin()
            _log_audit_entry(
                supabase,
                outlet_id,
                current_user,
                "create",
                "eod_report",
                report_id,
                f"Created EOD report for {eod_data.date}"
            )

        return report
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating EOD report: {e}")
        raise HTTPException(status_code=500, detail="Failed to create EOD report")


@router.get("/reports", response_model=EODListResponse)
async def get_eod_reports(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """Get EOD reports"""
    try:
        outlet_id = current_user.get('outlet_id')
        if not outlet_id:
            raise HTTPException(status_code=400, detail="No outlet specified")

        reports = await eod_service.get_eod_reports(
            outlet_id=outlet_id,
            page=page,
            size=size,
            date_from=date_from,
            date_to=date_to,
            status=status
        )
        return reports
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting EOD reports: {e}")
        raise HTTPException(status_code=500, detail="Failed to get EOD reports")


@router.get("/reports/{report_id}", response_model=EnhancedDailyReport)
async def get_eod_report(
    report_id: str,
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """Get specific EOD report"""
    try:
        outlet_id = current_user.get('outlet_id')
        if not outlet_id:
            raise HTTPException(status_code=400, detail="No outlet specified")

        report = await eod_service.get_eod_report(report_id, outlet_id)
        return report
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting EOD report: {e}")
        raise HTTPException(status_code=500, detail="Failed to get EOD report")


@router.put("/reports/{report_id}", response_model=EnhancedDailyReport)
async def update_eod_report(
    report_id: str,
    eod_data: EODUpdate,
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """Update EOD report"""
    try:
        outlet_id = current_user.get('outlet_id')
        if not outlet_id:
            raise HTTPException(status_code=400, detail="No outlet specified")

        report = await eod_service.update_eod_report(report_id, eod_data, outlet_id)

        supabase = get_supabase_admin()
        _log_audit_entry(
            supabase,
            outlet_id,
            current_user,
            "update",
            "eod_report",
            report_id,
            f"Updated EOD report {report_id}"
        )

        return report
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating EOD report: {e}")
        raise HTTPException(status_code=500, detail="Failed to update EOD report")


@router.delete("/reports/{report_id}")
async def delete_eod_report(
    report_id: str,
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """Delete EOD report"""
    try:
        outlet_id = current_user.get('outlet_id')
        if not outlet_id:
            raise HTTPException(status_code=400, detail="No outlet specified")

        existing_report = await eod_service.get_eod_report(report_id, outlet_id)
        await eod_service.delete_eod_report(report_id, outlet_id)

        report_date = getattr(existing_report, "date", None)
        if not report_date and isinstance(existing_report, dict):
            report_date = existing_report.get("date")

        supabase = get_supabase_admin()
        _log_audit_entry(
            supabase,
            outlet_id,
            current_user,
            "delete",
            "eod_report",
            report_id,
            f"Deleted EOD report {report_date or report_id}"
        )

        return {"message": "EOD report deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting EOD report: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete EOD report")


@router.get("/analytics")
async def get_eod_analytics(
    outlet_id: Optional[str] = Query(None, description="Outlet ID"),
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """Get EOD analytics for dashboard"""
    try:
        # Use outlet_id from query param or try to get from user context
        if not outlet_id:
            outlet_id = current_user.get('outlet_id')

        if not outlet_id:
            raise HTTPException(status_code=400, detail="No outlet specified")

        analytics = await eod_service.get_eod_analytics(outlet_id, date_from, date_to)
        return analytics
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting EOD analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get EOD analytics")


@router.get("/stats/overview")
async def get_eod_stats_overview(
    outlet_id: Optional[str] = Query(None, description="Outlet ID"),
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """Get EOD statistics overview for dashboard"""
    try:
        # Use outlet_id from query param or try to get from user context
        if not outlet_id:
            outlet_id = current_user.get('outlet_id')

        if not outlet_id:
            raise HTTPException(status_code=400, detail="No outlet specified")

        stats = await eod_service.get_eod_stats_overview(outlet_id, date_from, date_to)
        return stats
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting EOD stats overview: {e}")
        raise HTTPException(status_code=500, detail="Failed to get EOD stats overview")
