"""
Simplified Pydantic schemas for EOD reporting
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
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


class EnhancedDailyReport(BaseModel):
    """Schema for enhanced daily report response"""
    id: str = Field(..., description="Report unique identifier")
    outlet_id: str = Field(..., description="Outlet identifier")
    date: date = Field(..., description="Report date")
    status: ReportStatus = Field(ReportStatus.DRAFT, description="Report status")
    sales_cash: float = Field(0.0, description="Cash sales amount")
    sales_transfer: float = Field(0.0, description="Bank transfer sales amount")
    sales_pos: float = Field(0.0, description="POS card sales amount")
    sales_credit: float = Field(0.0, description="Credit sales amount")
    opening_balance: float = Field(0.0, description="Opening cash balance")
    closing_balance: float = Field(0.0, description="Closing cash balance")
    bank_deposit: float = Field(0.0, description="Bank deposit amount")
    inventory_cost: float = Field(0.0, description="Inventory cost")
    notes: Optional[str] = Field(None, description="Additional notes")
    total_sales: float = Field(..., description="Total sales amount")
    submitted_by: str = Field(..., description="User who submitted the report")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True