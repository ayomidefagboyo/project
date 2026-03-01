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
        self._actor_name_cache: Dict[str, Optional[str]] = {}
    
    @property
    def supabase(self):
        if self._supabase is None:
            self._supabase = get_supabase_admin()
        return self._supabase

    def _resolve_actor_display_name(self, actor_id: Optional[str]) -> Optional[str]:
        resolved_actor_id = str(actor_id or "").strip()
        if not resolved_actor_id:
            return None

        if resolved_actor_id in self._actor_name_cache:
            return self._actor_name_cache[resolved_actor_id]

        try:
            staff_result = (
                self.supabase.table(Tables.STAFF_PROFILES)
                .select("display_name")
                .eq("id", resolved_actor_id)
                .limit(1)
                .execute()
            )
            if staff_result.data:
                display_name = str(staff_result.data[0].get("display_name") or "").strip()
                if display_name:
                    self._actor_name_cache[resolved_actor_id] = display_name
                    return display_name
        except Exception as staff_error:
            logger.warning("Failed resolving EOD actor from staff_profiles: %s", staff_error)

        try:
            user_result = (
                self.supabase.table(Tables.USERS)
                .select("name,email")
                .eq("id", resolved_actor_id)
                .limit(1)
                .execute()
            )
            if user_result.data:
                profile = user_result.data[0]
                display_name = str(profile.get("name") or profile.get("email") or "").strip()
                if display_name:
                    self._actor_name_cache[resolved_actor_id] = display_name
                    return display_name
        except Exception as user_error:
            logger.warning("Failed resolving EOD actor from users: %s", user_error)

        self._actor_name_cache[resolved_actor_id] = None
        return None

    def _serialize_report(self, report: Dict[str, Any]) -> EnhancedDailyReport:
        payload = dict(report or {})
        actor_id = str(payload.get("submitted_by") or "").strip()
        actor_name = self._resolve_actor_display_name(actor_id)
        if actor_name:
            payload["created_by"] = actor_name
        return EnhancedDailyReport(**payload)
    
    async def create_eod_report(self, eod_data: EODCreate, outlet_id: str, actor_id: str) -> EnhancedDailyReport:
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
            
            # Prepare report data - only include columns that exist in database
            report_dict = eod_data.dict()
            # Convert date to string for JSON serialization
            if isinstance(report_dict.get("date"), date):
                report_dict["date"] = report_dict["date"].isoformat()

            # Prepare full EOD report data for the eod table
            eod_report = {
                "date": report_dict["date"],
                "sales_cash": eod_data.sales_cash,
                "sales_transfer": eod_data.sales_transfer,
                "sales_pos": eod_data.sales_pos,
                "sales_credit": eod_data.sales_credit,
                "opening_balance": eod_data.opening_balance,
                "closing_balance": eod_data.closing_balance,
                "bank_deposit": eod_data.bank_deposit,
                "inventory_cost": eod_data.inventory_cost,
                "notes": eod_data.notes,
                "outlet_id": outlet_id,
                "submitted_by": actor_id,
                "total_sales": total_sales,
                "gross_profit": gross_profit,
                "expected_cash": expected_cash,
                "cash_variance": cash_variance,
                "gross_margin_percent": gross_margin_percent,
                "status": ReportStatus.APPROVED,
                "approved_by": actor_id,
                "approved_at": datetime.now().isoformat(),
                "discrepancies": self._calculate_discrepancies(eod_data)
            }

            # Insert report into eod table
            response = self.supabase.table(Tables.EOD).insert(eod_report).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create EOD report"
                )

            report = response.data[0]
            return self._serialize_report(report)
            
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
            query = self.supabase.table(Tables.EOD).select("*", count="exact")
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
            
            reports = [self._serialize_report(report) for report in response.data]
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
            response = self.supabase.table(Tables.EOD).select("*").eq("id", report_id).eq("outlet_id", outlet_id).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="EOD report not found"
                )
            
            report = response.data[0]
            return self._serialize_report(report)
            
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
            response = self.supabase.table(Tables.EOD).update(update_dict).eq("id", report_id).eq("outlet_id", outlet_id).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update EOD report"
                )
            
            report = response.data[0]
            return self._serialize_report(report)
            
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
            response = self.supabase.table(Tables.EOD).delete().eq("id", report_id).eq("outlet_id", outlet_id).execute()
            
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
            response = self.supabase.table(Tables.EOD).select("*").eq("outlet_id", outlet_id).eq("date", report_date).execute()
            
            if response.data:
                report = self._serialize_report(response.data[0])
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

    async def get_eod_analytics(self, outlet_id: str, date_from: Optional[str] = None, date_to: Optional[str] = None) -> Dict[str, Any]:
        """Get EOD analytics for dashboard"""
        try:
            from datetime import datetime, timedelta

            # Default date range: last 30 days
            if not date_to:
                date_to = datetime.now().strftime('%Y-%m-%d')
            if not date_from:
                date_from = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')

            # Get all EOD reports in date range
            response = self.supabase.table(Tables.EOD)\
                .select("*")\
                .eq("outlet_id", outlet_id)\
                .gte("date", date_from)\
                .lte("date", date_to)\
                .order("date", desc=False)\
                .execute()

            reports = response.data or []

            if not reports:
                return {
                    "average_daily_sales": 0,
                    "total_sales": 0,
                    "total_expenses": 0,
                    "net_profit": 0,
                    "cash_variance": 0,
                    "sales_trend": [],
                    "top_selling_days": [],
                    "expense_breakdown": {},
                    "cash_flow_analysis": {
                        "average_cash_flow": 0,
                        "cash_flow_trend": "stable",
                        "variance_analysis": {
                            "high_variance_days": 0,
                            "low_variance_days": 0,
                            "average_variance": 0
                        }
                    }
                }

            # Calculate metrics
            total_sales = sum(float(r.get('total_sales', 0)) for r in reports)
            total_expenses = sum(float(r.get('inventory_cost', 0)) for r in reports)
            total_cash_variance = sum(float(r.get('cash_variance', 0)) for r in reports)

            average_daily_sales = total_sales / len(reports) if reports else 0
            net_profit = total_sales - total_expenses

            # Sales trend data
            sales_trend = []
            for report in reports:
                sales_trend.append({
                    "date": report.get('date'),
                    "sales": float(report.get('total_sales', 0)),
                    "expenses": float(report.get('inventory_cost', 0)),
                    "profit": float(report.get('gross_profit', 0))
                })

            # Top selling days (sorted by sales)
            top_selling_days = sorted(
                [{"date": r.get('date'), "sales": float(r.get('total_sales', 0))} for r in reports],
                key=lambda x: x['sales'],
                reverse=True
            )[:5]

            # Expense breakdown
            expense_breakdown = {
                "inventory": total_expenses,
                "operational": 0  # Could add more categories later
            }

            # Cash flow analysis
            variances = [float(r.get('cash_variance', 0)) for r in reports]
            average_variance = sum(variances) / len(variances) if variances else 0
            high_variance_days = sum(1 for v in variances if abs(v) > 100)
            low_variance_days = sum(1 for v in variances if abs(v) <= 10)

            # Determine trend
            if len(sales_trend) >= 2:
                recent_avg = sum(d['sales'] for d in sales_trend[-7:]) / min(7, len(sales_trend))
                earlier_avg = sum(d['sales'] for d in sales_trend[:-7]) / max(1, len(sales_trend) - 7)
                if recent_avg > earlier_avg * 1.05:
                    cash_flow_trend = "increasing"
                elif recent_avg < earlier_avg * 0.95:
                    cash_flow_trend = "decreasing"
                else:
                    cash_flow_trend = "stable"
            else:
                cash_flow_trend = "stable"

            return {
                "average_daily_sales": round(average_daily_sales, 2),
                "total_sales": round(total_sales, 2),
                "total_expenses": round(total_expenses, 2),
                "net_profit": round(net_profit, 2),
                "cash_variance": round(total_cash_variance, 2),
                "sales_trend": sales_trend,
                "top_selling_days": top_selling_days,
                "expense_breakdown": expense_breakdown,
                "cash_flow_analysis": {
                    "average_cash_flow": round(average_variance, 2),
                    "cash_flow_trend": cash_flow_trend,
                    "variance_analysis": {
                        "high_variance_days": high_variance_days,
                        "low_variance_days": low_variance_days,
                        "average_variance": round(average_variance, 2)
                    }
                }
            }

        except Exception as e:
            logger.error(f"Error getting EOD analytics: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get EOD analytics"
            )

    async def get_eod_stats_overview(self, outlet_id: str, date_from: Optional[str] = None, date_to: Optional[str] = None) -> Dict[str, Any]:
        """Get EOD statistics overview for dashboard"""
        try:
            from datetime import datetime, timedelta

            # Use provided dates or default to current month
            if not date_to:
                date_to = datetime.now().strftime('%Y-%m-%d')
            if not date_from:
                date_from = datetime.now().replace(day=1).strftime('%Y-%m-%d')

            response = self.supabase.table(Tables.EOD)\
                .select("*")\
                .eq("outlet_id", outlet_id)\
                .gte("date", date_from)\
                .lte("date", date_to)\
                .execute()

            reports = response.data or []

            # Calculate basic stats
            total_reports = len(reports)
            total_sales = sum(float(r.get('total_sales', 0)) for r in reports)
            total_expenses = sum(float(r.get('inventory_cost', 0)) for r in reports)
            net_profit = total_sales - total_expenses
            cash_variance = sum(float(r.get('cash_variance', 0)) for r in reports)
            average_daily_sales = total_sales / max(1, total_reports)

            # Reports by status
            reports_by_status = {}
            for report in reports:
                status = report.get('status', 'draft')
                reports_by_status[status] = reports_by_status.get(status, 0) + 1

            # Sales by payment method
            sales_by_payment_method = {
                "cash": sum(float(r.get('sales_cash', 0)) for r in reports),
                "transfer": sum(float(r.get('sales_transfer', 0)) for r in reports),
                "pos": sum(float(r.get('sales_pos', 0)) for r in reports),
                "credit": sum(float(r.get('sales_credit', 0)) for r in reports)
            }

            # Monthly trends (last 6 months)
            monthly_trends = []
            for i in range(6):
                month_start = (datetime.now().replace(day=1) - timedelta(days=30*i)).replace(day=1)
                month_end = (month_start.replace(month=month_start.month % 12 + 1) - timedelta(days=1)) if month_start.month != 12 else month_start.replace(year=month_start.year + 1, month=1) - timedelta(days=1)

                month_response = self.supabase.table(Tables.EOD)\
                    .select("*")\
                    .eq("outlet_id", outlet_id)\
                    .gte("date", month_start.strftime('%Y-%m-%d'))\
                    .lte("date", month_end.strftime('%Y-%m-%d'))\
                    .execute()

                month_reports = month_response.data or []
                month_sales = sum(float(r.get('total_sales', 0)) for r in month_reports)
                month_expenses = sum(float(r.get('inventory_cost', 0)) for r in month_reports)

                monthly_trends.append({
                    "month": month_start.strftime('%Y-%m'),
                    "sales": round(month_sales, 2),
                    "expenses": round(month_expenses, 2),
                    "profit": round(month_sales - month_expenses, 2)
                })

            return {
                "total_reports": total_reports,
                "total_sales": round(total_sales, 2),
                "total_expenses": round(total_expenses, 2),
                "net_profit": round(net_profit, 2),
                "average_daily_sales": round(average_daily_sales, 2),
                "cash_variance": round(cash_variance, 2),
                "reports_by_status": reports_by_status,
                "sales_by_payment_method": {k: round(v, 2) for k, v in sales_by_payment_method.items()},
                "monthly_trends": monthly_trends[::-1]  # Reverse to show oldest to newest
            }

        except Exception as e:
            logger.error(f"Error getting EOD stats overview: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get EOD stats overview"
            )

    async def get_eod_analytics_old(self, outlet_id: str, date_from: str, date_to: str) -> EODAnalytics:
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
                {"date": report.date.isoformat() if isinstance(report.date, date) else report.date, "amount": report.closing_balance - report.opening_balance}
                for report in reports
            ]

            # Sales trend
            sales_trend = [
                {
                    "date": report.date.isoformat() if isinstance(report.date, date) else report.date,
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
                [{"date": report.date.isoformat() if isinstance(report.date, date) else report.date, "sales": report.get_total_sales(), "profit": report.get_gross_profit()} for report in reports],
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
            response = self.supabase.table(Tables.EOD).select("*").eq("outlet_id", outlet_id).execute()
            
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
            
            response = self.supabase.table(Tables.EOD).update(update_data).eq("id", report_id).eq("outlet_id", outlet_id).execute()
            
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
