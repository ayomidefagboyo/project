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
import re

from app.core.database import get_supabase_admin, Tables
from app.core.security import CurrentUser, get_user_outlet_id
from pydantic import BaseModel, Field

router = APIRouter()
logger = logging.getLogger(__name__)


def _extract_missing_column_name(exc: Exception) -> Optional[str]:
    """Extract missing column names from PostgREST/Postgres errors."""
    message = str(exc)
    patterns = [
        r"Could not find the '([^']+)' column",
        r'column "([^"]+)" of relation "[^"]+" does not exist',
        r'column "([^"]+)" does not exist',
        r"column '([^']+)' does not exist",
    ]
    for pattern in patterns:
        match = re.search(pattern, message, flags=re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def _insert_pos_product_compat(supabase, product_data: Dict[str, Any]):
    """Insert into pos_products, dropping unsupported columns when needed."""
    payload = dict(product_data)
    removed_columns: List[str] = []

    for _ in range(20):
        try:
            return supabase.table(Tables.POS_PRODUCTS).insert(payload).execute()
        except Exception as exc:
            missing_column = _extract_missing_column_name(exc)
            if missing_column and missing_column in payload:
                payload.pop(missing_column, None)
                removed_columns.append(missing_column)
                logger.warning(
                    "pos_products.%s missing in schema cache during insert; retrying without it",
                    missing_column
                )
                continue
            raise

    raise Exception(
        f"Failed to insert pos_products after compatibility retries; removed columns={removed_columns}"
    )


def _update_pos_product_compat(supabase, product_id: str, update_data: Dict[str, Any]):
    """Update pos_products row, dropping unsupported columns when needed."""
    payload = dict(update_data)
    removed_columns: List[str] = []

    for _ in range(20):
        try:
            return supabase.table(Tables.POS_PRODUCTS).update(payload).eq('id', product_id).execute()
        except Exception as exc:
            missing_column = _extract_missing_column_name(exc)
            if missing_column and missing_column in payload:
                payload.pop(missing_column, None)
                removed_columns.append(missing_column)
                logger.warning(
                    "pos_products.%s missing in schema cache during update; retrying without it",
                    missing_column
                )
                if not payload:
                    break
                continue
            raise

    raise Exception(
        f"Failed to update pos_products after compatibility retries; removed columns={removed_columns}"
    )


def _insert_invoice_items_compat(supabase, items_data: List[Dict[str, Any]]):
    """Insert into invoice_items, dropping unsupported columns when needed."""
    if not items_data:
        return None

    payload_rows = [dict(row) for row in items_data]
    removed_columns: List[str] = []

    for _ in range(20):
        try:
            return supabase.table(Tables.INVOICE_ITEMS).insert(payload_rows).execute()
        except Exception as exc:
            missing_column = _extract_missing_column_name(exc)
            if missing_column:
                removed_any = False
                next_rows: List[Dict[str, Any]] = []
                for row in payload_rows:
                    if missing_column in row:
                        removed_any = True
                        row = dict(row)
                        row.pop(missing_column, None)
                    next_rows.append(row)
                if removed_any:
                    payload_rows = next_rows
                    removed_columns.append(missing_column)
                    logger.warning(
                        "invoice_items.%s missing in schema cache during insert; retrying without it",
                        missing_column
                    )
                    continue
            raise

    raise Exception(
        f"Failed to insert invoice_items after compatibility retries; removed columns={removed_columns}"
    )


_STOCK_MOVEMENT_SAFE_OPTIONAL_COLUMNS = {
    'id',
    'reference_type',
    'reference_id',
    'unit_cost',
    'total_value',
    'notes',
    'performed_by',
    'movement_date',
    'created_at',
}


def _insert_stock_movements_compat(supabase, movements: List[Dict[str, Any]]):
    """Insert stock movements with minimal-return + safe optional-column retries."""
    if not movements:
        return None

    payload_rows = [dict(row) for row in movements]
    removed_columns: List[str] = []

    for _ in range(20):
        try:
            # Avoid representation column-mapping edge cases in stale PostgREST caches.
            return supabase.table('pos_stock_movements').insert(
                payload_rows,
                returning='minimal'
            ).execute()
        except Exception as exc:
            missing_column = _extract_missing_column_name(exc)
            if missing_column and missing_column in _STOCK_MOVEMENT_SAFE_OPTIONAL_COLUMNS:
                removed_any = False
                next_rows: List[Dict[str, Any]] = []
                for row in payload_rows:
                    if missing_column in row:
                        removed_any = True
                        row = dict(row)
                        row.pop(missing_column, None)
                    next_rows.append(row)
                if removed_any:
                    payload_rows = next_rows
                    removed_columns.append(missing_column)
                    logger.warning(
                        "pos_stock_movements.%s missing in schema cache during insert; retrying without it",
                        missing_column
                    )
                    continue
            raise

    raise Exception(
        "Failed to insert pos_stock_movements after compatibility retries; "
        f"removed columns={removed_columns}"
    )


def _has_received_marker(notes: Optional[str]) -> bool:
    text = str(notes or '')
    return '[Received on ' in text


def _append_received_marker(notes: Optional[str], now_iso: str, staff_name: str) -> str:
    marker = f"[Received on {now_iso[:10]} by {staff_name}]"
    base = str(notes or '').strip()
    if marker in base:
        return base
    if not base:
        return marker
    return f"{base}\n{marker}"


def _upsert_note_marker(notes: Optional[str], marker_prefix: str, marker_line: Optional[str]) -> str:
    """Replace note marker line by prefix; append when marker_line is provided."""
    lines = [line.strip() for line in str(notes or '').splitlines() if line.strip()]
    filtered = [line for line in lines if not line.startswith(marker_prefix)]
    if marker_line:
        filtered.append(marker_line.strip())
    return '\n'.join(filtered)


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
    payment_status: Optional[str] = None  # paid | unpaid
    payment_date: Optional[str] = None  # YYYY-MM-DD; required when unpaid
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
                    'sku': item.sku,
                    'barcode': item.barcode,
                    'category': item.category,
                    'created_at': datetime.utcnow().isoformat()
                })

            _insert_invoice_items_compat(supabase, items_data)

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

        invoice_type = str(invoice.get('invoice_type') or '').strip().lower()
        customer_id = invoice.get('customer_id')
        is_vendor_invoice = (invoice_type == 'vendor') or (not invoice_type and not customer_id)
        if not is_vendor_invoice:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only vendor invoices can be received into inventory"
            )

        if invoice['status'] == 'received' or _has_received_marker(invoice.get('notes')):
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
        payment_status_raw = str(receive_req.payment_status or '').strip().lower()
        if payment_status_raw and payment_status_raw not in ('paid', 'unpaid'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="payment_status must be 'paid' or 'unpaid'"
            )
        payment_status = payment_status_raw or 'paid'
        payment_date_iso: Optional[str] = None
        if receive_req.payment_date:
            try:
                payment_date_iso = date.fromisoformat(str(receive_req.payment_date)).isoformat()
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="payment_date must be in YYYY-MM-DD format"
                )
        if payment_status == 'unpaid' and not payment_date_iso:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="payment_date is required when payment_status is unpaid"
            )
        override_by_item_id: Dict[str, Dict[str, Any]] = {}
        if receive_req.items_received:
            for row in receive_req.items_received:
                item_id = str(row.get('item_id') or '').strip()
                if item_id:
                    override_by_item_id[item_id] = row

        def _to_float(value: Any, default: float = 0.0) -> float:
            try:
                if value is None or value == '':
                    return default
                return float(value)
            except (TypeError, ValueError):
                return default

        def _to_bool(value: Any, default: bool = True) -> bool:
            if value is None:
                return default
            if isinstance(value, bool):
                return value
            if isinstance(value, (int, float)):
                return bool(value)
            if isinstance(value, str):
                normalized = value.strip().lower()
                if normalized in ('true', '1', 'yes', 'on'):
                    return True
                if normalized in ('false', '0', 'no', 'off'):
                    return False
            return default

        for item in items:
            qty = _to_float(item.get('quantity'), 0)
            cost_price = _to_float(item.get('unit_price'), 0)
            description = str(item.get('description') or 'Unknown Item').strip() or 'Unknown Item'
            category_value = str(item.get('category') or 'Uncategorized').strip() or 'Uncategorized'
            markup_percentage = 30.0
            auto_pricing_enabled = True
            explicit_selling_price: Optional[float] = None

            override = override_by_item_id.get(str(item.get('id') or ''))
            if override:
                qty = _to_float(override.get('quantity'), qty)
                override_cost = override.get('cost_price', override.get('unit_price'))
                if override_cost is not None:
                    cost_price = _to_float(override_cost, cost_price)

                if override.get('category') is not None:
                    override_category = str(override.get('category') or '').strip()
                    if override_category:
                        category_value = override_category

                if override.get('markup_percentage') is not None:
                    markup_percentage = max(0.0, _to_float(override.get('markup_percentage'), markup_percentage))

                if override.get('auto_pricing_enabled') is not None:
                    auto_pricing_enabled = _to_bool(override.get('auto_pricing_enabled'), auto_pricing_enabled)

                if override.get('selling_price') is not None:
                    explicit_selling_price = max(0.0, _to_float(override.get('selling_price'), 0))

            if qty <= 0:
                continue

            rounded_qty = round(qty)
            if abs(qty - rounded_qty) > 1e-9:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Invalid quantity for '{description}': {qty}. "
                        "Inventory quantities must be whole numbers."
                    )
                )
            qty_units = int(rounded_qty)
            if qty_units <= 0:
                continue

            if explicit_selling_price is not None:
                final_selling_price = explicit_selling_price
            elif auto_pricing_enabled and cost_price > 0:
                final_selling_price = round(cost_price * (1 + (markup_percentage / 100)), 2)
            else:
                final_selling_price = max(0.0, cost_price)

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
                    item_barcode = str(item.get('barcode') or '').strip()
                    item_sku = str(item.get('sku') or '').strip()
                    current_qty = _to_float(
                        product.get('quantity_on_hand'),
                        _to_float(product.get('quantity'), 0)
                    )
                    current_qty_units = int(round(current_qty))
                    new_qty = current_qty_units + qty_units

                    update_fields: Dict[str, Any] = {
                        'quantity_on_hand': new_qty,
                        'category': category_value,
                        'updated_at': now,
                        'last_received': now
                    }

                    if receive_req.update_cost_prices and cost_price > 0:
                        update_fields['cost_price'] = cost_price

                    if explicit_selling_price is not None:
                        update_fields['unit_price'] = final_selling_price

                    if override and override.get('markup_percentage') is not None:
                        update_fields['markup_percentage'] = markup_percentage

                    if override and override.get('auto_pricing_enabled') is not None:
                        update_fields['auto_pricing'] = auto_pricing_enabled

                    # Preserve barcode/SKU capture from receiving lines when product currently has no value.
                    if item_barcode and not str(product.get('barcode') or '').strip():
                        update_fields['barcode'] = item_barcode
                    if item_sku and not str(product.get('sku') or '').strip():
                        update_fields['sku'] = item_sku

                    update_result = _update_pos_product_compat(supabase, product_id, update_fields)
                    updated_product = (update_result.data or [product])[0]

                    products_updated.append({
                        'product_id': product_id,
                        'name': updated_product.get('name') or description,
                        'quantity_added': qty_units,
                        'new_total': new_qty
                    })

                    # Stock movement
                    stock_movements.append({
                        'id': str(uuid.uuid4()),
                        'outlet_id': invoice['outlet_id'],
                        'product_id': product_id,
                        'movement_type': 'receive',
                        'quantity_change': qty_units,
                        'quantity_before': current_qty_units,
                        'quantity_after': new_qty,
                        'reference_type': 'vendor_invoice',
                        'reference_id': invoice_id,
                        'unit_cost': cost_price if cost_price > 0 else None,
                        'total_value': (cost_price * qty_units) if cost_price > 0 else None,
                        'notes': f"Received from invoice {invoice['invoice_number']}",
                        'performed_by': current_user['id'],
                        'movement_date': now
                    })

            elif receive_req.add_to_inventory:
                # ---- CREATE NEW PRODUCT from invoice item ----
                new_product_id = str(uuid.uuid4())
                generated_sku = f"INV-{str(uuid.uuid4())[:8].upper()}"
                item_sku = str(item.get('sku') or '').strip()
                sku = item_sku or generated_sku

                new_product = {
                    'id': new_product_id,
                    'outlet_id': invoice['outlet_id'],
                    'name': description,
                    'sku': sku,
                    'barcode': item.get('barcode') or None,
                    'category': category_value,
                    'cost_price': cost_price,
                    'unit_price': final_selling_price,
                    'quantity_on_hand': qty_units,
                    'reorder_level': 5,
                    'reorder_quantity': 0,
                    'tax_rate': 0.075,
                    'is_active': True,
                    'markup_percentage': markup_percentage,
                    'auto_pricing': auto_pricing_enabled,
                    'last_received': now,
                    'created_at': now,
                    'updated_at': now
                }

                create_result = _insert_pos_product_compat(supabase, new_product)
                created_product = (create_result.data or [new_product])[0]

                # Link the invoice item to the new product
                supabase.table(Tables.INVOICE_ITEMS)\
                    .update({'product_id': new_product_id})\
                    .eq('id', item['id'])\
                    .execute()

                products_created.append({
                    'product_id': new_product_id,
                    'name': created_product.get('name') or description,
                    'quantity': _to_float(
                        created_product.get('quantity_on_hand'),
                        _to_float(created_product.get('quantity'), qty_units)
                    ),
                    'cost_price': _to_float(created_product.get('cost_price'), cost_price),
                    'selling_price': _to_float(
                        created_product.get('unit_price'),
                        _to_float(created_product.get('selling_price'), final_selling_price)
                    )
                })

                # Stock movement
                stock_movements.append({
                    'id': str(uuid.uuid4()),
                    'outlet_id': invoice['outlet_id'],
                    'product_id': new_product_id,
                    'movement_type': 'receive',
                    'quantity_change': qty_units,
                    'quantity_before': 0,
                    'quantity_after': qty_units,
                    'reference_type': 'vendor_invoice',
                    'reference_id': invoice_id,
                    'unit_cost': cost_price if cost_price > 0 else None,
                    'total_value': (cost_price * qty_units) if cost_price > 0 else None,
                    'notes': f"New product created from invoice {invoice['invoice_number']}",
                    'performed_by': current_user['id'],
                    'movement_date': now
                })

        # Insert all stock movements
        if stock_movements:
            _insert_stock_movements_compat(supabase, stock_movements)

        received_notes = _append_received_marker(
            invoice.get('notes'),
            now,
            str(current_user.get('name', 'Staff'))
        )
        received_notes = _upsert_note_marker(
            received_notes,
            '[Payment status:',
            f"[Payment status: {payment_status}]"
        )
        received_notes = _upsert_note_marker(
            received_notes,
            '[Payment date:',
            f"[Payment date: {payment_date_iso}]" if payment_date_iso else None
        )
        invoice_status_target = 'paid' if payment_status == 'paid' else 'received'
        invoice_update_payload: Dict[str, Any] = {
            'status': invoice_status_target,
            'notes': received_notes,
            'updated_at': now
        }
        if payment_status == 'unpaid' and payment_date_iso:
            invoice_update_payload['due_date'] = payment_date_iso

        try:
            supabase.table(Tables.INVOICES)\
                .update(invoice_update_payload)\
                .eq('id', invoice_id)\
                .execute()
        except Exception as status_error:
            message = str(status_error).lower()
            # Backward compatibility for databases that have not added "received" to invoice_status yet.
            if (
                invoice_status_target == 'received'
                and 'invalid input value for enum' in message
                and 'received' in message
            ):
                logger.warning(
                    "invoice_status enum missing 'received'; falling back to 'pending' for invoice %s",
                    invoice_id
                )
                fallback_payload: Dict[str, Any] = {
                    'status': 'pending',
                    'notes': received_notes,
                    'updated_at': now
                }
                if payment_status == 'unpaid' and payment_date_iso:
                    fallback_payload['due_date'] = payment_date_iso
                supabase.table(Tables.INVOICES)\
                    .update(fallback_payload)\
                    .eq('id', invoice_id)\
                    .execute()
            else:
                raise

        # Log audit
        _log_audit(supabase, invoice['outlet_id'], current_user, 'receive', 'invoice', invoice_id,
                   f"Received invoice {invoice['invoice_number']}: "
                   f"{len(products_created)} new products, {len(products_updated)} updated; "
                   f"payment_status={payment_status}")

        return {
            "message": "Invoice goods received successfully",
            "invoice_id": invoice_id,
            "invoice_number": invoice['invoice_number'],
            "payment_status": payment_status,
            "payment_date": payment_date_iso,
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
            'sku': item.sku,
            'barcode': item.barcode,
            'category': item.category,
            'created_at': datetime.utcnow().isoformat()
        }

        _insert_invoice_items_compat(supabase, [item_data])

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
                "received": len([i for i in vendor_invoices if i['status'] == 'received']),
                "paid": len([i for i in vendor_invoices if i['status'] == 'paid']),
                "overdue": len([i for i in vendor_invoices if i['status'] == 'overdue']),
                "total_amount": sum(float(i.get('total', 0)) for i in vendor_invoices),
                "unpaid_amount": sum(float(i.get('total', 0)) for i in vendor_invoices if i['status'] in ('draft', 'pending', 'received', 'overdue'))
            },
            "customer_invoices": {
                "total": len(customer_invoices),
                "draft": len([i for i in customer_invoices if i['status'] == 'draft']),
                "pending": len([i for i in customer_invoices if i['status'] == 'pending']),
                "received": len([i for i in customer_invoices if i['status'] == 'received']),
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
