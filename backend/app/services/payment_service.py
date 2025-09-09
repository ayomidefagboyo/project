"""
Payment service for handling payment-related business logic
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from app.core.database import get_supabase_admin, Tables
from app.schemas.payment import (
    PaymentCreate, PaymentUpdate, PaymentResponse, PaymentListResponse,
    PaymentQueueResponse, GroupedPayments, PaymentQueueItem, BulkPaymentUpdate,
    PaymentStatsResponse, PaymentSearchRequest, PaymentSearchResponse
)
import logging

logger = logging.getLogger(__name__)


class PaymentService:
    """Payment service class"""
    
    def __init__(self):
        self._supabase = None
    
    @property
    def supabase(self):
        if self._supabase is None:
            self._supabase = get_supabase_admin()
        return self._supabase
    
    async def create_payment(self, payment_data: PaymentCreate, outlet_id: str, user_id: str) -> PaymentResponse:
        """Create a new payment"""
        try:
            # Prepare payment data
            payment_dict = payment_data.dict()
            payment_dict.update({
                "outlet_id": outlet_id,
                "created_by": user_id
            })
            
            # Insert payment
            response = self.supabase.table(Tables.PAYMENTS).insert(payment_dict).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create payment"
                )
            
            payment = response.data[0]
            return PaymentResponse(**payment)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating payment: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create payment"
            )
    
    async def get_payments(
        self, 
        outlet_id: str, 
        page: int = 1, 
        size: int = 20,
        search: Optional[str] = None,
        status: Optional[str] = None,
        vendor_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get payments with pagination and filtering"""
        try:
            # Build query
            query = self.supabase.table(Tables.PAYMENTS).select("*", count="exact")
            query = query.eq("outlet_id", outlet_id)
            
            # Apply search filter
            if search:
                query = query.or_(f"bank_reference.ilike.%{search}%,notes.ilike.%{search}%")
            
            # Apply status filter
            if status:
                query = query.eq("status", status)
            
            # Apply vendor filter
            if vendor_id:
                query = query.eq("vendor_id", vendor_id)
            
            # Apply pagination
            offset = (page - 1) * size
            query = query.range(offset, offset + size - 1)
            
            # Execute query
            response = query.execute()
            
            payments = [PaymentResponse(**payment) for payment in response.data]
            total = response.count or 0
            pages = (total + size - 1) // size
            
            return {
                "items": payments,
                "total": total,
                "page": page,
                "size": size,
                "pages": pages
            }
            
        except Exception as e:
            logger.error(f"Error getting payments: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get payments"
            )
    
    async def get_payment(self, payment_id: str, outlet_id: str) -> PaymentResponse:
        """Get a specific payment"""
        try:
            response = self.supabase.table(Tables.PAYMENTS).select("*").eq("id", payment_id).eq("outlet_id", outlet_id).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Payment not found"
                )
            
            payment = response.data[0]
            return PaymentResponse(**payment)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting payment: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get payment"
            )
    
    async def update_payment(self, payment_id: str, payment_data: PaymentUpdate, outlet_id: str) -> PaymentResponse:
        """Update a payment"""
        try:
            # Check if payment exists
            existing = await self.get_payment(payment_id, outlet_id)
            
            # Prepare update data (only include non-None values)
            update_dict = {k: v for k, v in payment_data.dict().items() if v is not None}
            
            # Add timestamp for status changes
            if "status" in update_dict:
                if update_dict["status"] == "paid" and not existing.paid_at:
                    update_dict["paid_at"] = datetime.now().isoformat()
                if "confirmed_by" in update_dict and not existing.confirmed_at:
                    update_dict["confirmed_at"] = datetime.now().isoformat()
            
            if not update_dict:
                return existing
            
            # Update payment
            response = self.supabase.table(Tables.PAYMENTS).update(update_dict).eq("id", payment_id).eq("outlet_id", outlet_id).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update payment"
                )
            
            payment = response.data[0]
            return PaymentResponse(**payment)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating payment: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update payment"
            )
    
    async def delete_payment(self, payment_id: str, outlet_id: str) -> bool:
        """Delete a payment"""
        try:
            # Check if payment exists
            await self.get_payment(payment_id, outlet_id)
            
            # Delete payment
            response = self.supabase.table(Tables.PAYMENTS).delete().eq("id", payment_id).eq("outlet_id", outlet_id).execute()
            
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting payment: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete payment"
            )
    
    async def get_payment_queue(self, outlet_id: str) -> PaymentQueueResponse:
        """Get payment queue with vendor grouping and urgency calculation"""
        try:
            # Get all pending payments with invoice and vendor data
            response = self.supabase.table(Tables.PAYMENTS).select("""
                *,
                invoices:invoice_id(*),
                vendors:vendor_id(*)
            """).eq("outlet_id", outlet_id).in_("status", ["pending", "overdue"]).execute()
            
            payments = response.data or []
            grouped_payments = {}
            total_pending = 0.0
            total_overdue = 0.0
            total_due_soon = 0.0
            
            for payment_data in payments:
                payment = PaymentResponse(**payment_data)
                invoice = payment_data.get("invoices", {})
                vendor = payment_data.get("vendors", {})
                
                # Calculate urgency
                due_date = datetime.fromisoformat(invoice.get("due_date", "").replace("Z", "+00:00"))
                days_until_due = (due_date - datetime.now()).days
                
                if days_until_due < 0:
                    urgency = "overdue"
                    total_overdue += payment.amount
                elif days_until_due <= 7:
                    urgency = "due_soon"
                    total_due_soon += payment.amount
                else:
                    urgency = "normal"
                
                total_pending += payment.amount
                
                # Group by vendor
                vendor_id = payment.vendor_id
                if vendor_id not in grouped_payments:
                    grouped_payments[vendor_id] = GroupedPayments(
                        vendor=vendor,
                        payments=[],
                        total_amount=0.0,
                        overdue_amount=0.0,
                        due_soon_amount=0.0
                    )
                
                queue_item = PaymentQueueItem(
                    payment=payment,
                    invoice=invoice,
                    vendor=vendor,
                    urgency=urgency,
                    days_until_due=days_until_due
                )
                
                grouped_payments[vendor_id].payments.append(queue_item)
                grouped_payments[vendor_id].total_amount += payment.amount
                
                if urgency == "overdue":
                    grouped_payments[vendor_id].overdue_amount += payment.amount
                elif urgency == "due_soon":
                    grouped_payments[vendor_id].due_soon_amount += payment.amount
            
            return PaymentQueueResponse(
                grouped_payments=grouped_payments,
                total_pending=total_pending,
                total_overdue=total_overdue,
                total_due_soon=total_due_soon
            )
            
        except Exception as e:
            logger.error(f"Error getting payment queue: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get payment queue"
            )
    
    async def bulk_update_payments(self, bulk_data: BulkPaymentUpdate, outlet_id: str, user_id: str) -> List[PaymentResponse]:
        """Update multiple payments in bulk"""
        try:
            updated_payments = []
            
            for payment_id in bulk_data.payment_ids:
                # Verify payment belongs to outlet
                await self.get_payment(payment_id, outlet_id)
                
                # Prepare update data
                update_data = PaymentUpdate(
                    status=bulk_data.status,
                    payment_method=bulk_data.payment_method,
                    bank_reference=bulk_data.bank_reference,
                    notes=bulk_data.notes,
                    paid_by=user_id if bulk_data.status == "paid" else None,
                    confirmed_by=user_id if bulk_data.status == "paid" else None
                )
                
                # Update payment
                updated_payment = await self.update_payment(payment_id, update_data, outlet_id)
                updated_payments.append(updated_payment)
            
            return updated_payments
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error bulk updating payments: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to bulk update payments"
            )
    
    async def get_payment_stats(self, outlet_id: str) -> PaymentStatsResponse:
        """Get payment statistics"""
        try:
            # Get all payments for the outlet
            response = self.supabase.table(Tables.PAYMENTS).select("*").eq("outlet_id", outlet_id).execute()
            
            payments = response.data or []
            
            # Calculate statistics
            total_payments = len(payments)
            total_amount = 0.0
            pending_amount = 0.0
            overdue_amount = 0.0
            paid_amount = 0.0
            status_distribution = {}
            method_distribution = {}
            
            for payment in payments:
                amount = payment.get("amount", 0.0) or 0.0
                status = payment.get("status", "pending")
                method = payment.get("payment_method", "unknown")
                
                total_amount += amount
                
                if status == "pending":
                    pending_amount += amount
                elif status == "overdue":
                    overdue_amount += amount
                elif status == "paid":
                    paid_amount += amount
                
                # Count by status
                status_distribution[status] = status_distribution.get(status, 0) + 1
                
                # Count by method
                method_distribution[method] = method_distribution.get(method, 0) + 1
            
            return PaymentStatsResponse(
                total_payments=total_payments,
                total_amount=total_amount,
                pending_amount=pending_amount,
                overdue_amount=overdue_amount,
                paid_amount=paid_amount,
                status_distribution=status_distribution,
                method_distribution=method_distribution
            )
            
        except Exception as e:
            logger.error(f"Error getting payment stats: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get payment statistics"
            )
    
    async def search_payments(self, search_request: PaymentSearchRequest, outlet_id: str) -> Dict[str, Any]:
        """Search payments"""
        try:
            query = self.supabase.table(Tables.PAYMENTS).select("*", count="exact")
            query = query.eq("outlet_id", outlet_id)
            
            # Apply search filters
            if search_request.query:
                query = query.or_(f"bank_reference.ilike.%{search_request.query}%,notes.ilike.%{search_request.query}%")
            
            if search_request.status:
                query = query.eq("status", search_request.status)
            
            if search_request.vendor_id:
                query = query.eq("vendor_id", search_request.vendor_id)
            
            if search_request.date_from:
                query = query.gte("created_at", search_request.date_from.isoformat())
            
            if search_request.date_to:
                query = query.lte("created_at", search_request.date_to.isoformat())
            
            query = query.limit(search_request.limit)
            
            response = query.execute()
            
            payments = [PaymentResponse(**payment) for payment in response.data]
            total = response.count or 0
            
            return {
                "items": payments,
                "query": search_request.query,
                "total": total
            }
            
        except Exception as e:
            logger.error(f"Error searching payments: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to search payments"
            )


# Create service instance
payment_service = PaymentService()



