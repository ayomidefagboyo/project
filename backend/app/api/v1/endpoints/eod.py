"""
EOD (End of Day) reporting endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional, Dict, Any
from datetime import date
from app.schemas.reports import (
    EODCreate, EODUpdate, EnhancedDailyReport, EODListResponse,
    EODAnalytics, EODStatsResponse, EODSearchRequest, EODComparisonRequest,
    EODComparisonResponse, EODApprovalRequest, EODApprovalResponse,
    EODExistsResponse, EODSummaryResponse
)
from app.services.eod_service import eod_service
from app.core.security import require_auth, get_user_outlet_id, require_permissions

router = APIRouter()


@router.post("/", response_model=EnhancedDailyReport, status_code=status.HTTP_201_CREATED)
async def create_eod_report(
    eod_data: EODCreate,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_reports"]))
):
    """
    Create a new EOD report
    
    Creates a new end-of-day report for the current user's outlet
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        report = await eod_service.create_eod_report(
            eod_data, 
            outlet_id, 
            current_user["id"]
        )
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create EOD report"
        )


@router.get("/", response_model=EODListResponse)
async def get_eod_reports(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: Dict[str, Any] = Depends(require_permissions(["view_reports"]))
):
    """
    Get EOD reports with pagination and filtering
    
    Returns a paginated list of EOD reports for the current user's outlet
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        result = await eod_service.get_eod_reports(
            outlet_id=outlet_id,
            date_from=date_from,
            date_to=date_to,
            page=page,
            size=size,
            status=status
        )
        return EODListResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get EOD reports"
        )


@router.get("/{report_id}", response_model=EnhancedDailyReport)
async def get_eod_report(
    report_id: str,
    current_user: Dict[str, Any] = Depends(require_permissions(["view_reports"]))
):
    """
    Get a specific EOD report by ID
    
    Returns EOD report details for the specified report
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        report = await eod_service.get_eod_report(report_id, outlet_id)
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get EOD report"
        )


@router.put("/{report_id}", response_model=EnhancedDailyReport)
async def update_eod_report(
    report_id: str,
    report_data: EODUpdate,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_reports"]))
):
    """
    Update an EOD report
    
    Updates EOD report information for the specified report
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        report = await eod_service.update_eod_report(report_id, report_data, outlet_id)
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update EOD report"
        )


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_eod_report(
    report_id: str,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_reports"]))
):
    """
    Delete an EOD report
    
    Permanently deletes the specified EOD report
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        await eod_service.delete_eod_report(report_id, outlet_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete EOD report"
        )


@router.get("/check/{report_date}", response_model=EODExistsResponse)
async def check_eod_exists(
    report_date: str,
    current_user: Dict[str, Any] = Depends(require_permissions(["view_reports"]))
):
    """
    Check if EOD report exists for a specific date
    
    Returns whether a report exists for the given date and the report data if found
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        result = await eod_service.check_eod_exists(outlet_id, report_date)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check EOD existence"
        )


@router.get("/analytics/overview", response_model=EODAnalytics)
async def get_eod_analytics(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    current_user: Dict[str, Any] = Depends(require_permissions(["view_reports"]))
):
    """
    Get EOD analytics for a date range
    
    Returns comprehensive analytics for the specified date range
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        analytics = await eod_service.get_eod_analytics(outlet_id, date_from, date_to)
        return analytics
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get EOD analytics"
        )


@router.get("/stats/overview", response_model=EODStatsResponse)
async def get_eod_stats(
    current_user: Dict[str, Any] = Depends(require_permissions(["view_reports"]))
):
    """
    Get EOD statistics overview
    
    Returns summary statistics for all EOD reports in the current outlet
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        stats = await eod_service.get_eod_stats(outlet_id)
        return stats
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get EOD statistics"
        )


@router.post("/{report_id}/approve", response_model=EODApprovalResponse)
async def approve_eod_report(
    report_id: str,
    approval_data: EODApprovalRequest,
    current_user: Dict[str, Any] = Depends(require_permissions(["approve_reports"]))
):
    """
    Approve or reject an EOD report
    
    Approves or rejects the specified EOD report with optional notes
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        result = await eod_service.approve_eod_report(
            report_id, approval_data, outlet_id, current_user["id"]
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to approve EOD report"
        )


