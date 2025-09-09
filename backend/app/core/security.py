"""
Security utilities and middleware for authentication and authorization
"""

from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
from app.services.auth_service import auth_service
import logging

logger = logging.getLogger(__name__)

# HTTP Bearer token scheme
security = HTTPBearer()


class CurrentUser:
    """Dependency class for getting current user"""
    
    def __init__(self, required_permissions: Optional[list[str]] = None):
        self.required_permissions = required_permissions or []
    
    async def __call__(self, credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
        """Get current user from JWT token"""
        try:
            # Extract token
            token = credentials.credentials
            
            # Get user from token
            user = await auth_service.get_current_user(token)
            
            # Check if user is active
            if not user.get("is_active", False):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Account is inactive"
                )
            
            # Check permissions if required
            if self.required_permissions:
                user_permissions = user.get("permissions", [])
                if not any(perm in user_permissions for perm in self.required_permissions):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Insufficient permissions"
                    )
            
            return user
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in authentication: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )


# Common permission dependencies
def require_auth():
    """Require authentication only"""
    return CurrentUser()


def require_permissions(permissions: list[str]):
    """Require specific permissions"""
    return CurrentUser(required_permissions=permissions)


def require_admin():
    """Require admin role"""
    return CurrentUser(required_permissions=["manage_users"])


def require_outlet_access():
    """Require outlet access permissions"""
    return CurrentUser(required_permissions=["view_dashboard"])


# Role-based dependencies
def require_super_admin():
    """Require super admin role"""
    async def check_super_admin(user: Dict[str, Any] = Depends(require_auth())):
        if user.get("role") != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Super admin access required"
            )
        return user
    return check_super_admin


def require_outlet_admin():
    """Require outlet admin or super admin role"""
    async def check_outlet_admin(user: Dict[str, Any] = Depends(require_auth())):
        role = user.get("role")
        if role not in ["super_admin", "outlet_admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Outlet admin access required"
            )
        return user
    return check_outlet_admin


def require_manager_or_above():
    """Require manager role or above"""
    async def check_manager(user: Dict[str, Any] = Depends(require_auth())):
        role = user.get("role")
        allowed_roles = ["super_admin", "outlet_admin", "manager"]
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Manager access or above required"
            )
        return user
    return check_manager


# Utility functions
def get_user_outlet_id(user: Dict[str, Any]) -> str:
    """Extract outlet ID from user data"""
    outlet_id = user.get("outlet_id")
    if not outlet_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User outlet not found"
        )
    return outlet_id


def check_outlet_access(user: Dict[str, Any], outlet_id: str) -> bool:
    """Check if user has access to specific outlet"""
    user_role = user.get("role")
    user_outlet_id = user.get("outlet_id")
    
    # Super admin can access all outlets
    if user_role == "super_admin":
        return True
    
    # Other users can only access their own outlet
    return user_outlet_id == outlet_id


def require_outlet_access_for_outlet(outlet_id: str):
    """Require access to specific outlet"""
    async def check_outlet_access(user: Dict[str, Any] = Depends(require_auth())):
        if not check_outlet_access(user, outlet_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this outlet"
            )
        return user
    return check_outlet_access

