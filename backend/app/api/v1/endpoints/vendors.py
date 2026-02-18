"""
Vendor management endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional, Dict, Any
from app.schemas.vendor import (
    VendorCreate, VendorUpdate, VendorResponse, VendorListResponse,
    VendorSearchRequest, VendorSearchResponse, VendorStatsResponse
)
from app.services.vendor_service import vendor_service
from app.core.security import require_permissions
from app.core.database import get_supabase_admin, Tables

router = APIRouter()
MANAGER_LEVEL_ROLES = {"super_admin", "business_owner", "outlet_admin", "manager"}


def _normalize_role(role: Any) -> str:
    return str(role or "").strip().lower()


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _has_outlet_access(current_user: Dict[str, Any], outlet_id: str) -> bool:
    role = _normalize_role(current_user.get("role"))
    if role == "super_admin":
        return True

    user_outlet_id = _normalize_text(current_user.get("outlet_id"))
    if user_outlet_id and user_outlet_id == outlet_id:
        return True

    if role not in MANAGER_LEVEL_ROLES:
        return False

    supabase = get_supabase_admin()
    email = _normalize_text(current_user.get("email"))
    user_id = _normalize_text(current_user.get("id"))

    try:
        if email:
            owned_outlet = (
                supabase.table(Tables.OUTLETS)
                .select("id")
                .eq("id", outlet_id)
                .eq("email", email)
                .limit(1)
                .execute()
            )
            if owned_outlet.data:
                return True

        if user_id:
            staff_link = (
                supabase.table(Tables.STAFF_PROFILES)
                .select("id")
                .eq("parent_account_id", user_id)
                .eq("outlet_id", outlet_id)
                .limit(1)
                .execute()
            )
            if staff_link.data:
                return True
    except Exception:
        return False

    return False


def _resolve_outlet_id(
    current_user: Dict[str, Any],
    outlet_id_param: Optional[str],
) -> str:
    requested_outlet_id = _normalize_text(outlet_id_param)
    if requested_outlet_id:
        if not _has_outlet_access(current_user, requested_outlet_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to requested outlet",
            )
        return requested_outlet_id

    default_outlet_id = _normalize_text(current_user.get("outlet_id"))
    if default_outlet_id:
        return default_outlet_id

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No outlet specified",
    )


@router.post("/", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    vendor_data: VendorCreate,
    outlet_id: Optional[str] = Query(None, description="Outlet ID override"),
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_vendors"]))
):
    """
    Create a new vendor
    
    Creates a new vendor for the current user's outlet
    """
    try:
        outlet_id = _resolve_outlet_id(current_user, outlet_id)
        vendor = await vendor_service.create_vendor(
            vendor_data, 
            outlet_id, 
            current_user["id"]
        )
        return vendor
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create vendor"
        )


@router.get("/", response_model=VendorListResponse)
async def get_vendors(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    search: Optional[str] = Query(None, description="Search query"),
    vendor_type: Optional[str] = Query(None, description="Filter by vendor type"),
    outlet_id: Optional[str] = Query(None, description="Outlet ID override"),
    current_user: Dict[str, Any] = Depends(require_permissions(["view_vendors"]))
):
    """
    Get vendors with pagination and filtering
    
    Returns a paginated list of vendors for the current user's outlet
    """
    try:
        outlet_id = _resolve_outlet_id(current_user, outlet_id)
        result = await vendor_service.get_vendors(
            outlet_id=outlet_id,
            page=page,
            size=size,
            search=search,
            vendor_type=vendor_type
        )
        return VendorListResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get vendors"
        )


@router.get("/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: str,
    outlet_id: Optional[str] = Query(None, description="Outlet ID override"),
    current_user: Dict[str, Any] = Depends(require_permissions(["view_vendors"]))
):
    """
    Get a specific vendor by ID
    
    Returns vendor details for the specified vendor
    """
    try:
        outlet_id = _resolve_outlet_id(current_user, outlet_id)
        vendor = await vendor_service.get_vendor(vendor_id, outlet_id)
        return vendor
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get vendor"
        )


@router.put("/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: str,
    vendor_data: VendorUpdate,
    outlet_id: Optional[str] = Query(None, description="Outlet ID override"),
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_vendors"]))
):
    """
    Update a vendor
    
    Updates vendor information for the specified vendor
    """
    try:
        outlet_id = _resolve_outlet_id(current_user, outlet_id)
        vendor = await vendor_service.update_vendor(vendor_id, vendor_data, outlet_id)
        return vendor
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update vendor"
        )


@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vendor(
    vendor_id: str,
    outlet_id: Optional[str] = Query(None, description="Outlet ID override"),
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_vendors"]))
):
    """
    Delete a vendor
    
    Permanently deletes the specified vendor
    """
    try:
        outlet_id = _resolve_outlet_id(current_user, outlet_id)
        await vendor_service.delete_vendor(vendor_id, outlet_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete vendor"
        )


@router.post("/search", response_model=VendorSearchResponse)
async def search_vendors(
    search_request: VendorSearchRequest,
    outlet_id: Optional[str] = Query(None, description="Outlet ID override"),
    current_user: Dict[str, Any] = Depends(require_permissions(["view_vendors"]))
):
    """
    Search vendors
    
    Performs a text search across vendor names, emails, and contact persons
    """
    try:
        outlet_id = _resolve_outlet_id(current_user, outlet_id)
        result = await vendor_service.search_vendors(search_request, outlet_id)
        return VendorSearchResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search vendors"
        )


@router.get("/stats/overview", response_model=VendorStatsResponse)
async def get_vendor_stats(
    outlet_id: Optional[str] = Query(None, description="Outlet ID override"),
    current_user: Dict[str, Any] = Depends(require_permissions(["view_vendors"]))
):
    """
    Get vendor statistics
    
    Returns overview statistics for vendors in the current outlet
    """
    try:
        outlet_id = _resolve_outlet_id(current_user, outlet_id)
        stats = await vendor_service.get_vendor_stats(outlet_id)
        return VendorStatsResponse(**stats)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get vendor statistics"
        )


@router.patch("/{vendor_id}/balance")
async def update_vendor_balance(
    vendor_id: str,
    amount: float,
    outlet_id: Optional[str] = Query(None, description="Outlet ID override"),
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_vendors"]))
):
    """
    Update vendor balance
    
    Updates the current balance for a vendor (used for payments, invoices, etc.)
    """
    try:
        outlet_id = _resolve_outlet_id(current_user, outlet_id)
        vendor = await vendor_service.update_vendor_balance(vendor_id, outlet_id, amount)
        return vendor
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update vendor balance"
        )
