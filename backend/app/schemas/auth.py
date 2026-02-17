"""
Pydantic schemas for authentication-related data validation
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    """User role enumeration"""
    SUPER_ADMIN = "super_admin"
    OUTLET_ADMIN = "outlet_admin"
    OUTLET_STAFF = "outlet_staff"
    BUSINESS_OWNER = "business_owner"
    MANAGER = "manager"
    CASHIER = "cashier"
    WAITER = "waiter"
    KITCHEN_STAFF = "kitchen_staff"
    INVENTORY_STAFF = "inventory_staff"
    PHARMACIST = "pharmacist"
    # Legacy alias retained for backward compatibility
    ACCOUNTANT = "accountant"
    VIEWER = "viewer"


class BusinessType(str, Enum):
    """Business type enumeration"""
    SUPERMARKET = "supermarket"
    RESTAURANT = "restaurant"
    LOUNGE = "lounge"
    RETAIL = "retail"
    CAFE = "cafe"


class OwnerSignupRequest(BaseModel):
    """Schema for owner signup request"""
    email: EmailStr = Field(..., description="Owner email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password")
    name: str = Field(..., min_length=1, max_length=255, description="Owner full name")
    company_name: str = Field(..., min_length=1, max_length=255, description="Company name")
    business_type: Optional[BusinessType] = Field(BusinessType.RETAIL, description="Business type")
    phone: Optional[str] = Field(None, max_length=50, description="Phone number")
    address: Optional[Dict[str, Any]] = Field(None, description="Business address")

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()

    @validator('company_name')
    def validate_company_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Company name cannot be empty')
        return v.strip()


class SigninRequest(BaseModel):
    """Schema for user signin request"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=1, description="User password")


class TokenResponse(BaseModel):
    """Schema for token response"""
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration time in seconds")


class UserResponse(BaseModel):
    """Schema for user response"""
    id: str = Field(..., description="User unique identifier")
    email: str = Field(..., description="User email address")
    name: str = Field(..., description="User full name")
    role: UserRole = Field(..., description="User role")
    outlet_id: str = Field(..., description="Outlet identifier")
    permissions: List[str] = Field(..., description="User permissions")
    is_owner: bool = Field(..., description="Whether user is outlet owner")
    is_active: bool = Field(..., description="Whether user account is active")
    created_at: datetime = Field(..., description="Account creation timestamp")
    last_login: Optional[datetime] = Field(None, description="Last login timestamp")

    class Config:
        from_attributes = True


class OutletResponse(BaseModel):
    """Schema for outlet response"""
    id: str = Field(..., description="Outlet unique identifier")
    name: str = Field(..., description="Outlet name")
    business_type: BusinessType = Field(..., description="Business type")
    status: str = Field(..., description="Outlet status")
    address: Dict[str, Any] = Field(..., description="Outlet address")
    phone: str = Field(..., description="Outlet phone number")
    email: str = Field(..., description="Outlet email address")
    opening_hours: Dict[str, Any] = Field(..., description="Opening hours")
    tax_rate: float = Field(..., description="Tax rate")
    currency: str = Field(..., description="Currency code")
    timezone: str = Field(..., description="Timezone")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class SignupResponse(BaseModel):
    """Schema for signup response"""
    user: UserResponse = Field(..., description="Created user information")
    outlet: OutletResponse = Field(..., description="Created outlet information")
    token: TokenResponse = Field(..., description="Authentication token")


class SigninResponse(BaseModel):
    """Schema for signin response"""
    user: UserResponse = Field(..., description="User information")
    token: TokenResponse = Field(..., description="Authentication token")


class RefreshTokenRequest(BaseModel):
    """Schema for token refresh request"""
    refresh_token: str = Field(..., description="Refresh token")


class PasswordResetRequest(BaseModel):
    """Schema for password reset request"""
    email: EmailStr = Field(..., description="User email address")


class PasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation"""
    token: str = Field(..., description="Reset token")
    new_password: str = Field(..., min_length=8, max_length=128, description="New password")

    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class ChangePasswordRequest(BaseModel):
    """Schema for change password request"""
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, max_length=128, description="New password")

    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class UserProfileUpdate(BaseModel):
    """Schema for user profile update"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="User full name")
    phone: Optional[str] = Field(None, max_length=50, description="Phone number")

    @validator('name')
    def validate_name(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Name cannot be empty')
        return v.strip() if v else None


class InviteRequest(BaseModel):
    """Schema for user invitation request"""
    email: EmailStr = Field(..., description="Email address to invite")
    name: str = Field(..., min_length=1, max_length=255, description="Full name of the invitee")
    role: UserRole = Field(..., description="Role to assign to the invited user")
    outletId: str = Field(..., description="Outlet ID to associate with the user")

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()


class InviteResponse(BaseModel):
    """Schema for invitation response"""
    success: bool = Field(..., description="Whether the invitation was sent successfully")
    invite_id: Optional[str] = Field(None, description="Invitation ID for tracking")
    message: str = Field(..., description="Success or error message")


class AcceptInviteRequest(BaseModel):
    """Schema for accepting an invitation"""
    invite_id: str = Field(..., description="Invitation ID")
    password: str = Field(..., min_length=8, max_length=128, description="New user password")

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v
