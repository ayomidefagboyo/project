"""
Pydantic schemas for EOD reporting and analytics data validation
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, List, ForwardRef
from datetime import datetime, date
from enum import Enum


class ReportStatus(str, Enum):
    """Report status enumeration"""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class EODData(BaseModel):
    """Schema for EOD (End of Day) report data"""
    date: date = Field(..., description="Report date")
    sales_cash: float = Field(0.0, ge=0, description="Cash sales amount")
    sales_transfer: float = Field(0.0, ge=0, description="Bank transfer sales amount")
    sales_pos: float = Field(0.0, ge=0, description="POS card sales amount")
    sales_credit: float = Field(0.0, ge=0, description="Credit sales amount")
    opening_balance: float = Field(0.0, ge=0, description="Opening cash balance")
    closing_balance: float = Field(0.0, ge=0, description="Closing cash balance")
    bank_deposit: float = Field(0.0, ge=0, description="Bank deposit amount")
    inventory_cost: float = Field(0.0, ge=0, description="Inventory cost")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")

    def get_total_sales(self) -> float:
        """Calculate total sales"""
        return round(self.sales_cash + self.sales_transfer + self.sales_pos + self.sales_credit, 2)

    def get_gross_profit(self) -> float:
        """Calculate gross profit"""
        return round(self.get_total_sales() - self.inventory_cost, 2)

    def get_expected_cash(self) -> float:
        """Calculate expected cash balance"""
        return round(self.opening_balance + self.sales_cash - self.bank_deposit, 2)

    def get_cash_variance(self) -> float:
        """Calculate cash variance"""
        return round(self.closing_balance - self.get_expected_cash(), 2)

    def get_gross_margin_percent(self) -> float:
        """Calculate gross margin percentage"""
        total_sales = self.get_total_sales()
        if total_sales > 0:
            return round((self.get_gross_profit() / total_sales) * 100, 2)
        return 0.0


class EODCreate(EODData):
    """Schema for creating a new EOD report"""
    pass


class EODUpdate(BaseModel):
    """Schema for updating an EOD report"""
    sales_cash: Optional[float] = Field(None, ge=0)
    sales_transfer: Optional[float] = Field(None, ge=0)
    sales_pos: Optional[float] = Field(None, ge=0)
    sales_credit: Optional[float] = Field(None, ge=0)
    opening_balance: Optional[float] = Field(None, ge=0)
    closing_balance: Optional[float] = Field(None, ge=0)
    bank_deposit: Optional[float] = Field(None, ge=0)
    inventory_cost: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[ReportStatus] = None



class EnhancedDailyReport(EODData):
    """Schema for enhanced daily report response"""
    id: str = Field(..., description="Report unique identifier")
    outlet_id: str = Field(..., description="Outlet identifier")
    status: ReportStatus = Field(ReportStatus.DRAFT, description="Report status")
    total_sales: float = Field(..., description="Total sales amount")
    gross_profit: float = Field(..., description="Gross profit amount")
    expected_cash: float = Field(..., description="Expected cash balance")
    cash_variance: float = Field(..., description="Cash variance")
    gross_margin_percent: float = Field(..., description="Gross margin percentage")
    discrepancies: Optional[Dict[str, Any]] = Field(None, description="Discrepancy details")
    submitted_by: str = Field(..., description="User who submitted the report")
    submitted_at: Optional[datetime] = Field(None, description="Submission timestamp")
    approved_by: Optional[str] = Field(None, description="User who approved the report")
    approved_at: Optional[datetime] = Field(None, description="Approval timestamp")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class EODListResponse(BaseModel):
    """Schema for EOD list response with pagination"""
    items: List[EnhancedDailyReport] = Field(..., description="List of EOD reports")
    total: int = Field(..., description="Total number of reports")
    page: int = Field(..., description="Current page number")
    size: int = Field(..., description="Page size")
    pages: int = Field(..., description="Total number of pages")


class EODAnalytics(BaseModel):
    """Schema for EOD analytics response"""
    average_daily_sales: float = Field(..., description="Average daily sales")
    total_sales: float = Field(..., description="Total sales for period")
    total_expenses: float = Field(..., description="Total expenses for period")
    net_profit: float = Field(..., description="Net profit for period")
    cash_flow_trend: List[Dict[str, Any]] = Field(..., description="Cash flow trend data")
    payment_method_breakdown: Dict[str, float] = Field(..., description="Payment method breakdown")
    discrepancy_count: int = Field(..., description="Number of reports with discrepancies")
    average_gross_margin: float = Field(..., description="Average gross margin percentage")
    sales_trend: List[Dict[str, Any]] = Field(..., description="Sales trend data")
    top_performing_days: List[Dict[str, Any]] = Field(..., description="Top performing days")
    cash_variance_summary: Dict[str, Any] = Field(..., description="Cash variance summary")


class EODStatsResponse(BaseModel):
    """Schema for EOD statistics response"""
    total_reports: int = Field(..., description="Total number of reports")
    submitted_reports: int = Field(..., description="Number of submitted reports")
    approved_reports: int = Field(..., description="Number of approved reports")
    pending_reports: int = Field(..., description="Number of pending reports")
    total_sales: float = Field(..., description="Total sales amount")
    total_profit: float = Field(..., description="Total profit amount")
    average_daily_sales: float = Field(..., description="Average daily sales")
    average_gross_margin: float = Field(..., description="Average gross margin")
    status_distribution: Dict[str, int] = Field(..., description="Distribution by status")


class EODSearchRequest(BaseModel):
    """Schema for EOD search request"""
    date_from: Optional[date] = Field(None, description="Search from date")
    date_to: Optional[date] = Field(None, description="Search to date")
    status: Optional[ReportStatus] = Field(None, description="Filter by status")
    min_sales: Optional[float] = Field(None, ge=0, description="Minimum sales amount")
    max_sales: Optional[float] = Field(None, ge=0, description="Maximum sales amount")
    has_discrepancies: Optional[bool] = Field(None, description="Filter by discrepancies")
    limit: int = Field(10, ge=1, le=100, description="Maximum number of results")


class EODComparisonRequest(BaseModel):
    """Schema for EOD comparison request"""
    date_from: date = Field(..., description="Start date for comparison")
    date_to: date = Field(..., description="End date for comparison")
    compare_with_previous: bool = Field(True, description="Compare with previous period")
    metrics: List[str] = Field(["sales", "profit", "margin"], description="Metrics to compare")


class EODComparisonResponse(BaseModel):
    """Schema for EOD comparison response"""
    current_period: Dict[str, Any] = Field(..., description="Current period data")
    previous_period: Optional[Dict[str, Any]] = Field(None, description="Previous period data")
    comparison: Dict[str, Any] = Field(..., description="Comparison analysis")
    trends: Dict[str, Any] = Field(..., description="Trend analysis")
    recommendations: List[str] = Field(..., description="Business recommendations")


class EODApprovalRequest(BaseModel):
    """Schema for EOD approval request"""
    approved: bool = Field(..., description="Whether to approve or reject")
    notes: Optional[str] = Field(None, max_length=1000, description="Approval notes")
    discrepancies_resolved: bool = Field(False, description="Whether discrepancies are resolved")


class EODApprovalResponse(BaseModel):
    """Schema for EOD approval response"""
    report_id: str = Field(..., description="Report ID")
    status: ReportStatus = Field(..., description="Updated status")
    approved_by: str = Field(..., description="User who approved/rejected")
    approved_at: datetime = Field(..., description="Approval timestamp")
    notes: Optional[str] = Field(None, description="Approval notes")


class EODExistsResponse(BaseModel):
    """Schema for EOD exists check response"""
    exists: bool = Field(..., description="Whether report exists")
    report: Optional[EnhancedDailyReport] = Field(None, description="Existing report if found")
    can_edit: bool = Field(True, description="Whether the report can be edited")


class EODSummaryResponse(BaseModel):
    """Schema for EOD summary response"""
    today_sales: float = Field(..., description="Today's sales")
    today_profit: float = Field(..., description="Today's profit")
    week_sales: float = Field(..., description="This week's sales")
    week_profit: float = Field(..., description="This week's profit")
    month_sales: float = Field(..., description="This month's sales")
    month_profit: float = Field(..., description="This month's profit")
    pending_reports: int = Field(..., description="Number of pending reports")
    last_report_date: Optional[date] = Field(None, description="Last report date")
    cash_variance_today: Optional[float] = Field(None, description="Today's cash variance")
