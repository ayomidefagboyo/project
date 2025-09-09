"""
Payment schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"
    FAILED = "failed"


class PaymentMethod(str, Enum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    MOBILE_MONEY = "mobile_money"
    CHECK = "check"
    OTHER = "other"


class PaymentCreate(BaseModel):
    """Schema for creating a payment"""
    amount: float = Field(..., gt=0, description="Payment amount")
    vendor_id: Optional[str] = Field(None, description="Vendor ID if payment to vendor")
    invoice_id: Optional[str] = Field(None, description="Invoice ID if payment for invoice")
    description: str = Field(..., min_length=1, max_length=500, description="Payment description")
    payment_method: PaymentMethod = Field(..., description="Payment method")
    payment_date: Optional[datetime] = Field(None, description="Payment date")
    reference_number: Optional[str] = Field(None, max_length=100, description="Reference number")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")


class PaymentUpdate(BaseModel):
    """Schema for updating a payment"""
    amount: Optional[float] = Field(None, gt=0, description="Payment amount")
    description: Optional[str] = Field(None, min_length=1, max_length=500, description="Payment description")
    payment_method: Optional[PaymentMethod] = Field(None, description="Payment method")
    payment_date: Optional[datetime] = Field(None, description="Payment date")
    reference_number: Optional[str] = Field(None, max_length=100, description="Reference number")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")
    status: Optional[PaymentStatus] = Field(None, description="Payment status")
    paid_by: Optional[str] = Field(None, description="User ID who processed payment")
    confirmed_by: Optional[str] = Field(None, description="User ID who confirmed payment")
    bank_reference: Optional[str] = Field(None, max_length=100, description="Bank reference number")


class PaymentResponse(BaseModel):
    """Schema for payment response"""
    id: str
    outlet_id: str
    amount: float
    vendor_id: Optional[str] = None
    invoice_id: Optional[str] = None
    description: str
    payment_method: PaymentMethod
    payment_date: Optional[datetime] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    status: PaymentStatus
    created_by: Optional[str] = None
    paid_by: Optional[str] = None
    confirmed_by: Optional[str] = None
    bank_reference: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaymentListResponse(BaseModel):
    """Schema for paginated payment list response"""
    items: List[PaymentResponse]
    total: int
    page: int
    size: int
    pages: int


class PaymentQueueItem(BaseModel):
    """Schema for payment queue item"""
    id: str
    vendor_name: str
    amount: float
    due_date: Optional[datetime] = None
    priority: str = "normal"
    description: str
    days_overdue: Optional[int] = None


class PaymentQueueResponse(BaseModel):
    """Schema for payment queue response"""
    items: List[PaymentQueueItem]
    total_amount: float
    overdue_count: int
    upcoming_count: int


class GroupedPayments(BaseModel):
    """Schema for grouped payments"""
    vendor_id: str
    vendor_name: str
    total_amount: float
    payment_count: int
    payments: List[PaymentResponse]


class BulkPaymentUpdate(BaseModel):
    """Schema for bulk payment updates"""
    payment_ids: List[str] = Field(..., min_items=1, description="List of payment IDs to update")
    status: Optional[PaymentStatus] = Field(None, description="New status for all payments")
    payment_method: Optional[PaymentMethod] = Field(None, description="New payment method")
    bank_reference: Optional[str] = Field(None, max_length=100, description="Bank reference number")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")


class PaymentStatsResponse(BaseModel):
    """Schema for payment statistics response"""
    total_payments: int
    total_amount: float
    pending_payments: int
    pending_amount: float
    paid_payments: int
    paid_amount: float
    overdue_payments: int
    overdue_amount: float
    average_payment_amount: float
    payment_method_breakdown: Dict[str, float]


class PaymentSearchRequest(BaseModel):
    """Schema for payment search request"""
    query: Optional[str] = Field(None, description="Search query")
    status: Optional[PaymentStatus] = Field(None, description="Filter by status")
    payment_method: Optional[PaymentMethod] = Field(None, description="Filter by payment method")
    vendor_id: Optional[str] = Field(None, description="Filter by vendor")
    min_amount: Optional[float] = Field(None, gt=0, description="Minimum amount")
    max_amount: Optional[float] = Field(None, gt=0, description="Maximum amount")
    date_from: Optional[datetime] = Field(None, description="Start date filter")
    date_to: Optional[datetime] = Field(None, description="End date filter")
    limit: int = Field(20, ge=1, le=100, description="Number of results to return")


class PaymentSearchResponse(BaseModel):
    """Schema for payment search response"""
    items: List[PaymentResponse]
    total: int
    query: PaymentSearchRequest
