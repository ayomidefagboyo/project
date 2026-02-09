"""
Invoice management endpoints
Handles both vendor invoices (purchase orders / receiving goods) and customer invoices.
When a vendor invoice is marked as "received", items auto-add to inventory/products.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
import uuid
import logging

from app.core.database import get_supabase_admin, Tables
from app.core.security import CurrentUser, get_user_outlet_id
from pydantic import BaseModel, Field

router = APIRouter()
logger = logging.getLogger(__name__)


# ===============================================
# SCHEMAS
# ===============================================

class InvoiceItemCreate(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float = 0
    product_id: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    category: Optional[str] = None


class InvoiceCreate(BaseModel):
    outlet_id: str
    vendor_id: Optional[str] = None
    customer_id: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_type: str = "vendor"  # "vendor" (purchase) or "customer" (sale)
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None
    tax_rate: float = 0
    items: List[InvoiceItemCreate] = []
    attachments: Optional[List[str]] = None


class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[str] = None
    tax_rate: Optional[float] = None
    payment_method: Optional[str] = None
    approved_by: Optional[str] = None


class ReceiveInvoiceRequest(BaseModel):
    """When receiving goods from a vendor invoice, optionally create new products"""
    add_to_inventory: bool = True
    update_cost_prices: bool = True
    items_received: Optional[List[Dict[str, Any]]] = None  # Override quantities if partial receipt


# ===============================================
# VENDOR INVOICE ENDPOINTS
# ===============================================

@router.get("/")
async def get_invoices(
    outlet_id: str,
    invoice_type: Optional[str] = Query(None, description="Filter: vendor or customer"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    vendor_id: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Get invoices with filtering and pagination"""
    try:
        supabase = get_supabase_admin()

        query = supabase.table(Tables.INVOICES)\
            .select('*, invoice_items(*)')\
            .eq('outlet_id', outlet_id)\
            .order('created_at', desc=True)

        if invoice_type:
            # vendor invoices have vendor_id set, customer invoices have customer_id set
            if invoice_type == "vendor":
                query = query.not_.is_('vendor_id', 'null')
            elif invoice_type == "customer":
                query = query.not_.is_('customer_id', 'null')

        if status_filter:
            query = query.eq('status', status_filter)

        if vendor_id:
            query = query.eq('vendor_id', vendor_id)

        if customer_id:
            query = query.eq('customer_id', customer_id)

        if date_from:
            query = query.gte('issue_date', date_from)

        if date_to:
            query = query.lte('issue_date', date_to)

        result = query.execute()
        all_data = result.data or []
        total = len(all_data)

        # Paginate
        start = (page - 1) * size
        end = start + size
        paginated = all_data[start:end]

        return {
            "items": paginated,
            "total": total,
            "page": page,
            "size": size,
            "pages": (total + size - 1) // size
        }

    except Exception as e:
        logger.error(f"Error fetching invoices: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch invoices: {str(e)}"
        )


