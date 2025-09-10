"""
Pydantic schemas for invoice-related data validation
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
from app.schemas.ocr import OCRExtractedData, OCRStatus


class InvoiceStatus(str, Enum):
    """Invoice status enumeration"""
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class ApprovalStatus(str, Enum):
    """Approval status enumeration"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REQUIRES_REVIEW = "requires_review"


class InvoiceBase(BaseModel):
    """Base invoice schema with common fields"""
    invoice_number: str = Field(..., min_length=1, max_length=100, description="Invoice number")
    vendor_id: str = Field(..., description="Vendor ID")
    amount: float = Field(..., gt=0, description="Invoice amount")
    tax_amount: float = Field(0.0, ge=0, description="Tax amount")
    total_amount: float = Field(..., gt=0, description="Total amount including tax")
    description: Optional[str] = Field(None, max_length=1000, description="Invoice description")
    invoice_date: datetime = Field(..., description="Invoice date")
    due_date: datetime = Field(..., description="Due date")
    status: InvoiceStatus = Field(InvoiceStatus.PENDING, description="Invoice status")
    file_url: Optional[str] = Field(None, description="Invoice file URL")
    original_file_url: Optional[str] = Field(None, description="Original file URL")

    @validator('total_amount')
    def validate_total_amount(cls, v, values):
        if 'amount' in values and 'tax_amount' in values:
            expected_total = values['amount'] + values['tax_amount']
            if abs(v - expected_total) > 0.01:  # Allow small floating point differences
                raise ValueError('Total amount must equal amount + tax_amount')
        return round(v, 2)

    @validator('amount', 'tax_amount')
    def validate_amounts(cls, v):
        if v < 0:
            raise ValueError('Amount cannot be negative')
        return round(v, 2)


class InvoiceCreate(InvoiceBase):
    """Schema for creating a new invoice"""
    pass


class InvoiceUpdate(BaseModel):
    """Schema for updating an invoice"""
    invoice_number: Optional[str] = Field(None, min_length=1, max_length=100)
    vendor_id: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    tax_amount: Optional[float] = Field(None, ge=0)
    total_amount: Optional[float] = Field(None, gt=0)
    description: Optional[str] = Field(None, max_length=1000)
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    status: Optional[InvoiceStatus] = None
    file_url: Optional[str] = None
    original_file_url: Optional[str] = None

    @validator('amount', 'tax_amount', 'total_amount')
    def validate_amounts(cls, v):
        if v is not None and v < 0:
            raise ValueError('Amount cannot be negative')
        return round(v, 2) if v is not None else None


class EnhancedInvoiceResponse(InvoiceBase):
    """Schema for enhanced invoice response with OCR data"""
    id: str = Field(..., description="Invoice unique identifier")
    outlet_id: str = Field(..., description="Outlet identifier")
    vendor_phone: Optional[str] = Field(None, description="Vendor phone number")
    vendor_account_number: Optional[str] = Field(None, description="Vendor account number")
    vendor_bank_name: Optional[str] = Field(None, description="Vendor bank name")
    ocr_status: OCRStatus = Field(..., description="OCR processing status")
    ocr_data: Optional[OCRExtractedData] = Field(None, description="OCR extracted data")
    ocr_confidence: Optional[float] = Field(None, ge=0, le=100, description="OCR confidence score")
    requires_review: bool = Field(False, description="Whether invoice requires manual review")
    approval_status: ApprovalStatus = Field(ApprovalStatus.PENDING, description="Approval status")
    approved_by: Optional[str] = Field(None, description="User who approved")
    approved_at: Optional[datetime] = Field(None, description="Approval timestamp")
    created_by: str = Field(..., description="User who created the invoice")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class InvoiceListResponse(BaseModel):
    """Schema for invoice list response with pagination"""
    items: List[EnhancedInvoiceResponse] = Field(..., description="List of invoices")
    total: int = Field(..., description="Total number of invoices")
    page: int = Field(..., description="Current page number")
    size: int = Field(..., description="Page size")
    pages: int = Field(..., description="Total number of pages")


class InvoiceStatsResponse(BaseModel):
    """Schema for invoice statistics response"""
    total_invoices: int = Field(..., description="Total number of invoices")
    total_amount: float = Field(..., description="Total invoice amount")
    pending_amount: float = Field(..., description="Pending invoice amount")
    overdue_amount: float = Field(..., description="Overdue invoice amount")
    paid_amount: float = Field(..., description="Paid invoice amount")
    status_distribution: Dict[str, int] = Field(..., description="Distribution by status")
    approval_distribution: Dict[str, int] = Field(..., description="Distribution by approval status")
    ocr_success_rate: float = Field(..., description="OCR success rate percentage")


class InvoiceSearchRequest(BaseModel):
    """Schema for invoice search request"""
    query: str = Field(..., min_length=1, max_length=255, description="Search query")
    status: Optional[InvoiceStatus] = None
    approval_status: Optional[ApprovalStatus] = None
    vendor_id: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    requires_review: Optional[bool] = None
    limit: int = Field(10, ge=1, le=100, description="Maximum number of results")


class InvoiceApprovalRequest(BaseModel):
    """Schema for invoice approval request"""
    approved: bool = Field(..., description="Whether to approve or reject")
    notes: Optional[str] = Field(None, max_length=1000, description="Approval notes")
    corrected_data: Optional[Dict[str, Any]] = Field(None, description="Corrected data if any")


class InvoiceApprovalResponse(BaseModel):
    """Schema for invoice approval response"""
    invoice_id: str = Field(..., description="Invoice ID")
    approval_status: ApprovalStatus = Field(..., description="Updated approval status")
    approved_by: str = Field(..., description="User who approved/rejected")
    approved_at: datetime = Field(..., description="Approval timestamp")
    notes: Optional[str] = Field(None, description="Approval notes")


class InvoiceWithOCRRequest(BaseModel):
    """Schema for creating invoice with OCR data"""
    file_url: str = Field(..., description="Invoice file URL")
    ocr_data: OCRExtractedData = Field(..., description="OCR extracted data")
    ocr_confidence: float = Field(..., ge=0, le=100, description="OCR confidence score")
    auto_approve: bool = Field(False, description="Whether to auto-approve if confidence is high")
    vendor_id: Optional[str] = Field(None, description="Vendor ID (if not extracted)")


class InvoiceWithOCRResponse(BaseModel):
    """Schema for invoice creation with OCR response"""
    invoice: EnhancedInvoiceResponse = Field(..., description="Created invoice")
    ocr_processing_id: str = Field(..., description="OCR processing ID")
    requires_manual_review: bool = Field(..., description="Whether manual review is required")
    suggested_actions: List[str] = Field(..., description="Suggested actions for the invoice")




