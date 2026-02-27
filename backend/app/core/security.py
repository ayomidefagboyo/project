"""
Security utilities and middleware for authentication and authorization.
"""

from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
from app.services.auth_service import auth_service
from app.services.staff_service import StaffService
from app.core.database import get_supabase_admin, Tables
import logging

logger = logging.getLogger(__name__)

# HTTP Bearer token scheme
security = HTTPBearer(auto_error=False)


class CurrentUser:
    """Dependency class for getting current user"""
    
    def __init__(self, required_permissions: Optional[list[str]] = None):
        self.required_permissions = required_permissions or []

    def _resolve_pos_staff_session_user(self, request: Request, session_token_hint: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Fallback authentication path for POS endpoints:
        accept signed X-POS-Staff-Session token when bearer auth is unavailable.
        """
        try:
            path = request.url.path or ""
            if not path.startswith("/api/v1/pos/"):
                return None

            session_token = (session_token_hint or request.headers.get("X-POS-Staff-Session") or "").strip()
            if not session_token:
                return None

            payload = StaffService.parse_session_token(session_token)
            if not payload:
                return None

            staff_profile_id = str(payload.get("staff_profile_id") or "").strip()
            parent_account_id = str(payload.get("parent_account_id") or "").strip()
            outlet_id = str(payload.get("outlet_id") or "").strip()
            role = str(payload.get("role") or "").strip().lower() or "cashier"
            permissions: list[str] = []
            display_name = ""

            if staff_profile_id:
                supabase = get_supabase_admin()
                profile_result = (
                    supabase.table(Tables.STAFF_PROFILES)
                    .select("id,parent_account_id,outlet_id,display_name,role,permissions,is_active")
                    .eq("id", staff_profile_id)
                    .limit(1)
                    .execute()
                )
                if profile_result.data:
                    profile = profile_result.data[0]
                    if profile.get("is_active") is False:
                        return None
                    parent_account_id = str(profile.get("parent_account_id") or parent_account_id).strip()
                    outlet_id = str(profile.get("outlet_id") or outlet_id).strip()
                    display_name = str(profile.get("display_name") or "").strip()
                    role = str(profile.get("role") or role).strip().lower() or role
                    permissions_raw = profile.get("permissions")
                    if isinstance(permissions_raw, list):
                        permissions = [str(permission) for permission in permissions_raw if isinstance(permission, str)]

            actor_id = parent_account_id or staff_profile_id
            if not actor_id:
                return None

            return {
                "id": actor_id,
                "email": "",
                "name": display_name,
                "role": role,
                "outlet_id": outlet_id or None,
                "permissions": permissions,
                "is_owner": False,
                "is_active": True,
                "staff_profile_id": staff_profile_id or None,
                "staff_profile_name": display_name or None,
                "auth_source": "staff_session",
            }
        except Exception as exc:
            logger.warning(f"Failed POS staff-session auth fallback: {exc}")
            return None

    def _resolve_staff_session_profile_context(self, request: Request) -> Optional[Dict[str, Any]]:
        """
        Resolve signed staff-session metadata (any endpoint) for actor attribution.
        This does not replace bearer auth; it only enriches identity context.
        """
        try:
            session_token = str(request.headers.get("X-POS-Staff-Session") or "").strip()
            if not session_token:
                return None

            payload = StaffService.parse_session_token(session_token)
            if not payload:
                return None

            staff_profile_id = str(payload.get("staff_profile_id") or "").strip()
            if not staff_profile_id:
                return None

            parent_account_id = str(payload.get("parent_account_id") or "").strip()
            outlet_id = str(payload.get("outlet_id") or "").strip()

            supabase = get_supabase_admin()
            profile_result = (
                supabase.table(Tables.STAFF_PROFILES)
                .select("id,parent_account_id,outlet_id,display_name,role,permissions,is_active")
                .eq("id", staff_profile_id)
                .limit(1)
                .execute()
            )
            profile = profile_result.data[0] if profile_result.data else None
            if not profile or profile.get("is_active") is False:
                return None

            resolved_parent = str(profile.get("parent_account_id") or parent_account_id).strip()
            resolved_outlet = str(profile.get("outlet_id") or outlet_id).strip()
            display_name = str(profile.get("display_name") or "").strip()
            role = str(profile.get("role") or payload.get("role") or "").strip().lower() or "cashier"
            permissions_raw = profile.get("permissions")
            permissions: list[str] = []
            if isinstance(permissions_raw, list):
                permissions = [str(permission) for permission in permissions_raw if isinstance(permission, str)]

            return {
                "staff_profile_id": staff_profile_id,
                "staff_profile_name": display_name or None,
                "parent_account_id": resolved_parent or None,
                "outlet_id": resolved_outlet or None,
                "role": role,
                "permissions": permissions,
            }
        except Exception as exc:
            logger.warning(f"Failed to resolve staff-session profile context: {exc}")
            return None

    def _enrich_authenticated_user_with_staff_context(self, request: Request, user: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enrich authenticated API user with staff actor metadata when a valid signed
        staff-session header is present and matches the authenticated account scope.
        """
        if user.get("staff_profile_id"):
            return user

        profile_context = self._resolve_staff_session_profile_context(request)
        if not profile_context:
            return user

        user_id = str(user.get("id") or "").strip()
        user_outlet_id = str(user.get("outlet_id") or "").strip()
        parent_account_id = str(profile_context.get("parent_account_id") or "").strip()
        profile_outlet_id = str(profile_context.get("outlet_id") or "").strip()

        # Prevent cross-account or cross-outlet staff identity spoofing.
        if user_id and parent_account_id and user_id != parent_account_id:
            return user
        if user_outlet_id and profile_outlet_id and user_outlet_id != profile_outlet_id:
            return user

        enriched = dict(user)
        enriched["staff_profile_id"] = profile_context.get("staff_profile_id")
        enriched["staff_profile_name"] = profile_context.get("staff_profile_name")
        enriched["staff_role"] = profile_context.get("role")
        enriched["staff_permissions"] = profile_context.get("permissions") or []

        display_name = str(profile_context.get("staff_profile_name") or "").strip()
        if display_name:
            enriched["name"] = display_name

        return enriched
    
    async def __call__(
        self,
        request: Request,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
    ) -> Dict[str, Any]:
        """Get current user from JWT token"""
        try:
            user: Optional[Dict[str, Any]] = None

            # Primary path: Supabase bearer token
            if credentials and credentials.credentials:
                token = credentials.credentials.strip()
                if token:
                    try:
                        user = await auth_service.get_current_user(token)
                    except HTTPException as auth_exc:
                        # POS fallback: allow signed staff-session token as bearer payload.
                        user = self._resolve_pos_staff_session_user(request, token)
                        if user is None:
                            raise auth_exc
                    except Exception:
                        user = self._resolve_pos_staff_session_user(request, token)
                        if user is None:
                            raise

            # Secondary path: signed X-POS-Staff-Session header (POS-only endpoints).
            if user is None:
                user = self._resolve_pos_staff_session_user(request)

            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Could not validate credentials"
                )

            # If request carries a valid POS staff session for this authenticated account,
            # attach staff actor identity so audit logs use staff profile name consistently.
            user = self._enrich_authenticated_user_with_staff_context(request, user)
            
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