@router.post("/")
async def create_invoice(
    invoice: InvoiceCreate,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Create a new invoice (vendor purchase order or customer invoice)"""
    try:
        supabase = get_supabase_admin()

        # Generate invoice number if not provided
        invoice_number = invoice.invoice_number
        if not invoice_number:
            prefix = "VI" if invoice.vendor_id else "CI"
            timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
            short_id = str(uuid.uuid4())[:6].upper()
            invoice_number = f"{prefix}-{timestamp}-{short_id}"

        # Calculate totals from items
        subtotal = sum(item.quantity * item.unit_price for item in invoice.items)
        tax_amount = subtotal * (invoice.tax_rate / 100) if invoice.tax_rate else 0
        total = subtotal + tax_amount

        # Create invoice record
        invoice_id = str(uuid.uuid4())
        invoice_data = {
            'id': invoice_id,
            'outlet_id': invoice.outlet_id,
            'invoice_number': invoice_number,
            'vendor_id': invoice.vendor_id,
            'customer_id': invoice.customer_id,
            'issue_date': invoice.issue_date or date.today().isoformat(),
            'due_date': invoice.due_date or date.today().isoformat(),
            'status': 'draft',
            'notes': invoice.notes,
            'tax_rate': invoice.tax_rate,
            'subtotal': float(subtotal),
            'tax_amount': float(tax_amount),
            'total': float(total),
            'payment_method': None,
            'created_by': current_user['id'],
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        result = supabase.table(Tables.INVOICES).insert(invoice_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create invoice"
            )

        # Create invoice items
        if invoice.items:
            items_data = []
            for item in invoice.items:
                items_data.append({
                    'id': str(uuid.uuid4()),
                    'invoice_id': invoice_id,
                    'product_id': item.product_id,
                    'description': item.description,
                    'quantity': item.quantity,
                    'unit_price': item.unit_price,
                    'total': item.quantity * item.unit_price,
                    'created_at': datetime.utcnow().isoformat()
                })

            supabase.table(Tables.INVOICE_ITEMS).insert(items_data).execute()

        # If vendor invoice, update vendor balance
        if invoice.vendor_id:
            try:
                vendor_result = supabase.table(Tables.VENDORS)\
                    .select('current_balance')\
                    .eq('id', invoice.vendor_id)\
                    .single()\
                    .execute()

                if vendor_result.data:
                    new_balance = float(vendor_result.data.get('current_balance', 0)) + total
                    supabase.table(Tables.VENDORS)\
                        .update({'current_balance': new_balance})\
                        .eq('id', invoice.vendor_id)\
                        .execute()
            except Exception as ve:
                logger.warning(f"Could not update vendor balance: {ve}")

        # Log audit entry
        _log_audit(supabase, invoice.outlet_id, current_user, 'create', 'invoice', invoice_id,
                   f"Created {'vendor' if invoice.vendor_id else 'customer'} invoice {invoice_number} for {total:.2f}")

        # Return the full invoice with items
        full_result = supabase.table(Tables.INVOICES)\
            .select('*, invoice_items(*)')\
            .eq('id', invoice_id)\
            .single()\
            .execute()

        return full_result.data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating invoice: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create invoice: {str(e)}"
        )


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Get a specific invoice with items"""
    try:
        supabase = get_supabase_admin()

        result = supabase.table(Tables.INVOICES)\
            .select('*, invoice_items(*), vendors(*), customers(*)')\
            .eq('id', invoice_id)\
            .single()\
            .execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invoice not found"
            )

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching invoice: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch invoice: {str(e)}"
        )


@router.put("/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    update: InvoiceUpdate,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Update invoice status, notes, etc."""
    try:
        supabase = get_supabase_admin()

        # Build update data (only include non-None fields)
        update_data = {}
        if update.status is not None:
            update_data['status'] = update.status
        if update.notes is not None:
            update_data['notes'] = update.notes
        if update.due_date is not None:
            update_data['due_date'] = update.due_date
        if update.tax_rate is not None:
            update_data['tax_rate'] = update.tax_rate
        if update.payment_method is not None:
            update_data['payment_method'] = update.payment_method

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        update_data['updated_at'] = datetime.utcnow().isoformat()

        result = supabase.table(Tables.INVOICES)\
            .update(update_data)\
            .eq('id', invoice_id)\
            .select('*, invoice_items(*)')\
            .execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invoice not found"
            )

        invoice = result.data[0]

        # Log audit
        _log_audit(supabase, invoice['outlet_id'], current_user, 'update', 'invoice', invoice_id,
                   f"Updated invoice {invoice['invoice_number']}: {update_data}")

        return invoice

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating invoice: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update invoice: {str(e)}"
        )


