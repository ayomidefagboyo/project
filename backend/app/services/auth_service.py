"""
Authentication service for handling user authentication and authorization
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.database import get_supabase_admin, Tables
from app.schemas.auth import UserRole, BusinessType
import logging

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """Authentication service class"""
    
    def __init__(self):
        self.secret_key = settings.SECRET_KEY
        self.algorithm = settings.ALGORITHM
        self.access_token_expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode a JWT token (Supabase or custom)"""
        print(f"🔍 Attempting to verify token: {token[:20]}...")

        try:
            # First try to verify as Supabase token
            print("📍 Trying Supabase token validation...")
            supabase = get_supabase_admin()
            user_response = supabase.auth.get_user(token)
            print(f"📍 Supabase response: {user_response}")

            if user_response.user:
                print(f"✅ Supabase token valid for user: {user_response.user.id}")
                # Return payload in expected format for Supabase tokens
                return {
                    "sub": user_response.user.id,
                    "email": user_response.user.email,
                    "aud": user_response.user.aud,
                }
            else:
                print("📍 Supabase validation failed, trying custom JWT...")
                # Fallback to custom JWT validation
                payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
                print(f"✅ Custom JWT valid: {payload}")
                return payload

        except Exception as e:
            print(f"❌ Token verification failed: {str(e)}")
            print(f"❌ Error type: {type(e).__name__}")
            import traceback
            print(f"❌ Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    async def create_owner_account(self, signup_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new owner account with outlet"""
        supabase = get_supabase_admin()
        
        try:
            # Create auth user
            auth_response = supabase.auth.admin.create_user({
                "email": signup_data["email"],
                "password": signup_data["password"],
                "email_confirm": True  # Auto-confirm for development
            })
            
            if auth_response.user is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create user account"
                )
            
            user = auth_response.user
            
            # Create outlet
            outlet_data = {
                "name": signup_data["company_name"],
                "business_type": signup_data.get("business_type", "retail"),
                "status": "active",
                "address": signup_data.get("address", {}),
                "phone": signup_data.get("phone", ""),
                "email": signup_data["email"],
                "opening_hours": self._get_default_opening_hours(signup_data.get("business_type", "retail")),
                "tax_rate": 8.25,
                "currency": "USD",
                "timezone": "America/New_York"
            }
            
            outlet_response = supabase.table(Tables.OUTLETS).insert(outlet_data).execute()
            if not outlet_response.data:
                # Clean up auth user if outlet creation fails
                supabase.auth.admin.delete_user(user.id)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create outlet"
                )
            
            outlet = outlet_response.data[0]
            
            # Create business settings
            settings_data = {
                "outlet_id": outlet["id"],
                "business_name": signup_data["company_name"],
                "business_type": signup_data.get("business_type", "retail"),
                "tax_number": f"TAX-{int(datetime.now().timestamp())}",
                "theme": "auto",
                "language": "en",
                "date_format": "MM/DD/YYYY",
                "time_format": "12h",
                "currency": "USD",
                "timezone": "America/New_York"
            }
            
            supabase.table(Tables.BUSINESS_SETTINGS).insert(settings_data).execute()
            
            # Create user profile
            user_data = {
                "id": user.id,
                "email": signup_data["email"],
                "name": signup_data["name"],
                "role": "outlet_admin",
                "outlet_id": outlet["id"],
                "permissions": self._get_default_permissions("outlet_admin"),
                "is_active": True
            }
            
            supabase.table(Tables.USERS).insert(user_data).execute()
            
            # Generate JWT token
            token_data = {
                "sub": user.id,
                "outlet_id": outlet["id"],
                "role": "outlet_admin"
            }
            access_token = self.create_access_token(token_data)
            
            return {
                "user": {
                    "id": user.id,
                    "email": signup_data["email"],
                    "name": signup_data["name"],
                    "role": "outlet_admin",
                    "outlet_id": outlet["id"],
                    "permissions": self._get_default_permissions("outlet_admin"),
                    "is_owner": True,
                    "is_active": True,
                    "created_at": datetime.now().isoformat(),
                    "last_login": None
                },
                "outlet": outlet,
                "token": {
                    "access_token": access_token,
                    "token_type": "bearer",
                    "expires_in": self.access_token_expire_minutes * 60
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating owner account: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create owner account"
            )
    
    async def authenticate_user(self, email: str, password: str) -> Dict[str, Any]:
        """Authenticate a user with email and password"""
        supabase = get_supabase_admin()
        
        try:
            # Sign in with Supabase
            auth_response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            if auth_response.user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password"
                )
            
            user = auth_response.user
            
            # Get user profile
            user_response = supabase.table(Tables.USERS).select("*").eq("id", user.id).execute()
            
            if not user_response.data:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User profile not found"
                )
            
            profile = user_response.data[0]
            
            if not profile["is_active"]:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Account is inactive"
                )
            
            # Update last login
            supabase.table(Tables.USERS).update({
                "last_login": datetime.now().isoformat()
            }).eq("id", user.id).execute()
            
            # Generate JWT token
            token_data = {
                "sub": user.id,
                "outlet_id": profile["outlet_id"],
                "role": profile["role"]
            }
            access_token = self.create_access_token(token_data)
            
            return {
                "user": {
                    "id": profile["id"],
                    "email": profile["email"],
                    "name": profile["name"],
                    "role": profile["role"],
                    "outlet_id": profile["outlet_id"],
                    "permissions": profile["permissions"] or [],
                    "is_owner": profile["role"] == "outlet_admin",
                    "is_active": profile["is_active"],
                    "created_at": profile["created_at"],
                    "last_login": datetime.now().isoformat()
                },
                "token": {
                    "access_token": access_token,
                    "token_type": "bearer",
                    "expires_in": self.access_token_expire_minutes * 60
                }
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error authenticating user: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication failed"
            )
    
    async def get_current_user(self, token: str) -> Dict[str, Any]:
        """Get current user from token"""
        payload = self.verify_token(token)
        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

        supabase = get_supabase_admin()
        user_response = supabase.table(Tables.USERS).select("*").eq("id", user_id).execute()

        if not user_response.data:
            # For OAuth users who haven't completed onboarding yet,
            # create a minimal user object from the token payload
            print(f"📍 User not found in users table, creating minimal OAuth user: {user_id}")

            return {
                "id": user_id,
                "email": payload.get("email", ""),
                "name": payload.get("name", ""),
                "role": "business_owner",  # Default role for new OAuth users
                "outlet_id": None,  # No outlet until onboarding complete
                "permissions": ["view_dashboard"],  # Minimal permissions for Stripe checkout
                "is_active": True
            }
        
        profile = user_response.data[0]
        
        return {
            "id": profile["id"],
            "email": profile["email"],
            "name": profile["name"],
            "role": profile["role"],
            "outlet_id": profile["outlet_id"],
            "permissions": profile["permissions"] or [],
            "is_owner": profile["role"] == "outlet_admin",
            "is_active": profile["is_active"],
            "created_at": profile["created_at"],
            "last_login": profile["last_login"]
        }
    
    def _get_default_opening_hours(self, business_type: str) -> Dict[str, Any]:
        """Get default opening hours based on business type"""
        hours_map = {
            "supermarket": {
                "monday": {"open": "08:00", "close": "22:00"},
                "tuesday": {"open": "08:00", "close": "22:00"},
                "wednesday": {"open": "08:00", "close": "22:00"},
                "thursday": {"open": "08:00", "close": "22:00"},
                "friday": {"open": "08:00", "close": "23:00"},
                "saturday": {"open": "09:00", "close": "23:00"},
                "sunday": {"open": "09:00", "close": "21:00"}
            },
            "restaurant": {
                "monday": {"open": "11:00", "close": "22:00"},
                "tuesday": {"open": "11:00", "close": "22:00"},
                "wednesday": {"open": "11:00", "close": "22:00"},
                "thursday": {"open": "11:00", "close": "23:00"},
                "friday": {"open": "11:00", "close": "00:00"},
                "saturday": {"open": "10:00", "close": "00:00"},
                "sunday": {"open": "10:00", "close": "22:00"}
            },
            "lounge": {
                "monday": {"open": "17:00", "close": "02:00"},
                "tuesday": {"open": "17:00", "close": "02:00"},
                "wednesday": {"open": "17:00", "close": "02:00"},
                "thursday": {"open": "17:00", "close": "02:00"},
                "friday": {"open": "17:00", "close": "03:00"},
                "saturday": {"open": "17:00", "close": "03:00"},
                "sunday": {"open": "17:00", "close": "02:00"}
            }
        }
        
        return hours_map.get(business_type, {
            "monday": {"open": "09:00", "close": "18:00"},
            "tuesday": {"open": "09:00", "close": "18:00"},
            "wednesday": {"open": "09:00", "close": "18:00"},
            "thursday": {"open": "09:00", "close": "18:00"},
            "friday": {"open": "09:00", "close": "18:00"},
            "saturday": {"open": "10:00", "close": "16:00"},
            "sunday": {"open": "10:00", "close": "16:00"}
        })
    
    def _get_default_permissions(self, role: str) -> list[str]:
        """Get default permissions based on role"""
        permissions_map = {
            "super_admin": [
                "view_dashboard", "view_sales", "create_sales", "edit_sales", "delete_sales",
                "view_inventory", "manage_inventory", "view_expenses", "manage_expenses",
                "view_reports", "generate_reports", "manage_users", "manage_outlets",
                "view_analytics", "manage_settings"
            ],
            "outlet_admin": [
                "view_dashboard", "view_sales", "create_sales", "edit_sales", "delete_sales",
                "view_inventory", "manage_inventory", "view_expenses", "manage_expenses",
                "view_reports", "generate_reports", "manage_users", "view_analytics", "manage_settings"
            ],
            "manager": [
                "view_dashboard", "view_sales", "create_sales", "edit_sales",
                "view_inventory", "view_expenses", "manage_expenses",
                "view_reports", "generate_reports", "view_analytics"
            ],
            "cashier": [
                "view_dashboard", "view_sales", "create_sales",
                "view_inventory", "view_expenses"
            ],
            "waiter": [
                "view_dashboard", "view_sales", "create_sales"
            ],
            "kitchen_staff": [
                "view_dashboard", "view_inventory"
            ],
            "inventory_staff": [
                "view_dashboard", "view_inventory", "manage_inventory"
            ],
            "accountant": [
                "view_dashboard", "view_expenses", "manage_expenses",
                "view_reports", "generate_reports", "view_analytics"
            ],
            "viewer": [
                "view_dashboard", "view_reports"
            ]
        }
        
        return permissions_map.get(role, ["view_dashboard"])


# Create service instance
auth_service = AuthService()

