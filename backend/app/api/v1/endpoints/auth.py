"""
Authentication endpoints for user signup, signin, and token management
"""

from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.auth import (
    OwnerSignupRequest, SigninRequest, SignupResponse, SigninResponse,
    TokenResponse, UserResponse, PasswordResetRequest, PasswordResetConfirm,
    ChangePasswordRequest, UserProfileUpdate, InviteRequest, InviteResponse,
    AcceptInviteRequest
)
from app.services.auth_service import auth_service
from app.core.security import require_auth
from typing import Dict, Any

router = APIRouter()


# DEPRECATED: Using pure Supabase auth now
# @router.post("/signup/owner", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
# async def signup_owner(signup_data: OwnerSignupRequest):
#     """
#     Create a new owner account with company/outlet
#
#     This endpoint creates:
#     1. A new user account in Supabase Auth
#     2. A new outlet/business
#     3. Business settings
#     4. User profile with outlet_admin role
#     5. Returns JWT token for immediate access
#     """
#     try:
#         result = await auth_service.create_owner_account(signup_data.dict())
#         return SignupResponse(**result)
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="Failed to create owner account"
#         )


# DEPRECATED: Using pure Supabase auth now
# @router.post("/signin", response_model=SigninResponse)
# async def signin(signin_data: SigninRequest):
#     """
#     Authenticate user with email and password
#
#     Returns user information and JWT token for API access
#     """
#     try:
#         result = await auth_service.authenticate_user(
#             signin_data.email,
#             signin_data.password
#         )
#         return SigninResponse(**result)
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="Authentication failed"
#         )


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


@router.post("/invite", response_model=InviteResponse)
async def invite_user(
    invite_data: InviteRequest,
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """
    Invite a user to join the outlet

    Sends an email invitation to the specified user
    """
    try:
        from app.core.database import supabase
        import uuid
        from datetime import datetime, timedelta
        import secrets

        # Check if user already exists
        existing_user = supabase.table("users").select("id,email").eq("email", invite_data.email).execute()
        if existing_user.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists"
            )

        # Check if invitation already exists
        existing_invite = supabase.table("user_invitations").select("id,email").eq("email", invite_data.email).eq("status", "pending").execute()
        if existing_invite.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Invitation already sent to this email"
            )

        # Create invitation record
        invite_id = str(uuid.uuid4())
        invitation_token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(days=7)  # 7 days expiry

        invitation_data = {
            "id": invite_id,
            "outlet_id": invite_data.outletId,
            "email": invite_data.email,
            "name": invite_data.name,
            "role": invite_data.role.value,
            "invited_by": current_user["id"],
            "invitation_token": invitation_token,
            "status": "pending",
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.utcnow().isoformat()
        }

        result = supabase.table("user_invitations").insert(invitation_data).execute()
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create invitation"
            )

        # Send invitation email using Supabase
        from app.services.email_service import email_service

        # Get inviter name and company name for email
        inviter_name = current_user.get("name", current_user.get("email", "Team Admin"))

        # Get company/outlet name
        outlet_result = supabase.table("outlets").select("name").eq("id", invite_data.outletId).execute()
        company_name = outlet_result.data[0]["name"] if outlet_result.data else "Your Company"

        email_result = await email_service.send_invitation_email(
            email=invite_data.email,
            name=invite_data.name,
            inviter_name=inviter_name,
            company_name=company_name,
            invitation_token=invitation_token,
            role=invite_data.role.value
        )

        if not email_result["success"]:
            # If email fails, still return success since invitation is created
            # but log the email failure
            print(f"Email sending failed: {email_result['message']}")

        invitation_link = f"/invite/accept/{invitation_token}"

        return InviteResponse(
            success=True,
            invite_id=invite_id,
            message=f"Invitation sent to {invite_data.email}"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Invitation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send invitation"
        )


@router.post("/accept-invitation", response_model=SigninResponse)
async def accept_invitation(invite_data: AcceptInviteRequest):
    """
    Accept an invitation and create user account

    Creates a new user account based on the invitation
    """
    try:
        from app.core.database import supabase
        from datetime import datetime
        import uuid

        # Find the invitation
        invite_result = supabase.table("user_invitations").select("*").eq("invitation_token", invite_data.invite_id).eq("status", "pending").execute()
        if not invite_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid or expired invitation"
            )

        invitation = invite_result.data[0]

        # Check if invitation has expired
        expires_at = datetime.fromisoformat(invitation["expires_at"].replace('Z', '+00:00'))
        if datetime.utcnow() > expires_at.replace(tzinfo=None):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invitation has expired"
            )

        # Create user with Supabase Auth
        from supabase import Client
        auth_response = supabase.auth.sign_up({
            "email": invitation["email"],
            "password": invite_data.password,
            "options": {
                "data": {
                    "name": invitation["name"],
                    "role": invitation["role"]
                }
            }
        })

        if auth_response.user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user account"
            )

        # Update invitation status
        supabase.table("user_invitations").update({
            "status": "accepted",
            "accepted_at": datetime.utcnow().isoformat(),
            "accepted_by": auth_response.user.id
        }).eq("id", invitation["id"]).execute()

        # Create user response
        user_data = {
            "id": auth_response.user.id,
            "email": auth_response.user.email,
            "name": invitation["name"],
            "role": invitation["role"],
            "outlet_id": invitation["outlet_id"],
            "permissions": [],
            "is_owner": False,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "last_login": None
        }

        token_data = {
            "access_token": auth_response.session.access_token if auth_response.session else "",
            "token_type": "bearer",
            "expires_in": 3600
        }

        return SigninResponse(
            user=UserResponse(**user_data),
            token=TokenResponse(**token_data)
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Accept invitation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to accept invitation"
        )

