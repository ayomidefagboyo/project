"""
Outlet management endpoints
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, status

from app.core.database import Tables, get_supabase_admin
from app.core.security import require_auth

router = APIRouter()

MANAGER_LEVEL_ROLES = {"super_admin", "business_owner", "outlet_admin", "manager"}

DEFAULT_OPENING_HOURS = {
    "monday": {"open": "09:00", "close": "17:00", "isOpen": True},
    "tuesday": {"open": "09:00", "close": "17:00", "isOpen": True},
    "wednesday": {"open": "09:00", "close": "17:00", "isOpen": True},
    "thursday": {"open": "09:00", "close": "17:00", "isOpen": True},
    "friday": {"open": "09:00", "close": "17:00", "isOpen": True},
    "saturday": {"open": "09:00", "close": "17:00", "isOpen": True},
    "sunday": {"open": "09:00", "close": "17:00", "isOpen": False},
}

ALLOWED_BUSINESS_TYPES = {"supermarket", "restaurant", "lounge", "retail", "cafe"}


def _normalize_role(role: Any) -> str:
    return str(role or "").strip().lower()


def _normalize_text(value: Any, fallback: str = "") -> str:
    if isinstance(value, str):
        trimmed = value.strip()
        if trimmed:
            return trimmed
    return fallback


def _normalize_address(raw_address: Any) -> Dict[str, str]:
    if isinstance(raw_address, str):
        city = raw_address.strip()
        return {
            "street": "",
            "city": city,
            "state": "",
            "zip": "",
            "country": "",
        }

    if isinstance(raw_address, dict):
        return {
            "street": _normalize_text(raw_address.get("street"), ""),
            "city": _normalize_text(raw_address.get("city"), ""),
            "state": _normalize_text(raw_address.get("state"), ""),
            "zip": _normalize_text(raw_address.get("zip") or raw_address.get("zipCode"), ""),
            "country": _normalize_text(raw_address.get("country"), ""),
        }

    return {
        "street": "",
        "city": "",
        "state": "",
        "zip": "",
        "country": "",
    }


def _ensure_manager_role(current_user: Dict[str, Any]) -> str:
    role = _normalize_role(current_user.get("role"))
    if role not in MANAGER_LEVEL_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager authorization required for outlet management",
        )
    return role


def _normalize_outlet_payload(payload: Dict[str, Any], current_user: Dict[str, Any], role: str) -> Dict[str, Any]:
    business_type = _normalize_text(payload.get("business_type") or payload.get("businessType"), "retail").lower()
    if business_type not in ALLOWED_BUSINESS_TYPES:
        business_type = "retail"

    user_email = _normalize_text(current_user.get("email"), "")
    requested_email = _normalize_text(payload.get("email"), "")
    email = user_email if role != "super_admin" and user_email else (requested_email or user_email or "not-provided@compazz.app")

    timezone = _normalize_text(payload.get("timezone"), "UTC")
    status_value = _normalize_text(payload.get("status"), "active").lower()
    if status_value not in {"active", "inactive", "maintenance", "closed"}:
        status_value = "active"

    opening_hours = payload.get("opening_hours") or payload.get("openingHours")
    if not isinstance(opening_hours, dict):
        opening_hours = DEFAULT_OPENING_HOURS

    normalized: Dict[str, Any] = {
        "name": _normalize_text(payload.get("name"), "New Outlet"),
        "business_type": business_type,
        "status": status_value,
        "address": _normalize_address(payload.get("address")),
        "phone": _normalize_text(payload.get("phone"), "Not provided"),
        "email": email,
        "opening_hours": opening_hours,
        "tax_rate": 0,
        "currency": _normalize_text(payload.get("currency"), "NGN"),
        "timezone": timezone,
    }

    tax_rate = payload.get("tax_rate") if "tax_rate" in payload else payload.get("taxRate")
    if isinstance(tax_rate, (int, float)):
        normalized["tax_rate"] = float(tax_rate)

    return normalized


def _merge_unique_outlets(primary: List[Dict[str, Any]], secondary: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}
    for row in primary:
        outlet_id = row.get("id")
        if outlet_id:
            merged[outlet_id] = row
    for row in (secondary or []):
        outlet_id = row.get("id")
        if outlet_id and outlet_id not in merged:
            merged[outlet_id] = row

    ordered = list(merged.values())
    ordered.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return ordered


@router.get("/")
async def get_outlets(current_user: Dict[str, Any] = Depends(require_auth())):
    """Get outlets visible to the current manager-level account."""
    role = _ensure_manager_role(current_user)
    supabase = get_supabase_admin()

    try:
        if role == "super_admin":
            result = supabase.table(Tables.OUTLETS).select("*").order("created_at", desc=True).execute()
            return result.data or []

        email = _normalize_text(current_user.get("email"), "")
        outlet_id = _normalize_text(current_user.get("outlet_id"), "")

        outlets_by_email: List[Dict[str, Any]] = []
        if email:
            email_result = supabase.table(Tables.OUTLETS).select("*").eq("email", email).execute()
            outlets_by_email = email_result.data or []

        outlets_by_assignment: List[Dict[str, Any]] = []
        if outlet_id:
            assigned_result = supabase.table(Tables.OUTLETS).select("*").eq("id", outlet_id).execute()
            outlets_by_assignment = assigned_result.data or []

        return _merge_unique_outlets(outlets_by_email, outlets_by_assignment)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch outlets: {str(exc)}",
        )


@router.post("/")
async def create_outlet(
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_auth()),
):
    """Create a new outlet for manager-level accounts."""
    role = _ensure_manager_role(current_user)
    supabase = get_supabase_admin()

    try:
        normalized_payload = _normalize_outlet_payload(payload, current_user, role)
        insert_result = supabase.table(Tables.OUTLETS).insert(normalized_payload).execute()

        if not insert_result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create outlet",
            )

        created = insert_result.data[0]

        # If user has no default outlet yet, set this one.
        if not current_user.get("outlet_id") and current_user.get("id"):
            supabase.table(Tables.USERS).update(
                {"outlet_id": created.get("id"), "updated_at": datetime.utcnow().isoformat()}
            ).eq("id", current_user["id"]).execute()

        return created
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create outlet: {str(exc)}",
        )


@router.get("/{outlet_id}")
async def get_outlet(outlet_id: str, current_user: Dict[str, Any] = Depends(require_auth())):
    """Get specific outlet."""
    _ensure_manager_role(current_user)
    supabase = get_supabase_admin()

    result = supabase.table(Tables.OUTLETS).select("*").eq("id", outlet_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outlet not found")
    return result.data[0]


@router.put("/{outlet_id}")
async def update_outlet(
    outlet_id: str,
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_auth()),
):
    """Update outlet fields."""
    _ensure_manager_role(current_user)
    supabase = get_supabase_admin()

    allowed_fields = {"name", "address", "phone", "email", "currency", "timezone", "status", "business_type", "tax_rate"}
    update_data: Dict[str, Any] = {}
    for key in allowed_fields:
        if key in payload:
            update_data[key] = payload[key]

    if "businessType" in payload and "business_type" not in update_data:
        update_data["business_type"] = payload["businessType"]
    if "taxRate" in payload and "tax_rate" not in update_data:
        update_data["tax_rate"] = payload["taxRate"]

    if "address" in update_data:
        update_data["address"] = _normalize_address(update_data["address"])

    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid fields to update")

    update_data["updated_at"] = datetime.utcnow().isoformat()
    result = supabase.table(Tables.OUTLETS).update(update_data).eq("id", outlet_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outlet not found")

    return result.data[0]

