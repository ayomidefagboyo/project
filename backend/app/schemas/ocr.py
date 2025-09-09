"""
OCR schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class FileType(str, Enum):
    IMAGE = "image"
    PDF = "pdf"


class OCRStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class OCRProcessingRequest(BaseModel):
    """Schema for OCR processing request"""
    file_url: str = Field(..., description="URL of the file to process")
    file_type: FileType = Field(..., description="Type of file")
    enable_google_vision: bool = Field(True, description="Whether to use Google Vision API")
    extract_invoice_data: bool = Field(True, description="Whether to extract invoice-specific data")


class OCRExtractedData(BaseModel):
    """Schema for extracted OCR data"""
    text: str = Field(..., description="Raw extracted text")
    confidence: float = Field(..., ge=0, le=100, description="OCR confidence score")
    
    # Invoice-specific fields
    invoice_number: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_address: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    total_amount: Optional[float] = None
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    tax_rate: Optional[float] = None
    
    # Line items
    line_items: Optional[List[Dict[str, Any]]] = None
    
    # Additional fields
    currency: Optional[str] = None
    payment_terms: Optional[str] = None
    po_number: Optional[str] = None


class OCRProcessingResponse(BaseModel):
    """Schema for OCR processing response"""
    id: str
    file_url: str
    file_type: FileType
    status: OCRStatus
    extracted_data: Optional[OCRExtractedData] = None
    error_message: Optional[str] = None
    processing_time: Optional[float] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FileUploadResponse(BaseModel):
    """Schema for file upload response"""
    file_id: str
    file_url: str
    file_name: str
    file_size: int
    file_type: str
    uploaded_at: datetime
    ocr_processing_id: Optional[str] = None


class OCRStatsResponse(BaseModel):
    """Schema for OCR statistics response"""
    total_processed: int
    successful_extractions: int
    failed_extractions: int
    average_confidence: float
    average_processing_time: float
    files_by_type: Dict[str, int]


class OCRReviewRequest(BaseModel):
    """Schema for OCR review request"""
    ocr_id: str = Field(..., description="OCR processing ID")
    corrections: Dict[str, Any] = Field(..., description="Manual corrections to OCR data")
    approved: bool = Field(..., description="Whether the OCR result is approved")
    notes: Optional[str] = Field(None, max_length=1000, description="Review notes")


class OCRReviewResponse(BaseModel):
    """Schema for OCR review response"""
    ocr_id: str
    reviewed_by: str
    reviewed_at: datetime
    approved: bool
    corrections_applied: Dict[str, Any]
    notes: Optional[str] = None


class FileListResponse(BaseModel):
    """Schema for file list response"""
    items: List[FileUploadResponse]
    total: int
    page: int
    size: int
    pages: int


class FileSearchRequest(BaseModel):
    """Schema for file search request"""
    query: Optional[str] = Field(None, description="Search query")
    file_type: Optional[FileType] = Field(None, description="Filter by file type")
    date_from: Optional[datetime] = Field(None, description="Start date filter")
    date_to: Optional[datetime] = Field(None, description="End date filter")
    has_ocr: Optional[bool] = Field(None, description="Filter files with/without OCR")
    limit: int = Field(20, ge=1, le=100, description="Number of results to return")


class FileSearchResponse(BaseModel):
    """Schema for file search response"""
    items: List[FileUploadResponse]
    total: int
    query: FileSearchRequest
