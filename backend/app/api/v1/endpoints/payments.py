"""
Payment management endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional, Dict, Any, List
from app.schemas.payment import (
    PaymentCreate, PaymentUpdate, PaymentResponse, PaymentListResponse,
    PaymentQueueResponse, BulkPaymentUpdate, PaymentStatsResponse,
    PaymentSearchRequest, PaymentSearchResponse
)
from app.services.payment_service import payment_service
from app.core.security import require_auth, get_user_outlet_id, require_permissions

router = APIRouter()


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payment_data: PaymentCreate,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_payments"]))
):
    """
    Create a new payment
    
    Creates a new payment record for the current user's outlet
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        payment = await payment_service.create_payment(
            payment_data, 
            outlet_id, 
            current_user["id"]
        )
        return payment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create payment"
        )


@router.get("/", response_model=PaymentListResponse)
async def get_payments(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    search: Optional[str] = Query(None, description="Search query"),
    status: Optional[str] = Query(None, description="Filter by status"),
    vendor_id: Optional[str] = Query(None, description="Filter by vendor ID"),
    current_user: Dict[str, Any] = Depends(require_permissions(["view_payments"]))
):
    """
    Get payments with pagination and filtering
    
    Returns a paginated list of payments for the current user's outlet
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        result = await payment_service.get_payments(
            outlet_id=outlet_id,
            page=page,
            size=size,
            search=search,
            status=status,
            vendor_id=vendor_id
        )
        return PaymentListResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payments"
        )


@router.get("/queue", response_model=PaymentQueueResponse)
async def get_payment_queue(
    current_user: Dict[str, Any] = Depends(require_permissions(["view_payments"]))
):
    """
    Get payment queue with vendor grouping
    
    Returns payments grouped by vendor with urgency indicators
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        queue = await payment_service.get_payment_queue(outlet_id)
        return queue
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payment queue"
        )


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: str,
    current_user: Dict[str, Any] = Depends(require_permissions(["view_payments"]))
):
    """
    Get a specific payment by ID
    
    Returns payment details for the specified payment
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        payment = await payment_service.get_payment(payment_id, outlet_id)
        return payment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payment"
        )


@router.put("/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    payment_id: str,
    payment_data: PaymentUpdate,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_payments"]))
):
    """
    Update a payment
    
    Updates payment information for the specified payment
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        payment = await payment_service.update_payment(payment_id, payment_data, outlet_id)
        return payment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update payment"
        )


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    payment_id: str,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_payments"]))
):
    """
    Delete a payment
    
    Permanently deletes the specified payment
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        await payment_service.delete_payment(payment_id, outlet_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete payment"
        )


@router.post("/bulk-update", response_model=List[PaymentResponse])
async def bulk_update_payments(
    bulk_data: BulkPaymentUpdate,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_payments"]))
):
    """
    Update multiple payments in bulk
    
    Updates multiple payments with the same status and details
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        updated_payments = await payment_service.bulk_update_payments(
            bulk_data, outlet_id, current_user["id"]
        )
        return updated_payments
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to bulk update payments"
        )


@router.post("/search", response_model=PaymentSearchResponse)
async def search_payments(
    search_request: PaymentSearchRequest,
    current_user: Dict[str, Any] = Depends(require_permissions(["view_payments"]))
):
    """
    Search payments
    
    Performs a text search across payment fields with additional filters
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        result = await payment_service.search_payments(search_request, outlet_id)
        return PaymentSearchResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search payments"
        )


@router.get("/stats/overview", response_model=PaymentStatsResponse)
async def get_payment_stats(
    current_user: Dict[str, Any] = Depends(require_permissions(["view_payments"]))
):
    """
    Get payment statistics
    
    Returns overview statistics for payments in the current outlet
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        stats = await payment_service.get_payment_stats(outlet_id)
        return stats
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get payment statistics"
        )


@router.patch("/{payment_id}/mark-paid")
async def mark_payment_as_paid(
    payment_id: str,
    payment_method: Optional[str] = None,
    bank_reference: Optional[str] = None,
    notes: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_payments"]))
):
    """
    Mark a payment as paid
    
    Updates payment status to paid with payment details
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        
        update_data = PaymentUpdate(
            status="paid",
            payment_method=payment_method,
            bank_reference=bank_reference,
            notes=notes,
            paid_by=current_user["id"]
        )
        
        payment = await payment_service.update_payment(payment_id, update_data, outlet_id)
        return payment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark payment as paid"
        )


@router.patch("/{payment_id}/confirm")
async def confirm_payment(
    payment_id: str,
    notes: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_payments"]))
):
    """
    Confirm a payment
    
    Confirms a payment that was marked as paid
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        
        update_data = PaymentUpdate(
            confirmed_by=current_user["id"],
            notes=notes
        )
        
        payment = await payment_service.update_payment(payment_id, update_data, outlet_id)
        return payment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to confirm payment"
        )















