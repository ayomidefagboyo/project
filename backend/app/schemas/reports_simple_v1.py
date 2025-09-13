"""
Simplified Pydantic v1 compatible schemas for EOD reporting
"""

from pydantic import BaseModel
from typing import Optional
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
    date: date
    sales_cash: float = 0.0
    sales_transfer: float = 0.0
    sales_pos: float = 0.0
    sales_credit: float = 0.0
    opening_balance: float = 0.0
    closing_balance: float = 0.0
    bank_deposit: float = 0.0
    inventory_cost: float = 0.0
    notes: Optional[str] = None

    def get_total_sales(self) -> float:
        """Calculate total sales"""
        return round(self.sales_cash + self.sales_transfer + self.sales_pos + self.sales_credit, 2)


class EODCreate(EODData):
    """Schema for creating a new EOD report"""
    pass


class EODUpdate(BaseModel):
    """Schema for updating an EOD report"""
    sales_cash: Optional[float] = None
    sales_transfer: Optional[float] = None
    sales_pos: Optional[float] = None
    sales_credit: Optional[float] = None
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None
    bank_deposit: Optional[float] = None
    inventory_cost: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[ReportStatus] = None


class EnhancedDailyReport(BaseModel):
    """Schema for enhanced daily report response"""
    id: str
    outlet_id: str
    date: date
    status: ReportStatus = ReportStatus.DRAFT
    sales_cash: float = 0.0
    sales_transfer: float = 0.0
    sales_pos: float = 0.0
    sales_credit: float = 0.0
    opening_balance: float = 0.0
    closing_balance: float = 0.0
    bank_deposit: float = 0.0
    inventory_cost: float = 0.0
    notes: Optional[str] = None
    total_sales: float
    submitted_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
