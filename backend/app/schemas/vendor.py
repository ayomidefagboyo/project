"""
Pydantic schemas for vendor-related data validation
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class VendorType(str, Enum):
    """Vendor type enumeration"""
    SUPPLIER = "supplier"
    SERVICE_PROVIDER = "service_provider"
    CONTRACTOR = "contractor"


class Address(BaseModel):
    """Address schema"""
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    country: str = "USA"


class VendorBase(BaseModel):
    """Base vendor schema with common fields"""
    name: str = Field(..., min_length=1, max_length=255, description="Vendor name")
    email: Optional[EmailStr] = Field(None, description="Vendor email address")
    phone: Optional[str] = Field(None, max_length=50, description="Vendor phone number")
    address: Optional[Address] = Field(None, description="Vendor address")
    payment_terms: Optional[str] = Field(None, max_length=100, description="Payment terms")
    contact_person: Optional[str] = Field(None, max_length=255, description="Contact person name")
    vendor_type: VendorType = Field(VendorType.SUPPLIER, description="Type of vendor")
    credit_limit: Optional[float] = Field(None, ge=0, description="Credit limit amount")

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Vendor name cannot be empty')
        return v.strip()

    @validator('phone')
    def validate_phone(cls, v):
        if v and not v.strip():
            return None
        return v.strip() if v else None


class VendorCreate(VendorBase):
    """Schema for creating a new vendor"""
    pass


class VendorUpdate(BaseModel):
    """Schema for updating a vendor"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[Address] = None
    payment_terms: Optional[str] = Field(None, max_length=100)
    contact_person: Optional[str] = Field(None, max_length=255)
    vendor_type: Optional[VendorType] = None
    credit_limit: Optional[float] = Field(None, ge=0)

    @validator('name')
    def validate_name(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Vendor name cannot be empty')
        return v.strip() if v else None

    @validator('phone')
    def validate_phone(cls, v):
        if v and not v.strip():
            return None
        return v.strip() if v else None


class VendorResponse(VendorBase):
    """Schema for vendor response"""
    id: str = Field(..., description="Vendor unique identifier")
    outlet_id: str = Field(..., description="Outlet identifier")
    current_balance: float = Field(0.0, description="Current balance")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class VendorListResponse(BaseModel):
    """Schema for vendor list response with pagination"""
    items: list[VendorResponse] = Field(..., description="List of vendors")
    total: int = Field(..., description="Total number of vendors")
    page: int = Field(..., description="Current page number")
    size: int = Field(..., description="Page size")
    pages: int = Field(..., description="Total number of pages")


class VendorSearchRequest(BaseModel):
    """Schema for vendor search request"""
    query: str = Field(..., min_length=1, max_length=255, description="Search query")
    limit: int = Field(10, ge=1, le=100, description="Maximum number of results")


class VendorStatsResponse(BaseModel):
    """Schema for vendor statistics response"""
    total_vendors: int = Field(..., description="Total number of vendors")
    type_distribution: Dict[str, int] = Field(..., description="Distribution by vendor type")
    total_outstanding: float = Field(..., description="Total outstanding balance")
    average_balance: float = Field(..., description="Average balance per vendor")


class VendorSearchResponse(BaseModel):
    """Schema for vendor search response"""
    items: list[VendorResponse] = Field(..., description="Search results")
    query: str = Field(..., description="Search query used")
    total: int = Field(..., description="Total number of results")