@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Delete an invoice (only drafts can be deleted)"""
    try:
        supabase = get_supabase_admin()

        # Check invoice exists and is draft
        check = supabase.table(Tables.INVOICES)\
            .select('id, status, invoice_number, outlet_id')\
            .eq('id', invoice_id)\
            .single()\
            .execute()

        if not check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

        if check.data['status'] != 'draft':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete invoice with status '{check.data['status']}'. Only drafts can be deleted."
            )

        # Delete items first, then invoice
        supabase.table(Tables.INVOICE_ITEMS).delete().eq('invoice_id', invoice_id).execute()
        supabase.table(Tables.INVOICES).delete().eq('id', invoice_id).execute()

        _log_audit(supabase, check.data['outlet_id'], current_user, 'delete', 'invoice', invoice_id,
                   f"Deleted draft invoice {check.data['invoice_number']}")

        return {"message": "Invoice deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting invoice: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete invoice: {str(e)}"
        )


# ===============================================
# RECEIVE GOODS (INVOICE → INVENTORY)
# ===============================================

@router.post("/{invoice_id}/receive")
async def receive_invoice_goods(
    invoice_id: str,
    receive_req: ReceiveInvoiceRequest,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """
    Mark a vendor invoice as received and auto-add items to inventory.
    - If product_id is set on an item, updates existing product stock + cost price
    - If product_id is NOT set, creates a new product from the invoice item details
    - Creates stock movement records for audit trail
    """
    try:
        supabase = get_supabase_admin()

        # Get the invoice with items
        inv_result = supabase.table(Tables.INVOICES)\
            .select('*, invoice_items(*)')\
            .eq('id', invoice_id)\
            .single()\
            .execute()

        if not inv_result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

        invoice = inv_result.data

        if not invoice.get('vendor_id'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only vendor invoices can be received into inventory"
            )

        if invoice['status'] == 'received':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invoice has already been received"
            )

        items = invoice.get('invoice_items', [])
        if not items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invoice has no items to receive"
            )

        products_created = []
        products_updated = []
        stock_movements = []
        now = datetime.utcnow().isoformat()

        for item in items:
            qty = float(item.get('quantity', 0))
            cost_price = float(item.get('unit_price', 0))
            description = item.get('description', 'Unknown Item')

            # Check if item has override from receive_req
            if receive_req.items_received:
                override = next((o for o in receive_req.items_received if o.get('item_id') == item['id']), None)
                if override:
                    qty = float(override.get('quantity', qty))

            if qty <= 0:
                continue

            product_id = item.get('product_id')

            if product_id:
                # ---- UPDATE EXISTING PRODUCT ----
                prod_result = supabase.table(Tables.POS_PRODUCTS)\
                    .select('*')\
                    .eq('id', product_id)\
                    .single()\
                    .execute()

                if prod_result.data:
                    product = prod_result.data
                    new_qty = float(product.get('quantity', 0)) + qty
                    update_fields = {
                        'quantity': new_qty,
                        'updated_at': now
                    }

                    if receive_req.update_cost_prices and cost_price > 0:
                        update_fields['cost_price'] = cost_price

                    supabase.table(Tables.POS_PRODUCTS)\
                        .update(update_fields)\
                        .eq('id', product_id)\
                        .execute()

                    products_updated.append({
                        'product_id': product_id,
                        'name': product.get('name'),
                        'quantity_added': qty,
                        'new_total': new_qty
                    })

                    # Stock movement
                    stock_movements.append({
                        'id': str(uuid.uuid4()),
                        'outlet_id': invoice['outlet_id'],
                        'product_id': product_id,
                        'movement_type': 'receive',
                        'quantity': qty,
                        'reference_type': 'vendor_invoice',
                        'reference_id': invoice_id,
                        'notes': f"Received from invoice {invoice['invoice_number']}",
                        'performed_by': current_user['id'],
                        'created_at': now
                    })

            elif receive_req.add_to_inventory:
                # ---- CREATE NEW PRODUCT from invoice item ----
                new_product_id = str(uuid.uuid4())
                sku = f"INV-{str(uuid.uuid4())[:8].upper()}"

                new_product = {
                    'id': new_product_id,
                    'outlet_id': invoice['outlet_id'],
                    'name': description,
                    'sku': sku,
                    'barcode': item.get('barcode') or None,
                    'category': item.get('category') or 'Uncategorized',
                    'cost_price': cost_price,
                    'selling_price': round(cost_price * 1.3, 2),  # Default 30% markup
                    'quantity': qty,
                    'min_stock_level': 5,
                    'is_active': True,
                    'created_at': now,
                    'updated_at': now
                }

                supabase.table(Tables.POS_PRODUCTS).insert(new_product).execute()

                # Link the invoice item to the new product
                supabase.table(Tables.INVOICE_ITEMS)\
                    .update({'product_id': new_product_id})\
                    .eq('id', item['id'])\
                    .execute()

                products_created.append({
                    'product_id': new_product_id,
                    'name': description,
                    'quantity': qty,
                    'cost_price': cost_price,
                    'selling_price': new_product['selling_price']
                })

                # Stock movement
                stock_movements.append({
                    'id': str(uuid.uuid4()),
                    'outlet_id': invoice['outlet_id'],
                    'product_id': new_product_id,
                    'movement_type': 'receive',
                    'quantity': qty,
                    'reference_type': 'vendor_invoice',
                    'reference_id': invoice_id,
                    'notes': f"New product created from invoice {invoice['invoice_number']}",
                    'performed_by': current_user['id'],
                    'created_at': now
                })

        # Insert all stock movements
        if stock_movements:
            supabase.table('pos_stock_movements').insert(stock_movements).execute()

        # Update invoice status to 'received' (custom status beyond the enum)
        # If the DB enum doesn't have 'received', we use 'paid' as closest match
        supabase.table(Tables.INVOICES)\
            .update({
                'status': 'paid',
                'notes': (invoice.get('notes') or '') + f"\n[Received on {now[:10]} by {current_user.get('name', 'Staff')}]",
                'updated_at': now
            })\
            .eq('id', invoice_id)\
            .execute()

        # Log audit
        _log_audit(supabase, invoice['outlet_id'], current_user, 'receive', 'invoice', invoice_id,
                   f"Received invoice {invoice['invoice_number']}: "
                   f"{len(products_created)} new products, {len(products_updated)} updated")

        return {
            "message": "Invoice goods received successfully",
            "invoice_id": invoice_id,
            "invoice_number": invoice['invoice_number'],
            "products_created": products_created,
            "products_updated": products_updated,
            "stock_movements_count": len(stock_movements)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error receiving invoice goods: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to receive invoice goods: {str(e)}"
        )


# ===============================================
# INVOICE ITEMS ENDPOINTS
# ===============================================

@router.post("/{invoice_id}/items")
async def add_invoice_item(
    invoice_id: str,
    item: InvoiceItemCreate,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Add an item to an existing invoice"""
    try:
        supabase = get_supabase_admin()

        # Verify invoice exists
        inv_check = supabase.table(Tables.INVOICES)\
            .select('id, status, outlet_id')\
            .eq('id', invoice_id)\
            .single()\
            .execute()

        if not inv_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

        if inv_check.data['status'] not in ('draft', 'pending'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only add items to draft or pending invoices"
            )

        item_data = {
            'id': str(uuid.uuid4()),
            'invoice_id': invoice_id,
            'product_id': item.product_id,
            'description': item.description,
            'quantity': item.quantity,
            'unit_price': item.unit_price,
            'total': item.quantity * item.unit_price,
            'created_at': datetime.utcnow().isoformat()
        }

        supabase.table(Tables.INVOICE_ITEMS).insert(item_data).execute()

        # Recalculate invoice totals
        _recalculate_invoice_totals(supabase, invoice_id)

        # Return updated invoice
        result = supabase.table(Tables.INVOICES)\
            .select('*, invoice_items(*)')\
            .eq('id', invoice_id)\
            .single()\
            .execute()

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding invoice item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add invoice item: {str(e)}"
        )


