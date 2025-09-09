"""
Vendor service for handling vendor-related business logic
"""

from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from app.core.database import get_supabase_admin, Tables
from app.schemas.vendor import VendorCreate, VendorUpdate, VendorResponse, VendorSearchRequest
import logging

logger = logging.getLogger(__name__)


class VendorService:
    """Vendor service class"""
    
    def __init__(self):
        self._supabase = None
    
    @property
    def supabase(self):
        if self._supabase is None:
            self._supabase = get_supabase_admin()
        return self._supabase
    
    async def create_vendor(self, vendor_data: VendorCreate, outlet_id: str, user_id: str) -> VendorResponse:
        """Create a new vendor"""
        try:
            # Prepare vendor data
            vendor_dict = vendor_data.dict()
            vendor_dict.update({
                "outlet_id": outlet_id,
                "current_balance": 0.0
            })
            
            # Insert vendor
            response = self.supabase.table(Tables.VENDORS).insert(vendor_dict).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create vendor"
                )
            
            vendor = response.data[0]
            return VendorResponse(**vendor)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating vendor: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create vendor"
            )
    
    async def get_vendors(
        self, 
        outlet_id: str, 
        page: int = 1, 
        size: int = 20,
        search: Optional[str] = None,
        vendor_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get vendors with pagination and filtering"""
        try:
            # Build query
            query = self.supabase.table(Tables.VENDORS).select("*", count="exact")
            query = query.eq("outlet_id", outlet_id)
            
            # Apply search filter
            if search:
                query = query.or_(f"name.ilike.%{search}%,email.ilike.%{search}%,contact_person.ilike.%{search}%")
            
            # Apply vendor type filter
            if vendor_type:
                query = query.eq("vendor_type", vendor_type)
            
            # Apply pagination
            offset = (page - 1) * size
            query = query.range(offset, offset + size - 1)
            
            # Execute query
            response = query.execute()
            
            vendors = [VendorResponse(**vendor) for vendor in response.data]
            total = response.count or 0
            pages = (total + size - 1) // size
            
            return {
                "items": vendors,
                "total": total,
                "page": page,
                "size": size,
                "pages": pages
            }
            
        except Exception as e:
            logger.error(f"Error getting vendors: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get vendors"
            )
    
    async def get_vendor(self, vendor_id: str, outlet_id: str) -> VendorResponse:
        """Get a specific vendor"""
        try:
            response = self.supabase.table(Tables.VENDORS).select("*").eq("id", vendor_id).eq("outlet_id", outlet_id).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Vendor not found"
                )
            
            vendor = response.data[0]
            return VendorResponse(**vendor)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting vendor: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get vendor"
            )
    
    async def update_vendor(self, vendor_id: str, vendor_data: VendorUpdate, outlet_id: str) -> VendorResponse:
        """Update a vendor"""
        try:
            # Check if vendor exists
            existing = await self.get_vendor(vendor_id, outlet_id)
            
            # Prepare update data (only include non-None values)
            update_dict = {k: v for k, v in vendor_data.dict().items() if v is not None}
            
            if not update_dict:
                return existing
            
            # Update vendor
            response = self.supabase.table(Tables.VENDORS).update(update_dict).eq("id", vendor_id).eq("outlet_id", outlet_id).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update vendor"
                )
            
            vendor = response.data[0]
            return VendorResponse(**vendor)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating vendor: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update vendor"
            )
    
    async def delete_vendor(self, vendor_id: str, outlet_id: str) -> bool:
        """Delete a vendor"""
        try:
            # Check if vendor exists
            await self.get_vendor(vendor_id, outlet_id)
            
            # Delete vendor
            response = self.supabase.table(Tables.VENDORS).delete().eq("id", vendor_id).eq("outlet_id", outlet_id).execute()
            
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting vendor: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete vendor"
            )
    
    async def search_vendors(self, search_request: VendorSearchRequest, outlet_id: str) -> Dict[str, Any]:
        """Search vendors"""
        try:
            query = self.supabase.table(Tables.VENDORS).select("*", count="exact")
            query = query.eq("outlet_id", outlet_id)
            query = query.or_(f"name.ilike.%{search_request.query}%,email.ilike.%{search_request.query}%,contact_person.ilike.%{search_request.query}%")
            query = query.limit(search_request.limit)
            
            response = query.execute()
            
            vendors = [VendorResponse(**vendor) for vendor in response.data]
            total = response.count or 0
            
            return {
                "items": vendors,
                "query": search_request.query,
                "total": total
            }
            
        except Exception as e:
            logger.error(f"Error searching vendors: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to search vendors"
            )
    
    async def get_vendor_stats(self, outlet_id: str) -> Dict[str, Any]:
        """Get vendor statistics"""
        try:
            # Get all vendors for the outlet
            response = self.supabase.table(Tables.VENDORS).select("*").eq("outlet_id", outlet_id).execute()
            
            vendors = response.data or []
            
            # Calculate statistics
            total_vendors = len(vendors)
            type_distribution = {}
            total_outstanding = 0.0
            
            for vendor in vendors:
                # Count by type
                vendor_type = vendor.get("vendor_type", "unknown")
                type_distribution[vendor_type] = type_distribution.get(vendor_type, 0) + 1
                
                # Sum outstanding balance
                balance = vendor.get("current_balance", 0.0) or 0.0
                total_outstanding += balance
            
            average_balance = total_outstanding / total_vendors if total_vendors > 0 else 0.0
            
            return {
                "total_vendors": total_vendors,
                "type_distribution": type_distribution,
                "total_outstanding": total_outstanding,
                "average_balance": average_balance
            }
            
        except Exception as e:
            logger.error(f"Error getting vendor stats: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get vendor statistics"
            )
    
    async def update_vendor_balance(self, vendor_id: str, outlet_id: str, amount: float) -> VendorResponse:
        """Update vendor balance (for payments, invoices, etc.)"""
        try:
            # Get current vendor
            vendor = await self.get_vendor(vendor_id, outlet_id)
            
            # Calculate new balance
            new_balance = vendor.current_balance + amount
            
            # Update balance
            response = self.supabase.table(Tables.VENDORS).update({
                "current_balance": new_balance
            }).eq("id", vendor_id).eq("outlet_id", outlet_id).execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update vendor balance"
                )
            
            updated_vendor = response.data[0]
            return VendorResponse(**updated_vendor)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating vendor balance: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update vendor balance"
            )


# Create service instance
vendor_service = VendorService()

