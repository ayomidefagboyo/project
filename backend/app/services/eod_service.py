"""
EOD (End of Day) service for handling reporting and analytics business logic
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from fastapi import HTTPException, status
from app.core.database import get_supabase_admin, Tables
from app.schemas.reports import (
    EODCreate, EODUpdate, EnhancedDailyReport, EODListResponse,
    EODAnalytics, EODStatsResponse, EODSearchRequest, EODComparisonRequest,
    EODComparisonResponse, EODApprovalRequest, EODApprovalResponse,
    EODExistsResponse, EODSummaryResponse, ReportStatus
)
import logging

logger = logging.getLogger(__name__)


class EODService:
    """EOD service class"""
    
    def __init__(self):
        self._supabase = None
    
    @property
    def supabase(self):
        if self._supabase is None:
            self._supabase = get_supabase_admin()
        return self._supabase
    
    async def create_eod_report(self, eod_data: EODCreate, outlet_id: str, user_id: str) -> EnhancedDailyReport:
        """Create a new EOD report"""
        try:
            # Check if report already exists for this date
            existing = await self.check_eod_exists(outlet_id, eod_data.date)
            if existing.exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="EOD report already exists for this date"
                )
            
            # Calculate derived fields
            total_sales = eod_data.get_total_sales()
            gross_profit = eod_data.get_gross_profit()
            expected_cash = eod_data.get_expected_cash()
            cash_variance = eod_data.get_cash_variance()
            gross_margin_percent = eod_data.get_gross_margin_percent()
            
            # Prepare report data
            report_dict = eod_data.dict()
            report_dict.update({
                "outlet_id": outlet_id,
                "status": ReportStatus.DRAFT,
                "total_sales": total_sales,
                "gross_profit": gross_profit,
                "expected_cash": expected_cash,
                "cash_variance": cash_variance,
                "gross_margin_percent": gross_margin_percent,
                "submitted_by": user_id,
                "discrepancies": self._calculate_discrepancies(eod_data)
            })
            
            # Insert report
            response = self.supabase.table(Tables.DAILY_REPORTS).insert(report_dict).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create EOD report"
                )
            
            report = response.data[0]
            return EnhancedDailyReport(**report)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating EOD report: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create EOD report"
            )
    
    async def get_eod_reports(
        self, 
        outlet_id: str, 
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        page: int = 1, 
        size: int = 20,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get EOD reports with pagination and filtering"""
        try:
            # Build query
            query = self.supabase.table(Tables.DAILY_REPORTS).select("*", count="exact")
            query = query.eq("outlet_id", outlet_id)
            
            # Apply date filters
            if date_from:
                query = query.gte("date", date_from)
            if date_to:
                query = query.lte("date", date_to)
            
            # Apply status filter
            if status:
                query = query.eq("status", status)
            
            # Apply pagination
            offset = (page - 1) * size
            query = query.range(offset, offset + size - 1)
            
            # Order by date descending
            query = query.order("date", desc=True)
            
            # Execute query
            response = query.execute()
            
            reports = [EnhancedDailyReport(**report) for report in response.data]
            total = response.count or 0
            pages = (total + size - 1) // size
            
            return {
                "items": reports,
                "total": total,
                "page": page,
                "size": size,
                "pages": pages
            }
            
        except Exception as e:
            logger.error(f"Error getting EOD reports: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get EOD reports"
            )
    
    async def get_eod_report(self, report_id: str, outlet_id: str) -> EnhancedDailyReport:
        """Get a specific EOD report"""
        try:
            response = self.supabase.table(Tables.DAILY_REPORTS).select("*").eq("id", report_id).eq("outlet_id", outlet_id).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="EOD report not found"
                )
            
            report = response.data[0]
            return EnhancedDailyReport(**report)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting EOD report: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get EOD report"
            )
    
    async def update_eod_report(self, report_id: str, report_data: EODUpdate, outlet_id: str) -> EnhancedDailyReport:
        """Update an EOD report"""
        try:
            # Check if report exists
            existing = await self.get_eod_report(report_id, outlet_id)
            
            # Prepare update data (only include non-None values)
            update_dict = {k: v for k, v in report_data.dict().items() if v is not None}
            
            # Recalculate derived fields if financial data changed
            if any(field in update_dict for field in ['sales_cash', 'sales_transfer', 'sales_pos', 'sales_credit', 'inventory_cost']):
                # Get current data and merge with updates
                current_data = existing.dict()
                current_data.update(update_dict)
                
                # Recalculate
                total_sales = (current_data.get('sales_cash', 0) + 
                              current_data.get('sales_transfer', 0) + 
                              current_data.get('sales_pos', 0) + 
                              current_data.get('sales_credit', 0))
                gross_profit = total_sales - current_data.get('inventory_cost', 0)
                expected_cash = (current_data.get('opening_balance', 0) + 
                                current_data.get('sales_cash', 0) - 
                                current_data.get('bank_deposit', 0))
                cash_variance = current_data.get('closing_balance', 0) - expected_cash
                gross_margin_percent = (gross_profit / total_sales * 100) if total_sales > 0 else 0
                
                update_dict.update({
                    "total_sales": round(total_sales, 2),
                    "gross_profit": round(gross_profit, 2),
                    "expected_cash": round(expected_cash, 2),
                    "cash_variance": round(cash_variance, 2),
                    "gross_margin_percent": round(gross_margin_percent, 2)
                })
            
            if not update_dict:
                return existing
            
            # Update report
            response = self.supabase.table(Tables.DAILY_REPORTS).update(update_dict).eq("id", report_id).eq("outlet_id", outlet_id).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update EOD report"
                )
            
            report = response.data[0]
            return EnhancedDailyReport(**report)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating EOD report: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update EOD report"
            )
    
    async def delete_eod_report(self, report_id: str, outlet_id: str) -> bool:
        """Delete an EOD report"""
        try:
            # Check if report exists
            await self.get_eod_report(report_id, outlet_id)
            
            # Delete report
            response = self.supabase.table(Tables.DAILY_REPORTS).delete().eq("id", report_id).eq("outlet_id", outlet_id).execute()
            
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting EOD report: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete EOD report"
            )
    
    async def check_eod_exists(self, outlet_id: str, report_date: str) -> EODExistsResponse:
        """Check if EOD report exists for a specific date"""
        try:
            response = self.supabase.table(Tables.DAILY_REPORTS).select("*").eq("outlet_id", outlet_id).eq("date", report_date).execute()
            
            if response.data:
                report = EnhancedDailyReport(**response.data[0])
                return EODExistsResponse(
                    exists=True,
                    report=report,
                    can_edit=report.status in [ReportStatus.DRAFT, ReportStatus.REJECTED]
                )
            else:
                return EODExistsResponse(
                    exists=False,
                    report=None,
                    can_edit=True
                )
                
        except Exception as e:
            logger.error(f"Error checking EOD exists: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to check EOD existence"
            )
    
    async def get_eod_analytics(self, outlet_id: str, date_from: str, date_to: str) -> EODAnalytics:
        """Get EOD analytics for a date range"""
        try:
            # Get reports for the period
            reports_response = await self.get_eod_reports(outlet_id, date_from, date_to, page=1, size=1000)
            reports = reports_response["items"]
            
            if not reports:
                return EODAnalytics(
                    average_daily_sales=0.0,
                    total_sales=0.0,
                    total_expenses=0.0,
                    net_profit=0.0,
                    cash_flow_trend=[],
                    payment_method_breakdown={"cash": 0.0, "transfer": 0.0, "pos": 0.0, "credit": 0.0},
                    discrepancy_count=0,
                    average_gross_margin=0.0,
                    sales_trend=[],
                    top_performing_days=[],
                    cash_variance_summary={}
                )
            
            # Calculate analytics
            total_sales = sum(report.get_total_sales() for report in reports)
            total_expenses = sum(report.inventory_cost for report in reports)
            net_profit = total_sales - total_expenses
            average_daily_sales = total_sales / len(reports) if reports else 0
            
            # Payment method breakdown
            payment_breakdown = {
                "cash": sum(report.sales_cash for report in reports),
                "transfer": sum(report.sales_transfer for report in reports),
                "pos": sum(report.sales_pos for report in reports),
                "credit": sum(report.sales_credit for report in reports)
            }
            
            # Cash flow trend
            cash_flow_trend = [
                {"date": report.date, "amount": report.closing_balance - report.opening_balance}
                for report in reports
            ]
            
            # Sales trend
            sales_trend = [
                {
                    "date": report.date,
                    "sales": report.get_total_sales(),
                    "expenses": report.inventory_cost,
                    "profit": report.get_gross_profit()
                }
                for report in reports
            ]
            
            # Discrepancy count
            discrepancy_count = sum(1 for report in reports if report.discrepancies and len(report.discrepancies) > 0)
            
            # Average gross margin
            total_gross_profit = sum(report.get_gross_profit() for report in reports)
            average_gross_margin = (total_gross_profit / total_sales * 100) if total_sales > 0 else 0
            
            # Top performing days
            top_performing_days = sorted(
                [{"date": report.date, "sales": report.get_total_sales(), "profit": report.get_gross_profit()} for report in reports],
                key=lambda x: x["sales"],
                reverse=True
            )[:5]
            
            # Cash variance summary
            cash_variances = [report.get_cash_variance() for report in reports]
            cash_variance_summary = {
                "average": sum(cash_variances) / len(cash_variances) if cash_variances else 0,
                "max": max(cash_variances) if cash_variances else 0,
                "min": min(cash_variances) if cash_variances else 0,
                "positive_count": sum(1 for v in cash_variances if v > 0),
                "negative_count": sum(1 for v in cash_variances if v < 0)
            }
            
            return EODAnalytics(
                average_daily_sales=round(average_daily_sales, 2),
                total_sales=round(total_sales, 2),
                total_expenses=round(total_expenses, 2),
                net_profit=round(net_profit, 2),
                cash_flow_trend=cash_flow_trend,
                payment_method_breakdown={k: round(v, 2) for k, v in payment_breakdown.items()},
                discrepancy_count=discrepancy_count,
                average_gross_margin=round(average_gross_margin, 2),
                sales_trend=sales_trend,
                top_performing_days=top_performing_days,
                cash_variance_summary={k: round(v, 2) if isinstance(v, float) else v for k, v in cash_variance_summary.items()}
            )
            
        except Exception as e:
            logger.error(f"Error getting EOD analytics: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get EOD analytics"
            )
    
    async def get_eod_stats(self, outlet_id: str) -> EODStatsResponse:
        """Get EOD statistics"""
        try:
            # Get all reports for the outlet
            response = self.supabase.table(Tables.DAILY_REPORTS).select("*").eq("outlet_id", outlet_id).execute()
            
            reports = response.data or []
            
            # Calculate statistics
            total_reports = len(reports)
            submitted_reports = sum(1 for r in reports if r.get("status") == ReportStatus.SUBMITTED)
            approved_reports = sum(1 for r in reports if r.get("status") == ReportStatus.APPROVED)
            pending_reports = sum(1 for r in reports if r.get("status") == ReportStatus.DRAFT)
            
            total_sales = sum(r.get("total_sales", 0) for r in reports)
            total_profit = sum(r.get("gross_profit", 0) for r in reports)
            average_daily_sales = total_sales / total_reports if total_reports > 0 else 0
            
            # Average gross margin
            total_gross_profit = sum(r.get("gross_profit", 0) for r in reports)
            average_gross_margin = (total_gross_profit / total_sales * 100) if total_sales > 0 else 0
            
            # Status distribution
            status_distribution = {}
            for report in reports:
                status = report.get("status", "draft")
                status_distribution[status] = status_distribution.get(status, 0) + 1
            
            return EODStatsResponse(
                total_reports=total_reports,
                submitted_reports=submitted_reports,
                approved_reports=approved_reports,
                pending_reports=pending_reports,
                total_sales=round(total_sales, 2),
                total_profit=round(total_profit, 2),
                average_daily_sales=round(average_daily_sales, 2),
                average_gross_margin=round(average_gross_margin, 2),
                status_distribution=status_distribution
            )
            
        except Exception as e:
            logger.error(f"Error getting EOD stats: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get EOD statistics"
            )
    
    async def approve_eod_report(self, report_id: str, approval_data: EODApprovalRequest, outlet_id: str, user_id: str) -> EODApprovalResponse:
        """Approve or reject an EOD report"""
        try:
            # Check if report exists
            report = await self.get_eod_report(report_id, outlet_id)
            
            # Update report status
            new_status = ReportStatus.APPROVED if approval_data.approved else ReportStatus.REJECTED
            update_data = {
                "status": new_status,
                "approved_by": user_id,
                "approved_at": datetime.now().isoformat(),
                "notes": approval_data.notes
            }
            
            response = self.supabase.table(Tables.DAILY_REPORTS).update(update_data).eq("id", report_id).eq("outlet_id", outlet_id).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update report status"
                )
            
            return EODApprovalResponse(
                report_id=report_id,
                status=new_status,
                approved_by=user_id,
                approved_at=datetime.now(),
                notes=approval_data.notes
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error approving EOD report: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to approve EOD report"
            )
    
    def _calculate_discrepancies(self, eod_data: EODCreate) -> Dict[str, Any]:
        """Calculate discrepancies in the EOD data"""
        discrepancies = {}
        
        # Cash variance check
        expected_cash = eod_data.get_expected_cash()
        actual_cash = eod_data.closing_balance
        cash_variance = actual_cash - expected_cash
        
        if abs(cash_variance) > 10:  # More than $10 variance
            discrepancies["cash_variance"] = {
                "expected": expected_cash,
                "actual": actual_cash,
                "variance": cash_variance,
                "severity": "high" if abs(cash_variance) > 100 else "medium"
            }
        
        # Gross margin check
        total_sales = eod_data.get_total_sales()
        if total_sales > 0:
            gross_margin = eod_data.get_gross_margin_percent()
            if gross_margin < 20:  # Less than 20% gross margin
                discrepancies["low_margin"] = {
                    "margin_percent": gross_margin,
                    "severity": "high" if gross_margin < 10 else "medium"
                }
        
        # Sales consistency check
        total_sales = eod_data.get_total_sales()
        if total_sales == 0:
            discrepancies["no_sales"] = {
                "message": "No sales recorded for the day",
                "severity": "high"
            }
        
        return discrepancies


# Create service instance
eod_service = EODService()
