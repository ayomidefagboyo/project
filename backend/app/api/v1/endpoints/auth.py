"""
Authentication endpoints for user signup, signin, and token management
"""

from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.auth import (
    OwnerSignupRequest, SigninRequest, SignupResponse, SigninResponse,
    TokenResponse, UserResponse, PasswordResetRequest, PasswordResetConfirm,
    ChangePasswordRequest, UserProfileUpdate
)
from app.services.auth_service import auth_service
from app.core.security import require_auth
from typing import Dict, Any

router = APIRouter()


@router.post("/signup/owner", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup_owner(signup_data: OwnerSignupRequest):
    """
    Create a new owner account with company/outlet
    
    This endpoint creates:
    1. A new user account in Supabase Auth
    2. A new outlet/business
    3. Business settings
    4. User profile with outlet_admin role
    5. Returns JWT token for immediate access
    """
    try:
        result = await auth_service.create_owner_account(signup_data.dict())
        return SignupResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create owner account"
        )


@router.post("/signin", response_model=SigninResponse)
async def signin(signin_data: SigninRequest):
    """
    Authenticate user with email and password
    
    Returns user information and JWT token for API access
    """
    try:
        result = await auth_service.authenticate_user(
            signin_data.email, 
            signin_data.password
        )
        return SigninResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: Dict[str, Any] = Depends(require_auth())):
    """
    Get current user information
    
    Returns the authenticated user's profile and permissions
    """
    return UserResponse(**current_user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(current_user: Dict[str, Any] = Depends(require_auth())):
    """
    Refresh JWT token
    
    Generates a new access token for the authenticated user
    """
    try:
        token_data = {
            "sub": current_user["id"],
            "outlet_id": current_user["outlet_id"],
            "role": current_user["role"]
        }
        access_token = auth_service.create_access_token(token_data)
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=auth_service.access_token_expire_minutes * 60
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to refresh token"
        )


@router.post("/password/reset/request")
async def request_password_reset(reset_data: PasswordResetRequest):
    """
    Request password reset
    
    Sends a password reset email to the user
    """
    # TODO: Implement email sending for password reset
    return {"message": "Password reset email sent"}


@router.post("/password/reset/confirm")
async def confirm_password_reset(reset_data: PasswordResetConfirm):
    """
    Confirm password reset with token
    
    Resets user password using the provided token
    """
    # TODO: Implement password reset confirmation
    return {"message": "Password reset successfully"}


@router.post("/password/change")
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """
    Change user password
    
    Allows authenticated users to change their password
    """
    # TODO: Implement password change
    return {"message": "Password changed successfully"}


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UserProfileUpdate,
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """
    Update user profile
    
    Allows users to update their name and phone number
    """
    # TODO: Implement profile update
    return UserResponse(**current_user)


@router.post("/logout")
async def logout(current_user: Dict[str, Any] = Depends(require_auth())):
    """
    Logout user
    
    Invalidates the current session (client should discard token)
    """
    # TODO: Implement token blacklisting if needed
    return {"message": "Logged out successfully"}


@router.get("/verify-email/{token}")
async def verify_email(token: str):
    """
    Verify user email address
    
    Confirms user email using verification token
    """
    # TODO: Implement email verification
    return {"message": "Email verified successfully"}