@router.get("/summary/dashboard", response_model=EODSummaryResponse)
async def get_eod_summary(
    current_user: Dict[str, Any] = Depends(require_permissions(["view_reports"]))
):
    """
    Get EOD summary for dashboard
    
    Returns key metrics for dashboard display
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        
        # Get today's date
        today = date.today().isoformat()
        
        # Get today's report
        today_reports = await eod_service.get_eod_reports(outlet_id, today, today, page=1, size=1)
        today_report = today_reports["items"][0] if today_reports["items"] else None
        
        # Get this week's reports
        from datetime import timedelta
        week_ago = (date.today() - timedelta(days=7)).isoformat()
        week_reports = await eod_service.get_eod_reports(outlet_id, week_ago, today, page=1, size=100)
        
        # Get this month's reports
        month_ago = (date.today() - timedelta(days=30)).isoformat()
        month_reports = await eod_service.get_eod_reports(outlet_id, month_ago, today, page=1, size=100)
        
        # Calculate summary
        today_sales = today_report.total_sales if today_report else 0.0
        today_profit = today_report.gross_profit if today_report else 0.0
        today_cash_variance = today_report.cash_variance if today_report else None
        
        week_sales = sum(r.total_sales for r in week_reports["items"])
        week_profit = sum(r.gross_profit for r in week_reports["items"])
        
        month_sales = sum(r.total_sales for r in month_reports["items"])
        month_profit = sum(r.gross_profit for r in month_reports["items"])
        
        # Get pending reports count
        pending_reports = await eod_service.get_eod_reports(outlet_id, status="draft", page=1, size=100)
        pending_count = pending_reports["total"]
        
        # Get last report date
        last_reports = await eod_service.get_eod_reports(outlet_id, page=1, size=1)
        last_report_date = None
        if last_reports["items"]:
            last_report_date = last_reports["items"][0].date
        
        return EODSummaryResponse(
            today_sales=round(today_sales, 2),
            today_profit=round(today_profit, 2),
            week_sales=round(week_sales, 2),
            week_profit=round(week_profit, 2),
            month_sales=round(month_sales, 2),
            month_profit=round(month_profit, 2),
            pending_reports=pending_count,
            last_report_date=last_report_date,
            cash_variance_today=today_cash_variance
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get EOD summary"
        )


@router.post("/search")
async def search_eod_reports(
    search_request: EODSearchRequest,
    current_user: Dict[str, Any] = Depends(require_permissions(["view_reports"]))
):
    """
    Search EOD reports
    
    Performs advanced search across EOD reports with multiple filters
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        
        # Convert search request to get_eod_reports parameters
        date_from = search_request.date_from.isoformat() if search_request.date_from else None
        date_to = search_request.date_to.isoformat() if search_request.date_to else None
        
        result = await eod_service.get_eod_reports(
            outlet_id=outlet_id,
            date_from=date_from,
            date_to=date_to,
            page=1,
            size=search_request.limit,
            status=search_request.status.value if search_request.status else None
        )
        
        # Apply additional filters
        filtered_items = result["items"]
        
        if search_request.min_sales is not None:
            filtered_items = [r for r in filtered_items if r.total_sales >= search_request.min_sales]
        
        if search_request.max_sales is not None:
            filtered_items = [r for r in filtered_items if r.total_sales <= search_request.max_sales]
        
        if search_request.has_discrepancies is not None:
            if search_request.has_discrepancies:
                filtered_items = [r for r in filtered_items if r.discrepancies and len(r.discrepancies) > 0]
            else:
                filtered_items = [r for r in filtered_items if not r.discrepancies or len(r.discrepancies) == 0]
        
        return {
            "items": filtered_items,
            "total": len(filtered_items),
            "query": search_request.dict()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search EOD reports"
        )




