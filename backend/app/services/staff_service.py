"""
Staff profile management service
"""
import base64
import bcrypt
import hashlib
import hmac
import json
import secrets
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.core.database import get_supabase_admin, Tables
from app.core.config import settings
from app.schemas.pos import StaffProfileCreate, StaffProfileUpdate, StaffProfileResponse


class StaffService:
    """Service for managing staff profiles"""

    @staticmethod
    def hash_pin(pin: str) -> str:
        """Hash a PIN using bcrypt"""
        return bcrypt.hashpw(pin.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    @staticmethod
    def verify_pin(pin: str, pin_hash: str) -> bool:
        """Verify a PIN against its hash"""
        return bcrypt.checkpw(pin.encode('utf-8'), pin_hash.encode('utf-8'))

    @staticmethod
    def _encode_base64url(value: bytes) -> str:
        """Encode bytes using URL-safe base64 without padding."""
        return base64.urlsafe_b64encode(value).decode('utf-8').rstrip('=')

    @staticmethod
    def _decode_base64url(value: str) -> bytes:
        """Decode URL-safe base64 (with/without padding)."""
        padding = '=' * (-len(value) % 4)
        return base64.urlsafe_b64decode(f"{value}{padding}")

    @staticmethod
    def generate_session_token(
        profile: Optional[Dict[str, Any]] = None,
        expires_at: Optional[datetime] = None
    ) -> str:
        """
        Generate a POS staff session token.
        - If profile is provided, issue a signed token that can be verified server-side.
        - If not provided, fall back to opaque random token for backward compatibility.
        """
        if not profile:
            return secrets.token_urlsafe(32)

        expiry = expires_at or (datetime.utcnow() + timedelta(hours=8))
        payload = {
            'staff_profile_id': profile.get('id'),
            'outlet_id': profile.get('outlet_id'),
            'role': str(profile.get('role') or '').lower(),
            'parent_account_id': profile.get('parent_account_id'),
            'exp': int(expiry.timestamp()),
            'iat': int(datetime.utcnow().timestamp())
        }
        payload_json = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode('utf-8')
        payload_b64 = StaffService._encode_base64url(payload_json)
        signature = hmac.new(
            settings.SECRET_KEY.encode('utf-8'),
            payload_b64.encode('utf-8'),
            hashlib.sha256
        ).digest()
        signature_b64 = StaffService._encode_base64url(signature)
        return f"v1.{payload_b64}.{signature_b64}"

    @staticmethod
    def parse_session_token(session_token: str) -> Optional[Dict[str, Any]]:
        """Verify and parse a signed POS staff session token."""
        try:
            if not session_token:
                return None

            parts = session_token.split('.')
            if len(parts) != 3 or parts[0] != 'v1':
                return None

            payload_b64 = parts[1]
            provided_signature_b64 = parts[2]
            expected_signature = hmac.new(
                settings.SECRET_KEY.encode('utf-8'),
                payload_b64.encode('utf-8'),
                hashlib.sha256
            ).digest()
            expected_signature_b64 = StaffService._encode_base64url(expected_signature)

            if not hmac.compare_digest(provided_signature_b64, expected_signature_b64):
                return None

            payload_raw = StaffService._decode_base64url(payload_b64)
            payload = json.loads(payload_raw.decode('utf-8'))

            exp = int(payload.get('exp', 0))
            if exp <= int(datetime.utcnow().timestamp()):
                return None

            return payload
        except Exception:
            return None

    @staticmethod
    async def generate_staff_code(outlet_id: str) -> str:
        """Generate a unique staff code for the outlet"""
        supabase = get_supabase_admin()

        try:
            # Call the database function
            response = supabase.rpc('generate_staff_code', {'outlet_id_param': outlet_id}).execute()

            if response.data:
                return response.data
            else:
                # Fallback to simple generation
                count_response = supabase.table(Tables.STAFF_PROFILES)\
                    .select('id', count='exact')\
                    .eq('outlet_id', outlet_id)\
                    .execute()

                count = count_response.count or 0
                return f"STF{str(count + 1).zfill(3)}"

        except Exception as e:
            print(f"Error generating staff code: {e}")
            # Fallback to timestamp-based code
            import time
            return f"STF{str(int(time.time()))[-3:]}"

    @staticmethod
    async def create_staff_profile(
        parent_account_id: str,
        staff_data: StaffProfileCreate
    ) -> StaffProfileResponse:
        """Create a new staff profile"""
        supabase = get_supabase_admin()

        # Generate unique staff code
        staff_code = await StaffService.generate_staff_code(staff_data.outlet_id)

        # Hash the PIN
        pin_hash = StaffService.hash_pin(staff_data.pin)

        # Create staff profile
        profile_data = {
            'parent_account_id': parent_account_id,
            'staff_code': staff_code,
            'pin_hash': pin_hash,
            'display_name': staff_data.display_name,
            'role': staff_data.role,
            'permissions': staff_data.permissions or [],
            'outlet_id': staff_data.outlet_id,
            'is_active': True,
            'failed_login_attempts': 0,
            'created_by': parent_account_id
        }

        try:
            response = supabase.table(Tables.STAFF_PROFILES)\
                .insert(profile_data)\
                .execute()

            if response.data and len(response.data) > 0:
                # Fetch the created profile
                created_profile = supabase.table(Tables.STAFF_PROFILES)\
                    .select('*')\
                    .eq('staff_code', staff_code)\
                    .single()\
                    .execute()

                if created_profile.data:
                    return StaffProfileResponse(**created_profile.data)
                else:
                    raise Exception("Failed to fetch created staff profile")
            else:
                raise Exception(f"Failed to create staff profile: {response}")
        except Exception as e:
            raise Exception(f"Failed to create staff profile: {str(e)}")

    @staticmethod
    async def get_staff_profiles(
        parent_account_id: str,
        outlet_id: Optional[str] = None,
        active_only: bool = True
    ) -> List[StaffProfileResponse]:
        """Get staff profiles for a parent account"""
        supabase = get_supabase_admin()

        query = supabase.table(Tables.STAFF_PROFILES)\
            .select('*')\
            .eq('parent_account_id', parent_account_id)

        if outlet_id:
            query = query.eq('outlet_id', outlet_id)

        if active_only:
            query = query.eq('is_active', True)

        response = query.order('created_at', desc=True).execute()

        if response.data:
            return [StaffProfileResponse(**profile) for profile in response.data]
        return []

    @staticmethod
    async def get_staff_profile(profile_id: str) -> Optional[StaffProfileResponse]:
        """Get a single staff profile by ID"""
        supabase = get_supabase_admin()

        response = supabase.table(Tables.STAFF_PROFILES)\
            .select('*')\
            .eq('id', profile_id)\
            .single()\
            .execute()

        if response.data:
            return StaffProfileResponse(**response.data)
        return None

    @staticmethod
    def get_staff_profile_by_code(staff_code: str, outlet_id: str) -> Optional[Dict[str, Any]]:
        """Get staff profile by staff code and outlet"""
        supabase = get_supabase_admin()

        response = supabase.table(Tables.STAFF_PROFILES)\
            .select('*')\
            .eq('staff_code', staff_code)\
            .eq('outlet_id', outlet_id)\
            .eq('is_active', True)\
            .single()\
            .execute()

        return response.data if response.data else None

    @staticmethod
    async def update_staff_profile(
        profile_id: str,
        update_data: StaffProfileUpdate
    ) -> Optional[StaffProfileResponse]:
        """Update a staff profile"""
        supabase = get_supabase_admin()

        # Prepare update data
        update_dict = {}

        if update_data.display_name is not None:
            update_dict['display_name'] = update_data.display_name

        if update_data.pin is not None:
            update_dict['pin_hash'] = StaffService.hash_pin(update_data.pin)
            update_dict['failed_login_attempts'] = 0  # Reset failed attempts on PIN change

        if update_data.role is not None:
            update_dict['role'] = update_data.role

        if update_data.permissions is not None:
            update_dict['permissions'] = update_data.permissions

        if update_data.is_active is not None:
            update_dict['is_active'] = update_data.is_active

        if not update_dict:
            # No updates to make
            return await StaffService.get_staff_profile(profile_id)

        # Supabase Python client compatibility: update builders do not support
        # chaining .select() after .eq() in all versions.
        response = supabase.table(Tables.STAFF_PROFILES)\
            .update(update_dict)\
            .eq('id', profile_id)\
            .execute()

        if not response.data:
            return None

        # Re-fetch updated row for a stable response payload.
        return await StaffService.get_staff_profile(profile_id)

    @staticmethod
    async def delete_staff_profile(profile_id: str) -> bool:
        """Delete a staff profile"""
        supabase = get_supabase_admin()

        # Soft delete by marking as inactive
        response = supabase.table(Tables.STAFF_PROFILES)\
            .update({'is_active': False})\
            .eq('id', profile_id)\
            .execute()

        return response.data is not None

    @staticmethod
    async def authenticate_staff(staff_code: str, pin: str, outlet_id: str) -> Optional[Dict[str, Any]]:
        """Authenticate staff with PIN"""
        supabase = get_supabase_admin()

        # Get staff profile
        profile = StaffService.get_staff_profile_by_code(staff_code, outlet_id)
        if not profile:
            return None

        # Check if account is locked (too many failed attempts)
        if profile.get('failed_login_attempts', 0) >= 5:
            return None

        # Verify PIN
        if not StaffService.verify_pin(pin, profile['pin_hash']):
            # Increment failed attempts
            supabase.table(Tables.STAFF_PROFILES)\
                .update({'failed_login_attempts': profile.get('failed_login_attempts', 0) + 1})\
                .eq('id', profile['id'])\
                .execute()
            return None

        # Successful authentication - reset failed attempts and update last login
        supabase.table(Tables.STAFF_PROFILES)\
            .update({
                'failed_login_attempts': 0,
                'last_login': datetime.utcnow().isoformat()
            })\
            .eq('id', profile['id'])\
            .execute()

        # Generate signed session token (8-hour expiry)
        expires_at = datetime.utcnow() + timedelta(hours=8)
        session_token = StaffService.generate_session_token(profile, expires_at)

        return {
            'profile': profile,
            'session_token': session_token,
            'expires_at': expires_at
        }

    @staticmethod
    async def reset_failed_attempts(profile_id: str) -> bool:
        """Reset failed login attempts for a staff profile"""
        supabase = get_supabase_admin()

        response = supabase.table(Tables.STAFF_PROFILES)\
            .update({'failed_login_attempts': 0})\
            .eq('id', profile_id)\
            .execute()

        return response.data is not None

    @staticmethod
    async def get_staff_by_outlet(outlet_id: str) -> List[StaffProfileResponse]:
        """Get all active staff for an outlet"""
        supabase = get_supabase_admin()

        response = supabase.table(Tables.STAFF_PROFILES)\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .eq('is_active', True)\
            .order('display_name')\
            .execute()

        if response.data:
            return [StaffProfileResponse(**profile) for profile in response.data]
        return []