@router.delete("/{invoice_id}/items/{item_id}")
async def remove_invoice_item(
    invoice_id: str,
    item_id: str,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Remove an item from an invoice"""
    try:
        supabase = get_supabase_admin()

        supabase.table(Tables.INVOICE_ITEMS)\
            .delete()\
            .eq('id', item_id)\
            .eq('invoice_id', invoice_id)\
            .execute()

        # Recalculate totals
        _recalculate_invoice_totals(supabase, invoice_id)

        return {"message": "Item removed successfully"}

    except Exception as e:
        logger.error(f"Error removing invoice item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove invoice item: {str(e)}"
        )


# ===============================================
# STATS
# ===============================================

@router.get("/stats/summary")
async def get_invoice_stats(
    outlet_id: str,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Get invoice statistics for an outlet"""
    try:
        supabase = get_supabase_admin()

        result = supabase.table(Tables.INVOICES)\
            .select('id, status, total, vendor_id, customer_id')\
            .eq('outlet_id', outlet_id)\
            .execute()

        invoices = result.data or []

        vendor_invoices = [i for i in invoices if i.get('vendor_id')]
        customer_invoices = [i for i in invoices if i.get('customer_id')]

        stats = {
            "vendor_invoices": {
                "total": len(vendor_invoices),
                "draft": len([i for i in vendor_invoices if i['status'] == 'draft']),
                "pending": len([i for i in vendor_invoices if i['status'] == 'pending']),
                "paid": len([i for i in vendor_invoices if i['status'] == 'paid']),
                "overdue": len([i for i in vendor_invoices if i['status'] == 'overdue']),
                "total_amount": sum(float(i.get('total', 0)) for i in vendor_invoices),
                "unpaid_amount": sum(float(i.get('total', 0)) for i in vendor_invoices if i['status'] in ('draft', 'pending', 'overdue'))
            },
            "customer_invoices": {
                "total": len(customer_invoices),
                "draft": len([i for i in customer_invoices if i['status'] == 'draft']),
                "pending": len([i for i in customer_invoices if i['status'] == 'pending']),
                "paid": len([i for i in customer_invoices if i['status'] == 'paid']),
                "total_amount": sum(float(i.get('total', 0)) for i in customer_invoices)
            }
        }

        return stats

    except Exception as e:
        logger.error(f"Error fetching invoice stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch invoice stats: {str(e)}"
        )


# ===============================================
# HELPERS
# ===============================================

def _recalculate_invoice_totals(supabase, invoice_id: str):
    """Recalculate subtotal, tax, and total for an invoice"""
    items_result = supabase.table(Tables.INVOICE_ITEMS)\
        .select('quantity, unit_price')\
        .eq('invoice_id', invoice_id)\
        .execute()

    subtotal = sum(float(i['quantity']) * float(i['unit_price']) for i in (items_result.data or []))

    # Get tax rate
    inv = supabase.table(Tables.INVOICES)\
        .select('tax_rate')\
        .eq('id', invoice_id)\
        .single()\
        .execute()

    tax_rate = float(inv.data.get('tax_rate', 0)) if inv.data else 0
    tax_amount = subtotal * (tax_rate / 100)
    total = subtotal + tax_amount

    supabase.table(Tables.INVOICES)\
        .update({
            'subtotal': subtotal,
            'tax_amount': tax_amount,
            'total': total,
            'updated_at': datetime.utcnow().isoformat()
        })\
        .eq('id', invoice_id)\
        .execute()


def _log_audit(supabase, outlet_id: str, user: Dict, action: str, entity_type: str, entity_id: str, details: str):
    """Log an audit entry"""
    try:
        supabase.table(Tables.AUDIT_ENTRIES).insert({
            'id': str(uuid.uuid4()),
            'outlet_id': outlet_id,
            'user_id': user['id'],
            'user_name': user.get('name', 'Unknown'),
            'action': action,
            'entity_type': entity_type,
            'entity_id': entity_id,
            'details': details,
            'timestamp': datetime.utcnow().isoformat()
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to log audit entry: {e}")
