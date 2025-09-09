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
from app.core.security import require_auth, get_user_outlet_id, require_permissions

router = APIRouter()


@router.post("/", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    vendor_data: VendorCreate,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_vendors"]))
):
    """
    Create a new vendor
    
    Creates a new vendor for the current user's outlet
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
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
    current_user: Dict[str, Any] = Depends(require_permissions(["view_vendors"]))
):
    """
    Get vendors with pagination and filtering
    
    Returns a paginated list of vendors for the current user's outlet
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
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
    current_user: Dict[str, Any] = Depends(require_permissions(["view_vendors"]))
):
    """
    Get a specific vendor by ID
    
    Returns vendor details for the specified vendor
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
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
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_vendors"]))
):
    """
    Update a vendor
    
    Updates vendor information for the specified vendor
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
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
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_vendors"]))
):
    """
    Delete a vendor
    
    Permanently deletes the specified vendor
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
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
    current_user: Dict[str, Any] = Depends(require_permissions(["view_vendors"]))
):
    """
    Search vendors
    
    Performs a text search across vendor names, emails, and contact persons
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
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
    current_user: Dict[str, Any] = Depends(require_permissions(["view_vendors"]))
):
    """
    Get vendor statistics
    
    Returns overview statistics for vendors in the current outlet
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
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
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_vendors"]))
):
    """
    Update vendor balance
    
    Updates the current balance for a vendor (used for payments, invoices, etc.)
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        vendor = await vendor_service.update_vendor_balance(vendor_id, outlet_id, amount)
        return vendor
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update vendor balance"
        )

