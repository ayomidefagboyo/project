"""
POS System API Endpoints
Nigerian Supermarket Focus
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query, Header, Body
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
import uuid
import logging
import json
import re
from decimal import Decimal

from app.core.database import get_supabase_admin, Tables
from app.core.security import CurrentUser
from app.services.staff_service import StaffService
from app.schemas.pos import (
    # Products
    POSProductCreate, POSProductUpdate, POSProductResponse,
    ProductListResponse, ProductSearchRequest,
    ProductBulkImportRequest, ProductBulkImportResponse, ProductBulkImportError,
    # Transactions
    POSTransactionCreate, POSTransactionResponse,
    TransactionListResponse, TransactionSearchRequest,
    # Inventory
    StockMovementCreate, StockMovementResponse,
    InventoryTransferCreate, InventoryTransferResponse,
    # Cash Drawer
    CashDrawerSessionCreate, CashDrawerSessionClose, CashDrawerSessionResponse,
    # Statistics
    InventoryStatsResponse, SalesStatsResponse,
    # Held Receipts
    HeldReceiptCreate, HeldReceiptResponse, HeldReceiptListResponse,
    # Staff Profiles
    StaffProfileCreate, StaffProfileUpdate, StaffProfileResponse,
    StaffProfileListResponse, StaffPinAuth, StaffAuthResponse,
    # Receipt Settings
    ReceiptSettingsUpdate, ReceiptSettingsResponse,
    # Base types
    PaymentMethod, TransactionStatus, MovementType, SyncStatus, ReceiptType, TransferStatus
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _is_missing_cashier_name_error(exc: Exception) -> bool:
    """Detect schema/cache errors for missing pos_transactions.cashier_name."""
    message = str(exc).lower()
    return (
        "cashier_name" in message
        and (
            "does not exist" in message
            or "could not find" in message
            or "schema cache" in message
            or "pgrst204" in message
            or "42703" in message
        )
    )


def _extract_missing_column_name(exc: Exception) -> Optional[str]:
    """Extract missing-column name from PostgREST/Postgres error text."""
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


def _insert_pos_transaction_compat(supabase, transaction_data: Dict[str, Any]):
    """
    Insert into pos_transactions with backward compatibility for older schemas.
    If a column is missing in prod schema cache, remove it and retry.
    """
    payload = dict(transaction_data)
    removed_columns = []

    for _ in range(12):
        try:
            return supabase.table('pos_transactions').insert(payload).execute()
        except Exception as exc:
            missing_column = _extract_missing_column_name(exc)

            # Keep explicit legacy check for existing known production failure shape.
            if not missing_column and _is_missing_cashier_name_error(exc):
                missing_column = 'cashier_name'

            if missing_column and missing_column in payload:
                payload.pop(missing_column, None)
                removed_columns.append(missing_column)
                logger.warning(
                    "pos_transactions.%s missing in schema cache; retrying insert without it",
                    missing_column
                )
                continue

            # Not a missing-column issue we can recover from.
            raise

    raise RuntimeError(
        f"Failed to insert pos_transactions after compatibility retries; removed columns={removed_columns}"
    )


def _safe_json_loads(value: Any) -> Dict[str, Any]:
    """Parse JSON notes safely and return an object."""
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return {}
    return {}


MANAGER_LEVEL_ROLES = {'manager', 'admin', 'business_owner', 'outlet_admin', 'super_admin'}


def _normalize_role(role: Any) -> str:
    return str(role or '').strip().lower()


def _resolve_staff_context(
    supabase,
    current_user: Dict[str, Any],
    outlet_id: Optional[str],
    staff_session_token: Optional[str]
) -> Dict[str, Any]:
    """
    Resolve effective actor role for POS operations.
    Preference order:
    1) Verified POS staff session header
    2) Current authenticated API user role
    """
    fallback_context = {
        'role': _normalize_role(current_user.get('role')),
        'source': 'api_user',
        'staff_profile_id': None,
        'outlet_id': outlet_id
    }

    if not staff_session_token:
        return fallback_context

    payload = StaffService.parse_session_token(staff_session_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired POS staff session"
        )

    staff_profile_id = payload.get('staff_profile_id')
    if not staff_profile_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid POS staff session payload"
        )

    profile_result = supabase.table(Tables.STAFF_PROFILES)\
        .select('id,outlet_id,role,is_active')\
        .eq('id', staff_profile_id)\
        .execute()
    profile = profile_result.data[0] if profile_result.data else None

    if not profile or not profile.get('is_active'):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Staff session is no longer active"
        )

    profile_outlet_id = profile.get('outlet_id')
    if outlet_id and profile_outlet_id and profile_outlet_id != outlet_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff session does not match this outlet"
        )

    return {
        'role': _normalize_role(profile.get('role')),
        'source': 'staff_session',
        'staff_profile_id': profile.get('id'),
        'outlet_id': profile_outlet_id or outlet_id
    }


def _require_manager_role(
    supabase,
    current_user: Dict[str, Any],
    outlet_id: Optional[str],
    staff_session_token: Optional[str]
) -> Dict[str, Any]:
    context = _resolve_staff_context(supabase, current_user, outlet_id, staff_session_token)
    if context['role'] in MANAGER_LEVEL_ROLES:
        return context
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Manager authorization required for this action"
    )


def _resolve_actor_user_id(current_user: Dict[str, Any]) -> str:
    """Resolve authenticated user id for DB columns referencing users(id)."""
    actor_user_id = str(current_user.get('id') or '').strip()
    if not actor_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user id is required"
        )
    return actor_user_id


# ===============================================
# PRODUCT MANAGEMENT ENDPOINTS
# ===============================================

@router.get("/products", response_model=ProductListResponse)
async def get_products(
    outlet_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    search: Optional[str] = Query(None, description="Search products"),
    category: Optional[str] = Query(None, description="Filter by category"),
    updated_after: Optional[str] = Query(None, description="Fetch products updated after this ISO timestamp"),
    active_only: bool = Query(True, description="Show only active products"),
    current_user=Depends(CurrentUser())
):
    """Get products for POS with pagination and filtering"""
    try:
        supabase = get_supabase_admin()

        # Build query
        query = supabase.table(Tables.POS_PRODUCTS).select('*').eq('outlet_id', outlet_id)

        if active_only:
            query = query.eq('is_active', True)

        if category:
            query = query.eq('category', category)

        if updated_after:
            query = query.gt('updated_at', updated_after)

        if search:
            # Search in name, sku, or barcode
            query = query.or_(
                f"name.ilike.%{search}%,"
                f"sku.ilike.%{search}%,"
                f"barcode.ilike.%{search}%"
            )

        # Get total count for pagination
        count_result = query.execute()
        total = len(count_result.data) if count_result.data else 0

        # Apply pagination
        offset = (page - 1) * size
        query = query.range(offset, offset + size - 1).order('name')

        result = query.execute()

        return ProductListResponse(
            items=result.data or [],
            total=total,
            page=page,
            size=size
        )

    except Exception as e:
        logger.error(f"Error fetching products: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch products: {str(e)}"
        )


@router.post("/products", response_model=POSProductResponse)
async def create_product(
    product: POSProductCreate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Create a new product"""
    try:
        supabase = get_supabase_admin()
        _require_manager_role(supabase, current_user, product.outlet_id, x_pos_staff_session)

        # Generate product ID
        product_id = str(uuid.uuid4())

        # Prepare product data with proper Decimal serialization
        product_data = {
            'id': product_id,
            **product.model_dump(mode='json'),
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        # Insert product
        result = supabase.table('pos_products').insert(product_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create product"
            )

        return POSProductResponse(**result.data[0])

    except Exception as e:
        logger.error(f"Error creating product: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create product: {str(e)}"
        )


@router.post("/products/import", response_model=ProductBulkImportResponse)
async def bulk_import_products(
    payload: ProductBulkImportRequest,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """
    Bulk import products with dedupe/upsert behavior.
    - dedupe_by controls how existing rows are matched.
    - update_existing=False skips matched rows.
    - dry_run validates/matches without writing to DB.
    """
    try:
        supabase = get_supabase_admin()
        _require_manager_role(supabase, current_user, payload.outlet_id, x_pos_staff_session)

        rows = payload.products or []
        if len(rows) == 0:
            return ProductBulkImportResponse(
                total_received=0,
                created_count=0,
                updated_count=0,
                skipped_count=0,
                error_count=0,
                errors=[]
            )

        dedupe_by = payload.dedupe_by
        now_iso = datetime.utcnow().isoformat()

        def norm_sku(value: Any) -> str:
            return str(value or '').strip().upper()

        def norm_barcode(value: Any) -> str:
            return str(value or '').strip()

        existing_by_sku: Dict[str, Dict[str, Any]] = {}
        existing_by_barcode: Dict[str, Dict[str, Any]] = {}

        if dedupe_by in ('sku', 'sku_or_barcode'):
            sku_values = sorted({
                norm_sku(product.sku)
                for product in rows
                if norm_sku(product.sku)
            })
            if sku_values:
                existing_skus = supabase.table(Tables.POS_PRODUCTS)\
                    .select('*')\
                    .eq('outlet_id', payload.outlet_id)\
                    .in_('sku', sku_values)\
                    .execute()
                for product in existing_skus.data or []:
                    key = norm_sku(product.get('sku'))
                    if key:
                        existing_by_sku[key] = product

        if dedupe_by in ('barcode', 'sku_or_barcode'):
            barcode_values = sorted({
                norm_barcode(product.barcode)
                for product in rows
                if norm_barcode(product.barcode)
            })
            if barcode_values:
                existing_barcodes = supabase.table(Tables.POS_PRODUCTS)\
                    .select('*')\
                    .eq('outlet_id', payload.outlet_id)\
                    .in_('barcode', barcode_values)\
                    .execute()
                for product in existing_barcodes.data or []:
                    key = norm_barcode(product.get('barcode'))
                    if key:
                        existing_by_barcode[key] = product

        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors: List[ProductBulkImportError] = []
        pending_upserts: List[Dict[str, Any]] = []
        pending_meta: List[Dict[str, Any]] = []

        for index, row in enumerate(rows, start=1):
            try:
                row_data = row.model_dump(mode='json')
                row_data['outlet_id'] = payload.outlet_id
                row_data['sku'] = norm_sku(row_data.get('sku'))
                if row_data.get('barcode') is not None:
                    row_data['barcode'] = norm_barcode(row_data.get('barcode')) or None

                sku_key = norm_sku(row_data.get('sku'))
                barcode_key = norm_barcode(row_data.get('barcode'))

                existing: Optional[Dict[str, Any]] = None
                if dedupe_by in ('sku', 'sku_or_barcode') and sku_key:
                    existing = existing_by_sku.get(sku_key)
                if not existing and dedupe_by in ('barcode', 'sku_or_barcode') and barcode_key:
                    existing = existing_by_barcode.get(barcode_key)

                if existing:
                    if not payload.update_existing:
                        skipped_count += 1
                        continue

                    update_data = {
                        'id': existing.get('id') or str(uuid.uuid4()),
                        **row_data,
                        'created_at': existing.get('created_at') or now_iso,
                        'updated_at': now_iso
                    }
                    if payload.dry_run:
                        updated_count += 1
                    else:
                        pending_upserts.append(update_data)
                        pending_meta.append({
                            'row': index,
                            'sku': getattr(row, 'sku', None),
                            'barcode': getattr(row, 'barcode', None),
                            'name': getattr(row, 'name', None),
                            'mode': 'update'
                        })

                    # Keep in-memory map current for duplicates within same import batch.
                    existing_record = update_data
                    if sku_key:
                        existing_by_sku[sku_key] = existing_record
                    if barcode_key:
                        existing_by_barcode[barcode_key] = existing_record
                    continue

                create_data = {
                    'id': str(uuid.uuid4()),
                    **row_data,
                    'created_at': now_iso,
                    'updated_at': now_iso
                }

                if payload.dry_run:
                    created_count += 1
                    existing_record = create_data
                else:
                    pending_upserts.append(create_data)
                    pending_meta.append({
                        'row': index,
                        'sku': getattr(row, 'sku', None),
                        'barcode': getattr(row, 'barcode', None),
                        'name': getattr(row, 'name', None),
                        'mode': 'create'
                    })
                    existing_record = create_data

                if sku_key:
                    existing_by_sku[sku_key] = existing_record
                if barcode_key:
                    existing_by_barcode[barcode_key] = existing_record
            except Exception as row_error:
                errors.append(ProductBulkImportError(
                    row=index,
                    sku=getattr(row, 'sku', None),
                    barcode=getattr(row, 'barcode', None),
                    name=getattr(row, 'name', None),
                    message=str(row_error)
                ))

        if not payload.dry_run and pending_upserts:
            chunk_size = 250

            for start in range(0, len(pending_upserts), chunk_size):
                chunk_rows = pending_upserts[start:start + chunk_size]
                chunk_meta = pending_meta[start:start + chunk_size]

                try:
                    chunk_result = supabase.table(Tables.POS_PRODUCTS).upsert(chunk_rows).execute()
                    if chunk_result.data is None:
                        raise ValueError("Bulk upsert returned no data")

                    for meta in chunk_meta:
                        if meta['mode'] == 'create':
                            created_count += 1
                        else:
                            updated_count += 1
                except Exception as chunk_error:
                    logger.warning(
                        "Bulk upsert chunk failed, retrying row-by-row for diagnostics: %s",
                        chunk_error
                    )

                    for row_payload, meta in zip(chunk_rows, chunk_meta):
                        try:
                            row_result = supabase.table(Tables.POS_PRODUCTS).upsert([row_payload]).execute()
                            if not row_result.data:
                                raise ValueError("Failed to write product row")

                            if meta['mode'] == 'create':
                                created_count += 1
                            else:
                                updated_count += 1
                        except Exception as row_error:
                            errors.append(ProductBulkImportError(
                                row=meta['row'],
                                sku=meta.get('sku'),
                                barcode=meta.get('barcode'),
                                name=meta.get('name'),
                                message=str(row_error)
                            ))

        return ProductBulkImportResponse(
            total_received=len(rows),
            created_count=created_count,
            updated_count=updated_count,
            skipped_count=skipped_count,
            error_count=len(errors),
            errors=errors
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk importing products: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import products: {str(e)}"
        )


@router.get("/products/{product_id}", response_model=POSProductResponse)
async def get_product(
    product_id: str,
    current_user=Depends(CurrentUser())
):
    """Get a specific product by ID"""
    try:
        supabase = get_supabase_admin()

        result = supabase.table('pos_products').select('*').eq('id', product_id).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )

        return POSProductResponse(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching product {product_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch product: {str(e)}"
        )


@router.put("/products/{product_id}", response_model=POSProductResponse)
async def update_product(
    product_id: str,
    product: POSProductUpdate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Update a product"""
    try:
        supabase = get_supabase_admin()
        existing_product = supabase.table('pos_products').select('id,outlet_id').eq('id', product_id).execute()
        if not existing_product.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )
        _require_manager_role(
            supabase,
            current_user,
            existing_product.data[0].get('outlet_id'),
            x_pos_staff_session
        )

        # Prepare update data (exclude None values)
        update_data = {k: v for k, v in product.dict().items() if v is not None}
        update_data['updated_at'] = datetime.utcnow().isoformat()

        result = supabase.table('pos_products').update(update_data).eq('id', product_id).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )

        return POSProductResponse(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating product {product_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update product: {str(e)}"
        )


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Delete a product (soft delete by setting inactive)"""
    try:
        supabase = get_supabase_admin()
        existing_product = supabase.table('pos_products').select('id,outlet_id').eq('id', product_id).execute()
        if not existing_product.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )
        _require_manager_role(
            supabase,
            current_user,
            existing_product.data[0].get('outlet_id'),
            x_pos_staff_session
        )

        result = supabase.table('pos_products').update({
            'is_active': False,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', product_id).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )

        return {"message": "Product deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting product {product_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete product: {str(e)}"
        )


@router.get("/products/search/barcode/{barcode}", response_model=POSProductResponse)
async def get_product_by_barcode(
    barcode: str,
    outlet_id: str,
    current_user=Depends(CurrentUser())
):
    """Get product by barcode scan"""
    try:
        supabase = get_supabase_admin()

        result = supabase.table('pos_products').select('*').eq('barcode', barcode).eq('outlet_id', outlet_id).eq('is_active', True).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found for this barcode"
            )

        return POSProductResponse(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching product by barcode {barcode}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch product by barcode: {str(e)}"
        )


# ===============================================
# TRANSACTION PROCESSING ENDPOINTS
# ===============================================

@router.post("/transactions", response_model=POSTransactionResponse)
async def create_transaction(
    transaction: POSTransactionCreate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Process a new POS transaction"""
    try:
        supabase = get_supabase_admin()
        actor_context = _resolve_staff_context(
            supabase,
            current_user,
            transaction.outlet_id,
            x_pos_staff_session
        )
        authenticated_user_id = _resolve_actor_user_id(current_user)

        # Persist user-id in pos_transactions.cashier_id (FK -> users.id).
        # Staff session is still used for role enforcement and cashier_name display.
        if transaction.cashier_id and transaction.cashier_id != authenticated_user_id:
            logger.warning(
                "Ignoring client cashier_id %s in favor of authenticated user %s",
                transaction.cashier_id,
                authenticated_user_id
            )
        cashier_id = authenticated_user_id
        staff_profile_id = actor_context.get('staff_profile_id')
        
        # Extract split_payments from transaction notes if present (temporary solution)
        # In future, we should add split_payments as a proper field in the schema
        split_payments = None
        if transaction.notes:
            try:
                notes_data = json.loads(transaction.notes)
                if isinstance(notes_data, dict) and 'split_payments' in notes_data:
                    split_payments = notes_data['split_payments']
            except (json.JSONDecodeError, TypeError):
                pass  # Notes is not JSON, treat as regular notes

        # Generate transaction ID and number
        transaction_id = str(uuid.uuid4())
        transaction_number = f"TXN-{datetime.now().strftime('%Y%m%d')}-{transaction_id[:8].upper()}"

        # Calculate totals (treat unit_price as VAT-inclusive final price)
        subtotal = Decimal(0)   # Gross after line discounts
        tax_amount = Decimal(0) # Derived VAT portion (for reporting)
        total_amount = Decimal(0)  # Same as subtotal (for now), after any transaction-level discount

        # Process each item and calculate totals
        transaction_items = []
        for item in transaction.items:
            # Get product details
            product_result = supabase.table('pos_products').select('*').eq('id', item.product_id).execute()
            if not product_result.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product {item.product_id} not found"
                )

            product = product_result.data[0]

            # Use provided price or product price (VAT-inclusive)
            unit_price = item.unit_price if item.unit_price else Decimal(str(product['unit_price']))

            # Line calculations with VAT-inclusive pricing
            line_gross = unit_price * item.quantity                 # Gross before discount (includes VAT)
            line_discount = item.discount_amount
            line_gross_after_discount = max(Decimal(0), line_gross - line_discount)

            rate = Decimal(str(product.get('tax_rate', 0) or 0))
            if rate > 0:
                # VAT portion from inclusive price: gross - net = gross * (rate / (1 + rate))
                line_tax = line_gross_after_discount * (rate / (Decimal(1) + rate))
            else:
                line_tax = Decimal(0)

            # For totals, we treat line_total as the gross amount the customer pays (includes VAT)
            line_total = line_gross_after_discount

            # Add to transaction totals
            subtotal += line_gross_after_discount
            tax_amount += line_tax
            total_amount += line_total

            # Prepare transaction item
            transaction_items.append({
                'id': str(uuid.uuid4()),
                'transaction_id': transaction_id,
                'product_id': item.product_id,
                'sku': product['sku'],
                'product_name': product['name'],
                'quantity': item.quantity,
                'unit_price': float(unit_price),
                'discount_amount': float(line_discount),
                'tax_amount': float(line_tax),
                'line_total': float(line_total)
            })

        # Apply transaction-level discount (if any)
        if transaction.discount_amount:
            total_amount = max(Decimal(0), total_amount - transaction.discount_amount)

        # Handle split payments or single payment
        change_amount = Decimal(0)
        tendered_amount = transaction.tendered_amount
        
        if split_payments and len(split_payments) > 1:
            # Validate split payments sum to total
            total_split = sum(Decimal(str(p.get('amount', 0))) for p in split_payments)
            if abs(total_split - total_amount) > Decimal('0.01'):  # Allow small rounding differences
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Split payments total ({total_split}) does not match transaction total ({total_amount})"
                )
            # For split payments, use total as tendered and calculate change from cash portion
            tendered_amount = total_amount
            cash_payment = next((p for p in split_payments if p.get('method') == 'cash'), None)
            if cash_payment and cash_payment.get('amount'):
                cash_amount = Decimal(str(cash_payment['amount']))
                # Change is only relevant if cash amount exceeds its portion
                change_amount = max(Decimal(0), cash_amount - (total_amount if len(split_payments) == 1 else cash_amount))
        elif transaction.payment_method == PaymentMethod.CASH and transaction.tendered_amount:
            change_amount = transaction.tendered_amount - total_amount
            if change_amount < -Decimal('0.01'):  # Allow small rounding differences
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Insufficient payment amount"
                )

        # Get cashier's name for display (prefer staff_profiles, then users).
        cashier_name = 'Unknown'
        try:
            if staff_profile_id:
                cashier_result = supabase.table('staff_profiles').select('display_name').eq('id', staff_profile_id).execute()
                if cashier_result.data:
                    cashier_name = cashier_result.data[0].get('display_name') or cashier_name

            if cashier_name == 'Unknown':
                user_result = supabase.table('users').select('name').eq('id', cashier_id).execute()
                if user_result.data:
                    cashier_name = user_result.data[0].get('name') or cashier_name
        except Exception as cashier_lookup_error:
            logger.warning(f"Cashier name lookup failed for {cashier_id}: {cashier_lookup_error}")

        # Prepare transaction data
        transaction_data = {
            'id': transaction_id,
            'transaction_number': transaction_number,
            'outlet_id': transaction.outlet_id,
            'cashier_id': cashier_id,
            'cashier_name': cashier_name,
            'customer_id': transaction.customer_id,
            'customer_name': transaction.customer_name,
            'subtotal': float(subtotal),
            'tax_amount': float(tax_amount),
            'discount_amount': float(transaction.discount_amount),
            'total_amount': float(total_amount),
            'payment_method': transaction.payment_method.value,
            'tendered_amount': float(transaction.tendered_amount) if transaction.tendered_amount else None,
            'change_amount': float(change_amount),
            'payment_reference': transaction.payment_reference,
            'status': TransactionStatus.COMPLETED.value,
            'receipt_type': transaction.receipt_type.value if hasattr(transaction, 'receipt_type') else 'sale',
            'transaction_date': datetime.utcnow().isoformat(),
            'sync_status': SyncStatus.SYNCED.value,
            'offline_id': transaction.offline_id,
            'notes': transaction.notes,  # Split payments are already in notes if provided
            'receipt_printed': False,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        # Insert transaction
        tx_result = _insert_pos_transaction_compat(supabase, transaction_data)
        if not tx_result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create transaction"
            )

        # Insert transaction items
        items_result = supabase.table('pos_transaction_items').insert(transaction_items).execute()
        if not items_result.data:
            # Rollback transaction if items failed
            supabase.table('pos_transactions').delete().eq('id', transaction_id).execute()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create transaction items"
            )

        # Update stock quantities for each product sold
        for item in transaction.items:
            try:
                # Get current stock
                product_result = supabase.table('pos_products').select('quantity_on_hand').eq('id', item.product_id).execute()
                if product_result.data:
                    current_qty = product_result.data[0]['quantity_on_hand']
                    new_qty = max(0, current_qty - item.quantity)  # Prevent negative stock
                    
                    # Update product quantity
                    supabase.table('pos_products').update({
                        'quantity_on_hand': new_qty,
                        'updated_at': datetime.utcnow().isoformat()
                    }).eq('id', item.product_id).execute()
                    
                    # Create stock movement record
                    movement_data = {
                        'id': str(uuid.uuid4()),
                        'product_id': item.product_id,
                        'outlet_id': transaction.outlet_id,
                        'movement_type': 'sale',
                        'quantity_change': -item.quantity,
                        'quantity_before': current_qty,
                        'quantity_after': new_qty,
                        'reference_id': transaction_id,
                        'reference_type': 'pos_transaction',
                        'performed_by': cashier_id,
                        'movement_date': datetime.utcnow().isoformat()
                    }
                    supabase.table('pos_stock_movements').insert(movement_data).execute()
            except Exception as stock_error:
                logger.warning(f"Failed to update stock for product {item.product_id}: {stock_error}")
                # Don't fail transaction if stock update fails, but log it

        # Return complete transaction with items
        response_data = tx_result.data[0]
        response_data['items'] = items_result.data

        return POSTransactionResponse(**response_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating transaction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create transaction: {str(e)}"
        )


@router.get("/transactions", response_model=TransactionListResponse)
async def get_transactions(
    outlet_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(50, ge=1, description="Page size"),
    date_from: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    cashier_id: Optional[str] = Query(None, description="Filter by cashier"),
    payment_method: Optional[PaymentMethod] = Query(None, description="Filter by payment method"),
    status: Optional[TransactionStatus] = Query(None, description="Filter by transaction status"),
    search: Optional[str] = Query(None, description="Search receipt number, customer, payment method, cashier"),
    current_user=Depends(CurrentUser())
):
    """Get transactions with filtering and pagination"""
    try:
        supabase = get_supabase_admin()

        def apply_filters(query_builder):
            query_builder = query_builder.eq('outlet_id', outlet_id)

            # Date filters should include the full calendar day.
            if date_from:
                query_builder = query_builder.gte('transaction_date', f"{date_from.isoformat()}T00:00:00")
            if date_to:
                end_exclusive = date_to + timedelta(days=1)
                query_builder = query_builder.lt('transaction_date', f"{end_exclusive.isoformat()}T00:00:00")
            if cashier_id:
                query_builder = query_builder.eq('cashier_id', cashier_id)
            if payment_method:
                query_builder = query_builder.eq('payment_method', payment_method.value)
            if status:
                query_builder = query_builder.eq('status', status.value)

            if search and search.strip():
                term = search.strip().replace(',', ' ')
                pattern = f"*{term}*"
                query_builder = query_builder.or_(
                    f"transaction_number.ilike.{pattern},"
                    f"customer_name.ilike.{pattern},"
                    f"payment_method.ilike.{pattern},"
                    f"cashier_name.ilike.{pattern}"
                )

            return query_builder

        # Count query kept lightweight for pagination metadata.
        count_query = apply_filters(
            supabase.table('pos_transactions').select('id')
        )
        count_result = count_query.execute()
        total = len(count_result.data) if count_result.data else 0

        # Apply pagination and ordering
        offset = (page - 1) * size
        query = apply_filters(
            supabase.table('pos_transactions').select('*, items:pos_transaction_items(*)')
        )
        query = query.range(offset, offset + size - 1).order('transaction_date', desc=True)

        result = query.execute()

        return TransactionListResponse(
            items=result.data or [],
            total=total,
            page=page,
            size=size
        )

    except Exception as e:
        logger.error(f"Error fetching transactions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch transactions: {str(e)}"
        )


@router.get("/transactions/{transaction_id}", response_model=POSTransactionResponse)
async def get_transaction(
    transaction_id: str,
    current_user=Depends(CurrentUser())
):
    """Get a specific transaction with items"""
    try:
        supabase = get_supabase_admin()

        # Get transaction with items (alias pos_transaction_items -> items to match schema)
        result = supabase.table('pos_transactions').select('*, items:pos_transaction_items(*)').eq('id', transaction_id).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )

        return POSTransactionResponse(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching transaction {transaction_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch transaction: {str(e)}"
        )


@router.put("/transactions/{transaction_id}/void")
async def void_transaction(
    transaction_id: str,
    void_data: Dict[str, str],
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Void a transaction"""
    try:
        supabase = get_supabase_admin()

        # Get transaction to restore stock
        tx_result = supabase.table('pos_transactions').select('*, pos_transaction_items(*)').eq('id', transaction_id).execute()
        if not tx_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )

        transaction = tx_result.data[0]
        actor_context = _require_manager_role(
            supabase,
            current_user,
            transaction.get('outlet_id'),
            x_pos_staff_session
        )
        actor_id = _resolve_actor_user_id(current_user)
        void_reason = void_data.get('void_reason', 'No reason provided') if void_data else 'No reason provided'

        # Restore stock quantities for voided transaction
        if transaction.get('pos_transaction_items'):
            for item in transaction['pos_transaction_items']:
                try:
                    # Get current stock
                    product_result = supabase.table('pos_products').select('quantity_on_hand').eq('id', item['product_id']).execute()
                    if product_result.data:
                        current_qty = product_result.data[0]['quantity_on_hand']
                        new_qty = current_qty + item['quantity']  # Restore sold quantity
                        
                        # Update product quantity
                        supabase.table('pos_products').update({
                            'quantity_on_hand': new_qty,
                            'updated_at': datetime.utcnow().isoformat()
                        }).eq('id', item['product_id']).execute()
                        
                        # Create stock movement record for void
                        movement_data = {
                            'id': str(uuid.uuid4()),
                            'product_id': item['product_id'],
                            'outlet_id': transaction['outlet_id'],
                            'movement_type': 'return',
                            'quantity_change': item['quantity'],
                            'quantity_before': current_qty,
                            'quantity_after': new_qty,
                            'reference_id': transaction_id,
                            'reference_type': 'voided_transaction',
                            'performed_by': actor_id,
                            'movement_date': datetime.utcnow().isoformat(),
                            'notes': f'Stock restored from voided transaction: {void_reason}'
                        }
                        supabase.table('pos_stock_movements').insert(movement_data).execute()
                except Exception as stock_error:
                    logger.warning(f"Failed to restore stock for product {item['product_id']}: {stock_error}")

        # Get voider's name for display
        voider_name = current_user.get('name', 'Unknown')
        if actor_context.get('staff_profile_id'):
            staff_result = supabase.table(Tables.STAFF_PROFILES)\
                .select('display_name')\
                .eq('id', actor_context['staff_profile_id'])\
                .execute()
            if staff_result.data:
                voider_name = staff_result.data[0].get('display_name') or voider_name

        result = supabase.table('pos_transactions').update({
            'is_voided': True,
            'voided_by': actor_id,
            'voided_by_name': voider_name,
            'voided_at': datetime.utcnow().isoformat(),
            'void_reason': void_reason,
            'receipt_type': 'void',
            'status': TransactionStatus.VOIDED.value,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', transaction_id).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )

        return {"message": "Transaction voided successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error voiding transaction {transaction_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to void transaction: {str(e)}"
        )


# ===============================================
# INVENTORY MANAGEMENT ENDPOINTS
# ===============================================

@router.post("/inventory/adjustment", response_model=StockMovementResponse)
async def create_stock_adjustment(
    movement: StockMovementCreate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Create manual stock adjustment"""
    try:
        supabase = get_supabase_admin()
        actor_context = _require_manager_role(
            supabase,
            current_user,
            movement.outlet_id,
            x_pos_staff_session
        )
        actor_id = _resolve_actor_user_id(current_user)

        # Get current product stock
        product_result = supabase.table('pos_products').select('quantity_on_hand').eq('id', movement.product_id).execute()
        if not product_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )

        current_quantity = product_result.data[0]['quantity_on_hand']
        new_quantity = current_quantity + movement.quantity_change

        if new_quantity < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient stock for this adjustment"
            )

        # Persist the stock level change.
        product_update = supabase.table('pos_products').update({
            'quantity_on_hand': new_quantity,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', movement.product_id).execute()

        if not product_update.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update product stock"
            )

        # Create stock movement record
        movement_data = {
            'id': str(uuid.uuid4()),
            'product_id': movement.product_id,
            'outlet_id': movement.outlet_id,
            'movement_type': movement.movement_type.value,
            'quantity_change': movement.quantity_change,
            'quantity_before': current_quantity,
            'quantity_after': new_quantity,
            'reference_id': movement.reference_id,
            'reference_type': movement.reference_type or 'manual_adjustment',
            'unit_cost': float(movement.unit_cost) if movement.unit_cost else None,
            'total_value': float(movement.unit_cost * abs(movement.quantity_change)) if movement.unit_cost else None,
            'notes': movement.notes,
            'performed_by': actor_id,
            'movement_date': datetime.utcnow().isoformat()
        }

        result = supabase.table('pos_stock_movements').insert(movement_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create stock movement"
            )

        return StockMovementResponse(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating stock adjustment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create stock adjustment: {str(e)}"
        )


@router.get("/inventory/movements", response_model=List[StockMovementResponse])
async def get_stock_movements(
    outlet_id: str,
    product_id: Optional[str] = Query(None, description="Filter by product"),
    movement_type: Optional[MovementType] = Query(None, description="Filter by movement type"),
    date_from: Optional[date] = Query(None, description="Start date"),
    date_to: Optional[date] = Query(None, description="End date"),
    limit: int = Query(100, ge=1, le=500, description="Maximum results"),
    current_user=Depends(CurrentUser())
):
    """Get stock movements with filtering"""
    try:
        supabase = get_supabase_admin()

        query = supabase.table('pos_stock_movements').select('*').eq('outlet_id', outlet_id)

        if product_id:
            query = query.eq('product_id', product_id)
        if movement_type:
            query = query.eq('movement_type', movement_type.value)
        if date_from:
            query = query.gte('movement_date', date_from.isoformat())
        if date_to:
            query = query.lte('movement_date', date_to.isoformat())

        query = query.limit(limit).order('movement_date', desc=True)

        result = query.execute()

        return [StockMovementResponse(**item) for item in (result.data or [])]

    except Exception as e:
        logger.error(f"Error fetching stock movements: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stock movements: {str(e)}"
        )


@router.post("/inventory/transfers", response_model=InventoryTransferResponse)
async def create_inventory_transfer(
    transfer: InventoryTransferCreate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Transfer inventory between outlets and post transfer movements."""
    try:
        supabase = get_supabase_admin()
        actor_context = _require_manager_role(
            supabase,
            current_user,
            transfer.from_outlet_id,
            x_pos_staff_session
        )

        if transfer.from_outlet_id == transfer.to_outlet_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Source and destination outlets cannot be the same"
            )

        now_iso = datetime.utcnow().isoformat()
        transfer_id = str(uuid.uuid4())
        transfer_number = f"TRF-{datetime.utcnow().strftime('%Y%m%d')}-{transfer_id[:8].upper()}"
        performed_by = _resolve_actor_user_id(current_user)

        outlet_result = supabase.table('outlets').select('id,name').in_(
            'id', [transfer.from_outlet_id, transfer.to_outlet_id]
        ).execute()
        outlet_map = {
            outlet.get('id'): outlet.get('name') or 'Outlet'
            for outlet in (outlet_result.data or [])
            if outlet.get('id')
        }
        from_outlet_name = outlet_map.get(transfer.from_outlet_id, 'Source Outlet')
        to_outlet_name = outlet_map.get(transfer.to_outlet_id, 'Destination Outlet')

        response_items: List[Dict[str, Any]] = []
        total_items = 0
        total_value = Decimal('0')

        for item in transfer.items:
            quantity = int(item.quantity_requested)
            if quantity <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Transfer quantity must be greater than zero"
                )

            source_result = supabase.table('pos_products').select('*').eq('id', item.product_id).execute()
            if not source_result.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Source product {item.product_id} not found"
                )

            source_product = source_result.data[0]
            if source_product.get('outlet_id') != transfer.from_outlet_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product {item.product_id} does not belong to source outlet"
                )

            available_qty = int(source_product.get('quantity_on_hand') or 0)
            if available_qty < quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock for {source_product.get('name') or source_product.get('sku') or 'item'}"
                )

            destination_result = supabase.table('pos_products').select('*')\
                .eq('outlet_id', transfer.to_outlet_id)\
                .eq('sku', source_product.get('sku'))\
                .limit(1)\
                .execute()

            destination_product = destination_result.data[0] if destination_result.data else None
            if not destination_product:
                source_unit_price = source_product.get('unit_price')
                safe_unit_price = float(source_unit_price) if source_unit_price is not None else 0.01
                if safe_unit_price <= 0:
                    safe_unit_price = 0.01

                destination_payload = {
                    'id': str(uuid.uuid4()),
                    'outlet_id': transfer.to_outlet_id,
                    'sku': source_product.get('sku'),
                    'barcode': source_product.get('barcode'),
                    'name': source_product.get('name'),
                    'description': source_product.get('description'),
                    'category': source_product.get('category'),
                    'unit_price': safe_unit_price,
                    'cost_price': source_product.get('cost_price') or 0,
                    'tax_rate': source_product.get('tax_rate') or 0,
                    'quantity_on_hand': 0,
                    'reorder_level': source_product.get('reorder_level') or 0,
                    'reorder_quantity': source_product.get('reorder_quantity') or 0,
                    'is_active': True if source_product.get('is_active') is None else source_product.get('is_active'),
                    'vendor_id': source_product.get('vendor_id'),
                    'image_url': source_product.get('image_url'),
                    'display_order': source_product.get('display_order') or 0,
                    'created_at': now_iso,
                    'updated_at': now_iso
                }
                destination_create = supabase.table('pos_products').insert(destination_payload).execute()
                if not destination_create.data:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to create destination product for transfer"
                    )
                destination_product = destination_create.data[0]

            source_before = available_qty
            source_after = source_before - quantity
            destination_before = int(destination_product.get('quantity_on_hand') or 0)
            destination_after = destination_before + quantity

            source_update = supabase.table('pos_products').update({
                'quantity_on_hand': source_after,
                'updated_at': now_iso
            }).eq('id', source_product['id']).execute()
            if not source_update.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update source outlet stock"
                )

            destination_update = supabase.table('pos_products').update({
                'quantity_on_hand': destination_after,
                'updated_at': now_iso
            }).eq('id', destination_product['id']).execute()
            if not destination_update.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update destination outlet stock"
                )

            unit_cost = Decimal(str(source_product.get('cost_price') or 0))
            line_total_value = unit_cost * Decimal(quantity)
            total_value += line_total_value
            total_items += quantity

            transfer_note = json.dumps({
                'transfer_id': transfer_id,
                'transfer_number': transfer_number,
                'from_outlet_id': transfer.from_outlet_id,
                'to_outlet_id': transfer.to_outlet_id,
                'from_outlet_name': from_outlet_name,
                'to_outlet_name': to_outlet_name,
                'transfer_reason': transfer.transfer_reason,
                'transfer_notes': transfer.notes,
                'product_name': source_product.get('name'),
                'product_sku': source_product.get('sku'),
                'status': TransferStatus.RECEIVED.value
            }, default=str)

            out_movement = {
                'id': str(uuid.uuid4()),
                'product_id': source_product['id'],
                'outlet_id': transfer.from_outlet_id,
                'movement_type': MovementType.TRANSFER_OUT.value,
                'quantity_change': -quantity,
                'quantity_before': source_before,
                'quantity_after': source_after,
                'reference_id': transfer_id,
                'reference_type': 'stock_transfer',
                'unit_cost': float(unit_cost) if unit_cost > 0 else None,
                'total_value': float(line_total_value) if unit_cost > 0 else None,
                'notes': transfer_note,
                'performed_by': performed_by,
                'movement_date': now_iso
            }
            in_movement = {
                'id': str(uuid.uuid4()),
                'product_id': destination_product['id'],
                'outlet_id': transfer.to_outlet_id,
                'movement_type': MovementType.TRANSFER_IN.value,
                'quantity_change': quantity,
                'quantity_before': destination_before,
                'quantity_after': destination_after,
                'reference_id': transfer_id,
                'reference_type': 'stock_transfer',
                'unit_cost': float(unit_cost) if unit_cost > 0 else None,
                'total_value': float(line_total_value) if unit_cost > 0 else None,
                'notes': transfer_note,
                'performed_by': performed_by,
                'movement_date': now_iso
            }

            out_result = supabase.table('pos_stock_movements').insert(out_movement).execute()
            in_result = supabase.table('pos_stock_movements').insert(in_movement).execute()
            if not out_result.data or not in_result.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create stock movement records for transfer"
                )

            response_items.append({
                'id': str(uuid.uuid4()),
                'product_id': source_product['id'],
                'product_name': source_product.get('name') or 'Product',
                'sku': source_product.get('sku') or '',
                'quantity_requested': quantity,
                'quantity_sent': quantity,
                'quantity_received': quantity,
                'unit_cost': float(unit_cost) if unit_cost > 0 else None,
                'batch_number': item.batch_number,
                'expiry_date': item.expiry_date,
                'notes': item.notes
            })

        transfer_response = {
            'id': transfer_id,
            'transfer_number': transfer_number,
            'from_outlet_id': transfer.from_outlet_id,
            'to_outlet_id': transfer.to_outlet_id,
            'from_outlet_name': from_outlet_name,
            'to_outlet_name': to_outlet_name,
            'status': TransferStatus.RECEIVED.value,
            'transfer_reason': transfer.transfer_reason,
            'total_items': total_items,
            'total_value': float(total_value),
            'requested_by': performed_by,
            'approved_by': performed_by,
            'received_by': performed_by,
            'notes': transfer.notes,
            'requested_at': now_iso,
            'approved_at': now_iso,
            'received_at': now_iso,
            'items': response_items
        }

        return InventoryTransferResponse(**transfer_response)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating inventory transfer: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create inventory transfer: {str(e)}"
        )


@router.get("/inventory/transfers")
async def list_inventory_transfers(
    outlet_id: Optional[str] = Query(None, description="Filter by outlet"),
    status_filter: Optional[TransferStatus] = Query(None, alias="status", description="Filter by status"),
    date_from: Optional[date] = Query(None, description="Start date"),
    date_to: Optional[date] = Query(None, description="End date"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(50, ge=1, le=200, description="Page size"),
    current_user=Depends(CurrentUser())
):
    """List inventory transfers derived from stock transfer movements."""
    try:
        supabase = get_supabase_admin()

        if status_filter and status_filter != TransferStatus.RECEIVED:
            return {'items': [], 'total': 0, 'page': page, 'size': size}

        query = supabase.table('pos_stock_movements').select('*').eq('reference_type', 'stock_transfer')
        if outlet_id:
            query = query.eq('outlet_id', outlet_id)
        if date_from:
            query = query.gte('movement_date', f"{date_from.isoformat()}T00:00:00")
        if date_to:
            end_exclusive = date_to + timedelta(days=1)
            query = query.lt('movement_date', f"{end_exclusive.isoformat()}T00:00:00")

        # Pull a bounded set and page after grouping by transfer reference.
        result = query.order('movement_date', desc=True).limit(2000).execute()
        movements = result.data or []
        if not movements:
            return {'items': [], 'total': 0, 'page': page, 'size': size}

        product_ids = {
            movement.get('product_id')
            for movement in movements
            if movement.get('product_id')
        }
        product_map: Dict[str, Dict[str, Any]] = {}
        if product_ids:
            products_result = supabase.table('pos_products').select('id,name,sku').in_(
                'id', list(product_ids)
            ).execute()
            product_map = {
                product.get('id'): product
                for product in (products_result.data or [])
                if product.get('id')
            }

        grouped: Dict[str, Dict[str, Any]] = {}
        for movement in movements:
            reference_id = movement.get('reference_id')
            if not reference_id:
                continue

            metadata = _safe_json_loads(movement.get('notes'))
            transfer = grouped.setdefault(reference_id, {
                'id': reference_id,
                'transfer_number': metadata.get('transfer_number') or f"TRF-{reference_id[:8].upper()}",
                'from_outlet_id': metadata.get('from_outlet_id'),
                'to_outlet_id': metadata.get('to_outlet_id'),
                'from_outlet_name': metadata.get('from_outlet_name') or 'Source Outlet',
                'to_outlet_name': metadata.get('to_outlet_name') or 'Destination Outlet',
                'status': metadata.get('status') or TransferStatus.RECEIVED.value,
                'transfer_reason': metadata.get('transfer_reason'),
                'requested_by': movement.get('performed_by') or 'system',
                'approved_by': movement.get('performed_by') or 'system',
                'received_by': movement.get('performed_by') or 'system',
                'notes': metadata.get('transfer_notes') or '',
                'requested_at': movement.get('movement_date'),
                'approved_at': movement.get('movement_date'),
                'received_at': movement.get('movement_date'),
                '_item_map': {}
            })

            movement_date = movement.get('movement_date')
            if movement_date and transfer['requested_at']:
                transfer['requested_at'] = min(transfer['requested_at'], movement_date)
            if movement_date and transfer['received_at']:
                transfer['received_at'] = max(transfer['received_at'], movement_date)

            movement_type = movement.get('movement_type')
            quantity = abs(int(movement.get('quantity_change') or 0))
            product_id = movement.get('product_id')
            if not product_id:
                continue

            product_meta = product_map.get(product_id, {})
            item_key = metadata.get('product_sku') or product_id
            item_map = transfer['_item_map']
            transfer_item = item_map.setdefault(item_key, {
                'id': str(uuid.uuid4()),
                'product_id': product_id,
                'product_name': metadata.get('product_name') or product_meta.get('name') or 'Product',
                'sku': metadata.get('product_sku') or product_meta.get('sku') or '',
                'quantity_requested': 0,
                'quantity_sent': 0,
                'quantity_received': 0,
                'unit_cost': movement.get('unit_cost'),
                'batch_number': None,
                'expiry_date': None,
                'notes': None
            })

            if movement_type == MovementType.TRANSFER_OUT.value:
                transfer_item['quantity_requested'] += quantity
                transfer_item['quantity_sent'] += quantity
                transfer['from_outlet_id'] = transfer['from_outlet_id'] or movement.get('outlet_id')
            elif movement_type == MovementType.TRANSFER_IN.value:
                transfer_item['quantity_received'] += quantity
                transfer['to_outlet_id'] = transfer['to_outlet_id'] or movement.get('outlet_id')

        transfer_items: List[Dict[str, Any]] = []
        for transfer in grouped.values():
            items = list(transfer.pop('_item_map').values())
            transfer['items'] = items
            transfer['total_items'] = sum(
                item['quantity_requested'] or item['quantity_received']
                for item in items
            )
            transfer['total_value'] = float(sum(
                (item.get('unit_cost') or 0) * (
                    item.get('quantity_sent')
                    or item.get('quantity_requested')
                    or item.get('quantity_received')
                    or 0
                )
                for item in items
            ))
            transfer_items.append(transfer)

        transfer_items.sort(
            key=lambda item: item.get('requested_at') or '',
            reverse=True
        )

        total = len(transfer_items)
        offset = (page - 1) * size
        paginated = transfer_items[offset: offset + size]

        # Validate payload shape against response schema for consistency.
        validated_items = [InventoryTransferResponse(**item).model_dump(mode='json') for item in paginated]

        return {
            'items': validated_items,
            'total': total,
            'page': page,
            'size': size
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing inventory transfers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list inventory transfers: {str(e)}"
        )


# ===============================================
# STATISTICS AND REPORTING ENDPOINTS
# ===============================================

@router.get("/stats/inventory", response_model=InventoryStatsResponse)
async def get_inventory_stats(
    outlet_id: str,
    current_user=Depends(CurrentUser())
):
    """Get inventory statistics"""
    try:
        supabase = get_supabase_admin()

        # Get inventory statistics
        result = supabase.table('pos_products').select('*').eq('outlet_id', outlet_id).execute()

        products = result.data or []

        total_products = len(products)
        active_products = len([p for p in products if p['is_active']])
        low_stock_count = len([p for p in products if p['quantity_on_hand'] <= p['reorder_level']])
        out_of_stock_count = len([p for p in products if p['quantity_on_hand'] == 0])

        # Calculate total inventory value
        total_value = sum(
            Decimal(str(p['quantity_on_hand'])) * Decimal(str(p['cost_price'] or 0))
            for p in products if p['cost_price']
        )

        return InventoryStatsResponse(
            total_products=total_products,
            active_products=active_products,
            low_stock_count=low_stock_count,
            out_of_stock_count=out_of_stock_count,
            total_inventory_value=total_value
        )

    except Exception as e:
        logger.error(f"Error fetching inventory stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch inventory stats: {str(e)}"
        )


@router.get("/stats/sales", response_model=SalesStatsResponse)
async def get_sales_stats(
    outlet_id: str,
    date_from: Optional[date] = Query(None, description="Start date"),
    date_to: Optional[date] = Query(None, description="End date"),
    current_user=Depends(CurrentUser())
):
    """Get sales statistics"""
    try:
        supabase = get_supabase_admin()

        # Default to today if no dates provided
        if not date_from:
            date_from = date.today()
        if not date_to:
            date_to = date.today()

        # Get transactions in date range
        query = supabase.table('pos_transactions').select(
            '*, pos_transaction_items(*, pos_products(name))'
        ).eq('outlet_id', outlet_id).eq('status', 'completed')

        query = query.gte('transaction_date', date_from.isoformat())
        query = query.lte('transaction_date', f"{date_to.isoformat()}T23:59:59")

        result = query.execute()
        transactions = result.data or []

        # Calculate statistics
        total_sales = sum(Decimal(str(tx['total_amount'])) for tx in transactions)
        transaction_count = len(transactions)
        avg_transaction_value = total_sales / transaction_count if transaction_count > 0 else Decimal(0)

        # Sales by payment method
        cash_sales = sum(
            Decimal(str(tx['total_amount'])) for tx in transactions
            if tx['payment_method'] == 'cash'
        )
        transfer_sales = sum(
            Decimal(str(tx['total_amount'])) for tx in transactions
            if tx['payment_method'] == 'transfer'
        )
        pos_sales = sum(
            Decimal(str(tx['total_amount'])) for tx in transactions
            if tx['payment_method'] == 'pos'
        )

        # Top products (simplified)
        top_products = []

        return SalesStatsResponse(
            total_sales=total_sales,
            transaction_count=transaction_count,
            avg_transaction_value=avg_transaction_value,
            cash_sales=cash_sales,
            transfer_sales=transfer_sales,
            pos_sales=pos_sales,
            top_products=top_products
        )

    except Exception as e:
        logger.error(f"Error fetching sales stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch sales stats: {str(e)}"
        )


# ===============================================
# HELD RECEIPT ENDPOINTS
# ===============================================

@router.post("/held-receipts", response_model=HeldReceiptResponse)
async def create_held_receipt(
    receipt: HeldReceiptCreate,
    current_user=Depends(CurrentUser())
):
    """Create a held receipt (put sale on hold)"""
    try:
        supabase = get_supabase_admin()
        
        # Get cashier name: POS uses staff_profile id, so try staff_profiles.display_name first, then users.name
        cashier_name = "Cashier"
        try:
            staff_result = supabase.table(Tables.STAFF_PROFILES).select('display_name').eq('id', receipt.cashier_id).execute()
            if staff_result.data and len(staff_result.data) > 0:
                cashier_name = staff_result.data[0].get('display_name') or cashier_name
            else:
                user_result = supabase.table('users').select('name').eq('id', receipt.cashier_id).execute()
                if user_result.data and len(user_result.data) > 0:
                    cashier_name = user_result.data[0].get('name') or cashier_name
        except Exception:
            pass
        
        # Prepare held receipt data (ensure JSON-serializable types)
        receipt_id = str(uuid.uuid4())

        # Serialize items with JSON-friendly types (e.g. Decimal -> float)
        try:
            items_json = [item.model_dump(mode="json") for item in receipt.items]
        except AttributeError:
            # Fallback for older Pydantic versions
            items_json = []
            for item in receipt.items:
                item_dict = item.dict()
                # Safely cast known numeric fields if present
                if "unit_price" in item_dict:
                    item_dict["unit_price"] = float(item_dict["unit_price"])
                if "discount" in item_dict:
                    item_dict["discount"] = float(item_dict["discount"])
                items_json.append(item_dict)

        receipt_data = {
            'id': receipt_id,
            'outlet_id': receipt.outlet_id,
            'cashier_id': receipt.cashier_id,
            'cashier_name': cashier_name,
            'items': items_json,
            'total': float(receipt.total),
            'saved_at': datetime.utcnow().isoformat(),
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Insert held receipt
        result = supabase.table(Tables.POS_HELD_RECEIPTS).insert(receipt_data).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create held receipt"
            )
        
        return HeldReceiptResponse(**result.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating held receipt: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create held receipt: {str(e)}"
        )


@router.get("/held-receipts", response_model=HeldReceiptListResponse)
async def get_held_receipts(
    outlet_id: str,
    current_user=Depends(CurrentUser())
):
    """Get all held receipts for an outlet"""
    try:
        supabase = get_supabase_admin()
        
        # Get held receipts for outlet
        result = supabase.table(Tables.POS_HELD_RECEIPTS)\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .order('saved_at', desc=True)\
            .execute()
        
        receipts = [HeldReceiptResponse(**r) for r in result.data] if result.data else []
        
        return HeldReceiptListResponse(
            receipts=receipts,
            total=len(receipts)
        )
        
    except Exception as e:
        logger.error(f"Error fetching held receipts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch held receipts: {str(e)}"
        )


@router.get("/held-receipts/{receipt_id}", response_model=HeldReceiptResponse)
async def get_held_receipt(
    receipt_id: str,
    current_user=Depends(CurrentUser())
):
    """Get a specific held receipt"""
    try:
        supabase = get_supabase_admin()
        
        result = supabase.table(Tables.POS_HELD_RECEIPTS)\
            .select('*')\
            .eq('id', receipt_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Held receipt not found"
            )
        
        return HeldReceiptResponse(**result.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching held receipt: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch held receipt: {str(e)}"
        )


@router.delete("/held-receipts/{receipt_id}")
async def delete_held_receipt(
    receipt_id: str,
    current_user=Depends(CurrentUser())
):
    """Delete a held receipt"""
    try:
        supabase = get_supabase_admin()
        
        # Check if receipt exists
        check_result = supabase.table(Tables.POS_HELD_RECEIPTS)\
            .select('id')\
            .eq('id', receipt_id)\
            .execute()
        
        if not check_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Held receipt not found"
            )
        
        # Delete receipt
        supabase.table(Tables.POS_HELD_RECEIPTS)\
            .delete()\
            .eq('id', receipt_id)\
            .execute()
        
        return {"message": "Held receipt deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting held receipt: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete held receipt: {str(e)}"
        )


@router.put("/transactions/{transaction_id}/return")
async def return_transaction(
    transaction_id: str,
    return_data: Dict[str, Any],
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Process a transaction return"""
    try:
        supabase = get_supabase_admin()

        return_reason = return_data.get('return_reason', 'Customer return')
        return_items = return_data.get('items', [])  # Specific items being returned
        return_amount = return_data.get('amount')    # Total return amount

        # Get original transaction
        tx_result = supabase.table('pos_transactions').select('*, pos_transaction_items(*)').eq('id', transaction_id).execute()
        if not tx_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Original transaction not found"
            )

        original_transaction = tx_result.data[0]
        actor_context = _require_manager_role(
            supabase,
            current_user,
            original_transaction.get('outlet_id'),
            x_pos_staff_session
        )
        actor_id = _resolve_actor_user_id(current_user)

        # Validate transaction can be returned
        if original_transaction['status'] not in ['completed']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot return a {original_transaction['status']} transaction"
            )

        # Get processor's name for display
        processor_name = current_user.get('name', 'Unknown')
        if actor_context.get('staff_profile_id'):
            staff_result = supabase.table(Tables.STAFF_PROFILES)\
                .select('display_name')\
                .eq('id', actor_context['staff_profile_id'])\
                .execute()
            if staff_result.data:
                processor_name = staff_result.data[0].get('display_name') or processor_name

        # Create return transaction as a negative transaction
        return_transaction_id = str(uuid.uuid4())
        return_transaction_number = f"RTN-{datetime.now().strftime('%Y%m%d')}-{return_transaction_id[:8].upper()}"

        # Prepare return transaction data
        return_transaction_data = {
            'id': return_transaction_id,
            'transaction_number': return_transaction_number,
            'outlet_id': original_transaction['outlet_id'],
            'cashier_id': actor_id,
            'cashier_name': processor_name,
            'customer_id': original_transaction.get('customer_id'),
            'customer_name': original_transaction.get('customer_name'),
            'subtotal': -float(return_amount or original_transaction['subtotal']),
            'tax_amount': -float(original_transaction['tax_amount']),
            'discount_amount': 0,
            'total_amount': -float(return_amount or original_transaction['total_amount']),
            'payment_method': 'cash',  # Returns typically processed as cash
            'tendered_amount': None,
            'change_amount': 0,
            'payment_reference': f"Return for {original_transaction['transaction_number']}",
            'status': TransactionStatus.COMPLETED.value,
            'receipt_type': 'return',
            'transaction_date': datetime.utcnow().isoformat(),
            'sync_status': SyncStatus.SYNCED.value,
            'notes': f"Return for transaction {original_transaction['transaction_number']}: {return_reason}",
            'receipt_printed': False,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        # Insert return transaction
        return_result = _insert_pos_transaction_compat(supabase, return_transaction_data)
        if not return_result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create return transaction"
            )

        # Update original transaction status to returned
        original_update = supabase.table('pos_transactions').update({
            'status': TransactionStatus.REFUNDED.value,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', transaction_id).execute()

        # Restore stock for returned items
        if original_transaction.get('pos_transaction_items'):
            for item in original_transaction['pos_transaction_items']:
                try:
                    # Get current stock
                    product_result = supabase.table('pos_products').select('quantity_on_hand').eq('id', item['product_id']).execute()
                    if product_result.data:
                        current_qty = product_result.data[0]['quantity_on_hand']
                        new_qty = current_qty + item['quantity']  # Restore returned quantity

                        # Update product quantity
                        supabase.table('pos_products').update({
                            'quantity_on_hand': new_qty,
                            'updated_at': datetime.utcnow().isoformat()
                        }).eq('id', item['product_id']).execute()

                        # Create stock movement record for return
                        movement_data = {
                            'id': str(uuid.uuid4()),
                            'product_id': item['product_id'],
                            'outlet_id': original_transaction['outlet_id'],
                            'movement_type': 'return',
                            'quantity_change': item['quantity'],
                            'quantity_before': current_qty,
                            'quantity_after': new_qty,
                            'reference_id': return_transaction_id,
                            'reference_type': 'return_transaction',
                            'performed_by': actor_id,
                            'movement_date': datetime.utcnow().isoformat(),
                            'notes': f'Stock restored from return: {return_reason}'
                        }
                        supabase.table('pos_stock_movements').insert(movement_data).execute()
                except Exception as stock_error:
                    logger.warning(f"Failed to restore stock for product {item['product_id']}: {stock_error}")

        return {
            "message": "Transaction returned successfully",
            "original_transaction_id": transaction_id,
            "return_transaction_id": return_transaction_id,
            "return_transaction_number": return_transaction_number,
            "return_amount": return_amount or original_transaction['total_amount']
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing return for transaction {transaction_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process return: {str(e)}"
        )


# ===============================================
# RECEIPT PRINTING ENDPOINTS
# ===============================================

@router.post("/receipts/{transaction_id}/print")
async def print_receipt(
    transaction_id: str,
    copies: int = Query(1, ge=1, le=3, description="Number of copies"),
    current_user=Depends(CurrentUser())
):
    """Print receipt for a transaction"""
    try:
        supabase = get_supabase_admin()
        
        # Get transaction with items
        tx_result = supabase.table('pos_transactions').select('*, pos_transaction_items(*)').eq('id', transaction_id).execute()
        if not tx_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )
        
        transaction = tx_result.data[0]
        
        # Get outlet info
        outlet_result = supabase.table('outlets').select('*').eq('id', transaction['outlet_id']).execute()
        outlet = outlet_result.data[0] if outlet_result.data else None

        # Get business settings (logo, tax number, business name)
        biz_settings = None
        if outlet:
            biz_result = supabase.table('business_settings').select('*').eq('outlet_id', outlet['id']).execute()
            biz_settings = biz_result.data[0] if biz_result.data else None

        # Get cashier info
        cashier_result = supabase.table('users').select('name').eq('id', transaction['cashier_id']).execute()
        cashier_name = cashier_result.data[0]['name'] if cashier_result.data else 'Cashier'

        # Determine currency symbol
        currency = (biz_settings or {}).get('currency', (outlet or {}).get('currency', 'NGN'))
        currency_symbol = {'NGN': '₦', 'USD': '$', 'GBP': '£', 'EUR': '€', 'GHS': '₵', 'KES': 'KSh'}.get(currency, currency + ' ')

        # Format amounts with currency
        def fmt(amount):
            return f"{currency_symbol}{amount:,.2f}"

        # Generate receipt content (formatted for thermal printer 58mm / 42 chars)
        W = 42
        receipt_lines = []
        receipt_lines.append("=" * W)

        # Business header
        biz_name = (biz_settings or {}).get('business_name') or (outlet or {}).get('name', 'STORE')
        receipt_lines.append(biz_name.center(W))
        if outlet and outlet.get('address'):
            addr = outlet['address']
            # In some environments, JSONB may come through as a string; normalize to dict
            if isinstance(addr, str):
                try:
                    addr = json.loads(addr) if addr else {}
                except Exception:
                    addr = {}
            if not isinstance(addr, dict):
                addr = {}
            street = addr.get('street', '')
            city = addr.get('city', '')
            state = addr.get('state', '')
            if street:
                receipt_lines.append(street.center(W))
            if city or state:
                receipt_lines.append(f"{city}{', ' + state if state else ''}".center(W))
        if outlet and outlet.get('phone'):
            receipt_lines.append(f"Tel: {outlet['phone']}".center(W))
        if outlet and outlet.get('email'):
            receipt_lines.append(outlet['email'].center(W))
        tax_number = (biz_settings or {}).get('tax_number')
        if tax_number:
            receipt_lines.append(f"TIN: {tax_number}".center(W))

        receipt_lines.append("=" * W)
        receipt_lines.append(f"Receipt: {transaction['transaction_number']}")
        try:
            tx_dt = datetime.fromisoformat(transaction['transaction_date'].replace('Z', '+00:00'))
            receipt_lines.append(f"Date: {tx_dt.strftime('%d/%m/%Y  %I:%M %p')}")
        except (ValueError, KeyError):
            receipt_lines.append(f"Date: {transaction.get('transaction_date', 'N/A')}")
        receipt_lines.append(f"Cashier: {cashier_name}")
        if transaction.get('customer_name'):
            receipt_lines.append(f"Customer: {transaction['customer_name']}")
        receipt_lines.append("-" * W)

        # Column header
        receipt_lines.append(f"{'Item':<20} {'Qty':>4} {'Price':>7} {'Total':>8}")
        receipt_lines.append("-" * W)

        # Items
        for item in transaction.get('pos_transaction_items', []):
            item_name = item['product_name'][:20]
            qty = float(item['quantity'])
            price = float(item['unit_price'])
            total = float(item['line_total'])
            # If name is long, put it on its own line
            if len(item['product_name']) > 20:
                receipt_lines.append(item['product_name'][:W])
                receipt_lines.append(f"{'':20} {qty:>4g} {price:>7,.2f} {total:>8,.2f}")
            else:
                receipt_lines.append(f"{item_name:<20} {qty:>4g} {price:>7,.2f} {total:>8,.2f}")

        receipt_lines.append("-" * W)
        receipt_lines.append(f"{'Subtotal:':<22} {fmt(transaction['subtotal']):>18}")
        if float(transaction.get('discount_amount', 0)) > 0:
            receipt_lines.append(f"{'Discount:':<22} {'-' + fmt(transaction['discount_amount']):>18}")
        if float(transaction.get('tax_amount', 0)) > 0:
            receipt_lines.append(f"{'Tax:':<22} {fmt(transaction['tax_amount']):>18}")
        receipt_lines.append("=" * W)
        receipt_lines.append(f"{'TOTAL:':<22} {fmt(transaction['total_amount']):>18}")
        receipt_lines.append("=" * W)

        # Payment details
        receipt_lines.append(f"Payment: {transaction['payment_method'].upper()}")
        if transaction.get('tendered_amount') and float(transaction.get('tendered_amount', 0)) > 0:
            receipt_lines.append(f"{'Tendered:':<22} {fmt(transaction['tendered_amount']):>18}")
            receipt_lines.append(f"{'Change:':<22} {fmt(transaction.get('change_amount', 0)):>18}")

        # Split payment info (stored in notes)
        if transaction.get('notes') and 'split' in str(transaction.get('notes', '')).lower():
            receipt_lines.append(f"({transaction['notes'][:W]})")

        receipt_lines.append("=" * W)
        receipt_lines.append("Thank you for your patronage!".center(W))
        receipt_lines.append(f"Powered by Compazz POS".center(W))
        receipt_lines.append("")
        receipt_lines.append("")
        
        # Mark receipt as printed
        supabase.table('pos_transactions').update({
            'receipt_printed': True,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', transaction_id).execute()
        
        # Return receipt data (frontend can handle printing via browser print dialog)
        receipt_content = "\n".join(receipt_lines)
        
        return {
            "message": "Receipt generated successfully",
            "transaction_id": transaction_id,
            "receipt_content": receipt_content,
            "copies": copies,
            "format": "thermal_58mm"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error printing receipt: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to print receipt: {str(e)}"
        )


@router.get("/receipts/{transaction_id}/preview")
async def preview_receipt(
    transaction_id: str,
    current_user=Depends(CurrentUser())
):
    """Preview receipt for a transaction"""
    try:
        supabase = get_supabase_admin()
        
        # Get transaction with items
        tx_result = supabase.table('pos_transactions').select('*, pos_transaction_items(*)').eq('id', transaction_id).execute()
        if not tx_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )
        
        transaction = tx_result.data[0]
        
        # Get outlet info
        outlet_result = supabase.table('outlets').select('*').eq('id', transaction['outlet_id']).execute()
        outlet = outlet_result.data[0] if outlet_result.data else None
        
        # Generate HTML preview
        receipt_html = f"""
        <div style="font-family: monospace; max-width: 300px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px;">
                <h2>{outlet['name'] if outlet else 'STORE'}</h2>
                <p>{outlet['address'].get('street', '') if outlet and outlet.get('address') else ''}</p>
                <p>{outlet['phone'] if outlet else 'N/A'}</p>
            </div>
            <div style="margin-bottom: 10px;">
                <p><strong>Receipt:</strong> {transaction['transaction_number']}</p>
                <p><strong>Date:</strong> {datetime.fromisoformat(transaction['transaction_date'].replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
            <div style="border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 10px 0; margin: 10px 0;">
                {''.join([f'<p>{item["product_name"]} - {item["quantity"]} x {item["unit_price"]:,.2f} = {item["line_total"]:,.2f}</p>' for item in transaction.get('pos_transaction_items', [])])}
            </div>
            <div style="text-align: right; margin-top: 10px;">
                <p>Subtotal: {transaction['subtotal']:,.2f}</p>
                {f'<p>Discount: {transaction["discount_amount"]:,.2f}</p>' if transaction['discount_amount'] > 0 else ''}
                <p>Tax: {transaction['tax_amount']:,.2f}</p>
                <p style="font-size: 1.2em; font-weight: bold; border-top: 2px solid #000; padding-top: 5px; margin-top: 5px;">TOTAL: {transaction['total_amount']:,.2f}</p>
            </div>
        </div>
        """
        
        return {
            "receipt_data": receipt_html,
            "format": "html"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing receipt: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to preview receipt: {str(e)}"
        )


# ===============================================
# CASH DRAWER MANAGEMENT ENDPOINTS
# ===============================================

@router.post("/cash-drawer/sessions", response_model=CashDrawerSessionResponse)
async def open_cash_drawer_session(
    session: CashDrawerSessionCreate,
    current_user=Depends(CurrentUser())
):
    """Open a new cash drawer session"""
    try:
        supabase = get_supabase_admin()
        
        # Check if there's an open session for this terminal
        existing_session = supabase.table(Tables.CASH_DRAWER_SESSIONS)\
            .select('*')\
            .eq('outlet_id', session.outlet_id)\
            .eq('terminal_id', session.terminal_id)\
            .eq('status', 'open')\
            .execute()
        
        if existing_session.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="There is already an open session for this terminal"
            )
        
        # Generate session number
        session_id = str(uuid.uuid4())
        session_number = f"SESSION-{datetime.now().strftime('%Y%m%d')}-{session_id[:8].upper()}"
        actor_user_id = _resolve_actor_user_id(current_user)

        if session.cashier_id and session.cashier_id != actor_user_id:
            logger.warning(
                "Ignoring client cash drawer cashier_id %s in favor of authenticated user %s",
                session.cashier_id,
                actor_user_id
            )

        session_data = {
            'id': session_id,
            'outlet_id': session.outlet_id,
            'terminal_id': session.terminal_id,
            'session_number': session_number,
            'cashier_id': actor_user_id,
            'opening_balance': float(session.opening_balance),
            'opening_notes': session.opening_notes,
            'cash_sales_total': 0.0,
            'cash_refunds_total': 0.0,
            'cash_paid_out': 0.0,
            'cash_paid_in': 0.0,
            'status': 'open',
            'opened_at': datetime.utcnow().isoformat(),
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        result = supabase.table(Tables.CASH_DRAWER_SESSIONS).insert(session_data).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create cash drawer session"
            )
        
        return CashDrawerSessionResponse(**result.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error opening cash drawer session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to open cash drawer session: {str(e)}"
        )


@router.get("/cash-drawer/sessions/active")
async def get_active_session(
    outlet_id: str,
    terminal_id: str,
    current_user=Depends(CurrentUser())
):
    """Get active cash drawer session for a terminal"""
    try:
        supabase = get_supabase_admin()
        
        result = supabase.table(Tables.CASH_DRAWER_SESSIONS)\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .eq('terminal_id', terminal_id)\
            .eq('status', 'open')\
            .order('opened_at', desc=True)\
            .limit(1)\
            .execute()
        
        if not result.data:
            return None
        
        return CashDrawerSessionResponse(**result.data[0])
        
    except Exception as e:
        logger.error(f"Error fetching active session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch active session: {str(e)}"
        )


@router.put("/cash-drawer/sessions/{session_id}/close", response_model=CashDrawerSessionResponse)
async def close_cash_drawer_session(
    session_id: str,
    close_data: CashDrawerSessionClose,
    current_user=Depends(CurrentUser())
):
    """Close a cash drawer session"""
    try:
        supabase = get_supabase_admin()
        
        # Get current session
        session_result = supabase.table(Tables.CASH_DRAWER_SESSIONS)\
            .select('*')\
            .eq('id', session_id)\
            .execute()
        
        if not session_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        session = session_result.data[0]
        
        if session['status'] != 'open':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session is not open"
            )
        
        # Calculate expected balance
        opening = Decimal(str(session['opening_balance']))
        cash_sales = Decimal(str(session.get('cash_sales_total', 0)))
        cash_refunds = Decimal(str(session.get('cash_refunds_total', 0)))
        paid_out = Decimal(str(session.get('cash_paid_out', 0)))
        paid_in = Decimal(str(session.get('cash_paid_in', 0)))
        
        expected_balance = opening + cash_sales - cash_refunds - paid_out + paid_in
        actual_balance = Decimal(str(close_data.actual_balance))
        variance = actual_balance - expected_balance
        
        # Update session
        update_data = {
            'actual_balance': float(actual_balance),
            'expected_balance': float(expected_balance),
            'variance': float(variance),
            'closing_notes': close_data.closing_notes,
            'status': 'closed',
            'closed_at': datetime.utcnow().isoformat(),
            'closed_by': current_user['id'],
            'updated_at': datetime.utcnow().isoformat()
        }
        
        result = supabase.table(Tables.CASH_DRAWER_SESSIONS)\
            .update(update_data)\
            .eq('id', session_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to close session"
            )
        
        return CashDrawerSessionResponse(**result.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error closing cash drawer session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to close cash drawer session: {str(e)}"
        )


# ===============================================
# EOD SALES BREAKDOWN ENDPOINTS
# ===============================================

@router.get("/sales-breakdown")
async def get_sales_breakdown(
    outlet_id: str,
    date_from: str = Query(..., description="Date from (YYYY-MM-DD)"),
    date_to: str = Query(..., description="Date to (YYYY-MM-DD)"),
    cashier_id: Optional[str] = Query(None, description="Filter by specific cashier"),
    current_user=Depends(CurrentUser())
):
    """Get detailed sales breakdown by payment method with cashier filtering for EOD reconciliation"""
    try:
        supabase = get_supabase_admin()

        # Build date filter
        date_filter = f"transaction_date.gte.{date_from}T00:00:00"
        date_filter_end = f"transaction_date.lt.{datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59).isoformat()}"

        # Build query
        query = supabase.table('pos_transactions')\
            .select('*, pos_transaction_items(*), users!pos_transactions_cashier_id_fkey(id, name)')\
            .eq('outlet_id', outlet_id)\
            .eq('status', 'completed')\
            .neq('is_voided', True)\
            .gte('transaction_date', f"{date_from}T00:00:00")\
            .lte('transaction_date', f"{date_to}T23:59:59")

        if cashier_id:
            query = query.eq('cashier_id', cashier_id)

        result = query.order('transaction_date', desc=False).execute()

        transactions = result.data or []

        # Initialize breakdown structure
        breakdown = {
            'summary': {
                'total_transactions': len(transactions),
                'total_amount': Decimal('0'),
                'cash_total': Decimal('0'),
                'pos_total': Decimal('0'),
                'transfer_total': Decimal('0'),
                'mobile_total': Decimal('0'),
                'total_tax': Decimal('0'),
                'total_discount': Decimal('0'),
            },
            'by_payment_method': {
                'cash': {'count': 0, 'amount': Decimal('0'), 'transactions': []},
                'pos': {'count': 0, 'amount': Decimal('0'), 'transactions': []},
                'transfer': {'count': 0, 'amount': Decimal('0'), 'transactions': []},
                'mobile': {'count': 0, 'amount': Decimal('0'), 'transactions': []},
            },
            'by_cashier': {},
            'by_hour': {},
            'transactions': []
        }

        # Process each transaction
        for tx in transactions:
            amount = Decimal(str(tx['total_amount']))
            payment_method = tx['payment_method'].lower()
            cashier_name = tx.get('users', {}).get('name', 'Unknown Cashier') if tx.get('users') else 'Unknown Cashier'
            cashier_id = tx['cashier_id']
            tx_date = datetime.fromisoformat(tx['transaction_date'].replace('Z', '+00:00'))
            hour = tx_date.hour

            # Update summary
            breakdown['summary']['total_amount'] += amount
            breakdown['summary']['total_tax'] += Decimal(str(tx.get('tax_amount', 0)))
            breakdown['summary']['total_discount'] += Decimal(str(tx.get('discount_amount', 0)))

            # Handle split payments stored in notes (if any)
            split_payments = None
            if tx.get('notes'):
                try:
                    notes_data = json.loads(tx['notes'])
                    if isinstance(notes_data, dict) and 'split_payments' in notes_data:
                        split_payments = notes_data['split_payments']
                except (json.JSONDecodeError, TypeError):
                    pass

            # Process payment methods
            if split_payments and len(split_payments) > 1:
                # Handle split payments
                for split in split_payments:
                    split_method = split['method'].lower()
                    split_amount = Decimal(str(split['amount']))

                    if split_method in breakdown['by_payment_method']:
                        breakdown['by_payment_method'][split_method]['amount'] += split_amount
                        breakdown['by_payment_method'][split_method]['count'] += 1

                        # Update summary totals
                        if split_method == 'cash':
                            breakdown['summary']['cash_total'] += split_amount
                        elif split_method == 'pos':
                            breakdown['summary']['pos_total'] += split_amount
                        elif split_method == 'transfer':
                            breakdown['summary']['transfer_total'] += split_amount
                        elif split_method == 'mobile':
                            breakdown['summary']['mobile_total'] += split_amount
            else:
                # Single payment method
                if payment_method in breakdown['by_payment_method']:
                    breakdown['by_payment_method'][payment_method]['amount'] += amount
                    breakdown['by_payment_method'][payment_method]['count'] += 1

                    # Update summary totals
                    if payment_method == 'cash':
                        breakdown['summary']['cash_total'] += amount
                    elif payment_method == 'pos':
                        breakdown['summary']['pos_total'] += amount
                    elif payment_method == 'transfer':
                        breakdown['summary']['transfer_total'] += amount
                    elif payment_method == 'mobile':
                        breakdown['summary']['mobile_total'] += amount

            # Group by cashier
            if cashier_id not in breakdown['by_cashier']:
                breakdown['by_cashier'][cashier_id] = {
                    'name': cashier_name,
                    'transaction_count': 0,
                    'total_amount': Decimal('0'),
                    'cash_amount': Decimal('0'),
                    'pos_amount': Decimal('0'),
                    'transfer_amount': Decimal('0'),
                    'mobile_amount': Decimal('0'),
                    'transactions': []
                }

            cashier_data = breakdown['by_cashier'][cashier_id]
            cashier_data['transaction_count'] += 1
            cashier_data['total_amount'] += amount

            # Add to cashier's payment method totals
            if split_payments and len(split_payments) > 1:
                for split in split_payments:
                    split_method = split['method'].lower()
                    split_amount = Decimal(str(split['amount']))
                    if split_method == 'cash':
                        cashier_data['cash_amount'] += split_amount
                    elif split_method == 'pos':
                        cashier_data['pos_amount'] += split_amount
                    elif split_method == 'transfer':
                        cashier_data['transfer_amount'] += split_amount
                    elif split_method == 'mobile':
                        cashier_data['mobile_amount'] += split_amount
            else:
                if payment_method == 'cash':
                    cashier_data['cash_amount'] += amount
                elif payment_method == 'pos':
                    cashier_data['pos_amount'] += amount
                elif payment_method == 'transfer':
                    cashier_data['transfer_amount'] += amount
                elif payment_method == 'mobile':
                    cashier_data['mobile_amount'] += amount

            # Group by hour
            hour_key = f"{hour:02d}:00"
            if hour_key not in breakdown['by_hour']:
                breakdown['by_hour'][hour_key] = {
                    'transaction_count': 0,
                    'total_amount': Decimal('0')
                }
            breakdown['by_hour'][hour_key]['transaction_count'] += 1
            breakdown['by_hour'][hour_key]['total_amount'] += amount

            # Add transaction to appropriate payment method list
            tx_summary = {
                'id': tx['id'],
                'transaction_number': tx['transaction_number'],
                'amount': float(amount),
                'payment_method': payment_method,
                'split_payments': split_payments,
                'cashier_name': cashier_name,
                'transaction_date': tx['transaction_date'],
                'items_count': len(tx.get('pos_transaction_items', [])),
                'customer_name': tx.get('customer_name')
            }

            if split_payments and len(split_payments) > 1:
                # Add to all relevant payment methods for split payments
                for split in split_payments:
                    split_method = split['method'].lower()
                    if split_method in breakdown['by_payment_method']:
                        breakdown['by_payment_method'][split_method]['transactions'].append(tx_summary)
            else:
                if payment_method in breakdown['by_payment_method']:
                    breakdown['by_payment_method'][payment_method]['transactions'].append(tx_summary)

            cashier_data['transactions'].append(tx_summary)
            breakdown['transactions'].append(tx_summary)

        # Convert Decimals to floats for JSON serialization
        def convert_decimals(obj):
            if isinstance(obj, dict):
                return {k: convert_decimals(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_decimals(item) for item in obj]
            elif isinstance(obj, Decimal):
                return float(obj)
            return obj

        breakdown = convert_decimals(breakdown)

        return {
            'date_from': date_from,
            'date_to': date_to,
            'outlet_id': outlet_id,
            'cashier_id': cashier_id,
            'breakdown': breakdown
        }

    except Exception as e:
        logger.error(f"Error getting sales breakdown: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sales breakdown: {str(e)}"
        )


# ===============================================
# CUSTOMER MANAGEMENT ENDPOINTS
# ===============================================


def _normalize_customer_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize customer row shape for API responses."""
    normalized = dict(row or {})
    now_iso = datetime.utcnow().isoformat()

    address_value = normalized.get('address')
    if isinstance(address_value, str):
        trimmed = address_value.strip()
        if trimmed.startswith('{') and trimmed.endswith('}'):
            try:
                parsed = json.loads(trimmed)
                if isinstance(parsed, dict):
                    normalized['address'] = parsed.get('address') or parsed.get('full_address') or trimmed
            except Exception:
                normalized['address'] = address_value
    elif isinstance(address_value, dict):
        normalized['address'] = address_value.get('address') or address_value.get('full_address')

    normalized['loyalty_points'] = int(normalized.get('loyalty_points') or 0)
    normalized['total_spent'] = float(normalized.get('total_spent') or 0)
    normalized['visit_count'] = int(normalized.get('visit_count') or 0)
    normalized['is_active'] = True if normalized.get('is_active') is None else bool(normalized.get('is_active'))
    normalized['created_at'] = normalized.get('created_at') or now_iso
    normalized['updated_at'] = normalized.get('updated_at') or now_iso
    return normalized


@router.get("/customers")
async def get_customers(
    outlet_id: str,
    skip: int = Query(0, ge=0, description="Rows to skip"),
    limit: int = Query(50, ge=1, le=500, description="Maximum rows to return"),
    active_only: bool = Query(True, description="Filter active customers"),
    search: Optional[str] = Query(None, description="Search by name or phone"),
    current_user=Depends(CurrentUser())
):
    """Get paginated customers for an outlet."""
    try:
        supabase = get_supabase_admin()

        def apply_filters(query_builder):
            query_builder = query_builder.eq('outlet_id', outlet_id)
            if active_only:
                query_builder = query_builder.eq('is_active', True)
            if search and search.strip():
                term = search.strip().replace(',', ' ')
                query_builder = query_builder.or_(
                    f"name.ilike.%{term}%,phone.ilike.%{term}%"
                )
            return query_builder

        total_result = apply_filters(supabase.table('customers').select('id')).execute()
        total = len(total_result.data) if total_result.data else 0

        end_index = skip + limit - 1
        rows_result = apply_filters(supabase.table('customers').select('*'))\
            .order('created_at', desc=True)\
            .range(skip, end_index)\
            .execute()

        items = [_normalize_customer_row(row) for row in (rows_result.data or [])]
        page = (skip // limit) + 1
        return {
            'items': items,
            'total': total,
            'page': page,
            'size': limit
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching customers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch customers: {str(e)}"
        )

@router.get("/customers/search")
async def search_customers(
    outlet_id: str,
    query: str = Query(..., min_length=1, description="Search by name or phone"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results"),
    current_user=Depends(CurrentUser())
):
    """Search customers by name or phone number"""
    try:
        supabase = get_supabase_admin()
        
        # Search in customers table
        result = supabase.table('customers')\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .or_(f"name.ilike.%{query}%,phone.ilike.%{query}%")\
            .limit(limit)\
            .execute()
        
        return result.data or []
        
    except Exception as e:
        logger.error(f"Error searching customers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search customers: {str(e)}"
        )


@router.get("/customers/{customer_id}")
async def get_customer(
    customer_id: str,
    current_user=Depends(CurrentUser())
):
    """Get a customer by ID."""
    try:
        supabase = get_supabase_admin()
        result = supabase.table('customers').select('*').eq('id', customer_id).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        return _normalize_customer_row(result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching customer {customer_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch customer: {str(e)}"
        )


@router.post("/customers")
async def create_customer(
    customer: Optional[Dict[str, Any]] = Body(None),
    outlet_id: Optional[str] = Query(None, description="Outlet ID (legacy mode)"),
    name: Optional[str] = Query(None, description="Customer name (legacy mode)"),
    phone: Optional[str] = Query(None, description="Customer phone (legacy mode)"),
    email: Optional[str] = Query(None, description="Customer email (legacy mode)"),
    address: Optional[str] = Query(None, description="Customer address (legacy mode)"),
    current_user=Depends(CurrentUser())
):
    """Create a new customer (JSON body preferred; query params kept for backward compatibility)."""
    try:
        supabase = get_supabase_admin()

        if customer:
            payload = dict(customer)
        else:
            if not outlet_id or not name or not phone:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Provide customer payload in request body or outlet_id/name/phone query params."
                )
            payload = {
                'outlet_id': outlet_id,
                'name': name,
                'phone': phone,
                'email': email,
                'address': address
            }

        payload['outlet_id'] = str(payload.get('outlet_id') or '').strip()
        payload['name'] = str(payload.get('name') or '').strip()
        payload['phone'] = str(payload.get('phone') or '').strip()
        if not payload['outlet_id'] or not payload['name'] or not payload['phone']:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="outlet_id, name and phone are required"
            )

        # Check if customer with phone already exists
        existing = supabase.table('customers')\
            .select('id')\
            .eq('outlet_id', payload['outlet_id'])\
            .eq('phone', payload['phone'])\
            .execute()

        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer with this phone number already exists"
            )

        customer_data = {
            'id': str(uuid.uuid4()),
            'outlet_id': payload['outlet_id'],
            'name': payload['name'],
            'phone': payload['phone'],
            'email': payload.get('email'),
            'address': payload.get('address'),
            'customer_type': 'regular',
            'loyalty_points': 0,
            'total_spent': 0.0,
            'visit_count': 0,
            'is_active': True,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        result = supabase.table('customers').insert(customer_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create customer"
            )

        return _normalize_customer_row(result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating customer: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create customer: {str(e)}"
        )


# ===============================================
# STAFF PROFILE MANAGEMENT ENDPOINTS
# ===============================================

@router.post("/staff", response_model=StaffProfileResponse)
async def create_staff_profile(
    staff_data: StaffProfileCreate,
    current_user=Depends(CurrentUser())
):
    """Create a new staff profile with PIN authentication"""
    try:
        # Only business owners and outlet admins can create staff profiles
        if current_user.get("role") not in ["business_owner", "outlet_admin", "super_admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only business owners and outlet admins can create staff profiles"
            )

        staff_profile = await StaffService.create_staff_profile(
            parent_account_id=current_user["id"],
            staff_data=staff_data
        )

        return staff_profile

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating staff profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create staff profile: {str(e)}"
        )


@router.get("/staff", response_model=StaffProfileListResponse)
async def get_staff_profiles(
    outlet_id: Optional[str] = Query(None, description="Filter by outlet"),
    active_only: bool = Query(True, description="Show only active staff"),
    current_user=Depends(CurrentUser())
):
    """Get staff profiles for the current user's account"""
    try:
        profiles = await StaffService.get_staff_profiles(
            parent_account_id=current_user["id"],
            outlet_id=outlet_id,
            active_only=active_only
        )

        return StaffProfileListResponse(
            profiles=profiles,
            total=len(profiles)
        )

    except Exception as e:
        logger.error(f"Error fetching staff profiles: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch staff profiles: {str(e)}"
        )


@router.get("/staff/{profile_id}", response_model=StaffProfileResponse)
async def get_staff_profile(
    profile_id: str,
    current_user=Depends(CurrentUser())
):
    """Get a specific staff profile"""
    try:
        profile = await StaffService.get_staff_profile(profile_id)

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff profile not found"
            )

        # Ensure the profile belongs to the current user or they're a super admin
        if (profile.parent_account_id != current_user["id"] and
            current_user.get("role") != "super_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this staff profile"
            )

        return profile

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching staff profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch staff profile: {str(e)}"
        )


@router.put("/staff/{profile_id}", response_model=StaffProfileResponse)
async def update_staff_profile(
    profile_id: str,
    update_data: StaffProfileUpdate,
    current_user=Depends(CurrentUser())
):
    """Update a staff profile"""
    try:
        # Check if profile exists and belongs to current user
        profile = await StaffService.get_staff_profile(profile_id)

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff profile not found"
            )

        if (profile.parent_account_id != current_user["id"] and
            current_user.get("role") != "super_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this staff profile"
            )

        updated_profile = await StaffService.update_staff_profile(profile_id, update_data)

        if not updated_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update staff profile"
            )

        return updated_profile

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating staff profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update staff profile: {str(e)}"
        )


@router.delete("/staff/{profile_id}")
async def delete_staff_profile(
    profile_id: str,
    current_user=Depends(CurrentUser())
):
    """Delete (deactivate) a staff profile"""
    try:
        # Check if profile exists and belongs to current user
        profile = await StaffService.get_staff_profile(profile_id)

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff profile not found"
            )

        if (profile.parent_account_id != current_user["id"] and
            current_user.get("role") != "super_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this staff profile"
            )

        success = await StaffService.delete_staff_profile(profile_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to delete staff profile"
            )

        return {"message": "Staff profile deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting staff profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete staff profile: {str(e)}"
        )


@router.post("/staff/reset-attempts/{profile_id}")
async def reset_failed_attempts(
    profile_id: str,
    current_user=Depends(CurrentUser())
):
    """Reset failed login attempts for a staff profile"""
    try:
        # Check if profile exists and belongs to current user
        profile = await StaffService.get_staff_profile(profile_id)

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff profile not found"
            )

        if (profile.parent_account_id != current_user["id"] and
            current_user.get("role") != "super_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this staff profile"
            )

        success = await StaffService.reset_failed_attempts(profile_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to reset failed attempts"
            )

        return {"message": "Failed login attempts reset successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting failed attempts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset failed attempts: {str(e)}"
        )


# ===============================================
# PIN AUTHENTICATION ENDPOINTS
# ===============================================

@router.post("/auth/pin", response_model=StaffAuthResponse)
async def authenticate_with_pin(auth_data: StaffPinAuth):
    """Authenticate staff member with PIN"""
    try:
        auth_result = await StaffService.authenticate_staff(
            auth_data.staff_code,
            auth_data.pin,
            auth_data.outlet_id
        )

        if not auth_result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid staff code or PIN, or account is locked"
            )

        return StaffAuthResponse(
            staff_profile=StaffProfileResponse(**auth_result['profile']),
            session_token=auth_result['session_token'],
            expires_at=auth_result['expires_at']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error authenticating with PIN: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )


# ===============================================
# RECEIPT SETTINGS ENDPOINTS
# ===============================================

def _normalize_receipt_settings_row(row: Dict[str, Any], outlet_id: str) -> Dict[str, Any]:
    """
    Ensure receipt settings row has all required fields for ReceiptSettingsResponse.
    This prevents 500s if the DB row is missing columns or contains NULLs.
    """
    now = datetime.utcnow().isoformat()
    # Use existing timestamps if present; otherwise default.
    created_at = row.get('created_at') or now
    updated_at = row.get('updated_at') or now

    return {
        'id': row.get('id') or str(uuid.uuid4()),
        'outlet_id': row.get('outlet_id') or outlet_id,
        'header_text': row.get('header_text'),
        'footer_text': row.get('footer_text'),
        'logo_url': row.get('logo_url'),
        'show_qr_code': True if row.get('show_qr_code') is None else row.get('show_qr_code'),
        'show_customer_points': True if row.get('show_customer_points') is None else row.get('show_customer_points'),
        'show_tax_breakdown': True if row.get('show_tax_breakdown') is None else row.get('show_tax_breakdown'),
        'receipt_width': row.get('receipt_width') or 58,
        'font_size': row.get('font_size') or 'normal',
        'created_at': created_at,
        'updated_at': updated_at,
    }

@router.get("/receipt-settings/{outlet_id}", response_model=ReceiptSettingsResponse)
async def get_receipt_settings(
    outlet_id: str,
    current_user=Depends(CurrentUser())
):
    """Get receipt customization settings for outlet"""
    try:
        supabase = get_supabase_admin()
        
        # Try to get existing settings
        result = supabase.table(Tables.RECEIPT_SETTINGS)\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .execute()
        
        if result.data and len(result.data) > 0:
            settings_data = _normalize_receipt_settings_row(result.data[0], outlet_id)
            return ReceiptSettingsResponse(**settings_data)
        
        # Return default settings if none exist
        default_settings = _normalize_receipt_settings_row({}, outlet_id)
        return ReceiptSettingsResponse(**default_settings)
        
    except Exception as e:
        logger.error(f"Error fetching receipt settings: {e}")
        # Helpful hint if the table isn't deployed yet
        if "receipt_settings" in str(e) and ("does not exist" in str(e) or "42P01" in str(e)):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="receipt_settings table is missing in the database. Create it in Supabase, then retry."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch receipt settings: {str(e)}"
        )

@router.put("/receipt-settings/{outlet_id}", response_model=ReceiptSettingsResponse)
async def update_receipt_settings(
    outlet_id: str,
    settings_update: ReceiptSettingsUpdate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Update receipt customization settings for outlet"""
    try:
        supabase = get_supabase_admin()
        _require_manager_role(supabase, current_user, outlet_id, x_pos_staff_session)
        
        # Check if settings exist
        existing = supabase.table(Tables.RECEIPT_SETTINGS)\
            .select('id')\
            .eq('outlet_id', outlet_id)\
            .execute()
        
        update_data = {
            'outlet_id': outlet_id,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Only include fields that are provided (not None)
        if settings_update.header_text is not None:
            update_data['header_text'] = settings_update.header_text
        if settings_update.footer_text is not None:
            update_data['footer_text'] = settings_update.footer_text
        if settings_update.logo_url is not None:
            update_data['logo_url'] = settings_update.logo_url
        if settings_update.show_qr_code is not None:
            update_data['show_qr_code'] = settings_update.show_qr_code
        if settings_update.show_customer_points is not None:
            update_data['show_customer_points'] = settings_update.show_customer_points
        if settings_update.show_tax_breakdown is not None:
            update_data['show_tax_breakdown'] = settings_update.show_tax_breakdown
        if settings_update.receipt_width is not None:
            update_data['receipt_width'] = settings_update.receipt_width
        if settings_update.font_size is not None:
            update_data['font_size'] = settings_update.font_size
        
        if existing.data and len(existing.data) > 0:
            # Update existing
            result = supabase.table(Tables.RECEIPT_SETTINGS)\
                .update(update_data)\
                .eq('outlet_id', outlet_id)\
                .execute()
        else:
            # Create new
            update_data['id'] = str(uuid.uuid4())
            update_data['created_at'] = datetime.utcnow().isoformat()
            # Set defaults for fields not provided
            if 'show_qr_code' not in update_data:
                update_data['show_qr_code'] = True
            if 'show_customer_points' not in update_data:
                update_data['show_customer_points'] = True
            if 'show_tax_breakdown' not in update_data:
                update_data['show_tax_breakdown'] = True
            if 'receipt_width' not in update_data:
                update_data['receipt_width'] = 58
            if 'font_size' not in update_data:
                update_data['font_size'] = 'normal'
            
            result = supabase.table(Tables.RECEIPT_SETTINGS)\
                .insert(update_data)\
                .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to save receipt settings"
            )
        
        saved = _normalize_receipt_settings_row(result.data[0], outlet_id)
        return ReceiptSettingsResponse(**saved)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating receipt settings: {e}")
        if "receipt_settings" in str(e) and ("does not exist" in str(e) or "42P01" in str(e)):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="receipt_settings table is missing in the database. Create it in Supabase, then retry."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update receipt settings: {str(e)}"
        )


# ===============================================
# OUTLET BUSINESS INFO ENDPOINTS (for Settings sync)
# ===============================================

@router.get("/outlets/{outlet_id}")
async def get_outlet_info(
    outlet_id: str,
    current_user=Depends(CurrentUser())
):
    """Get outlet business information (name, address, phone, etc.)"""
    try:
        supabase = get_supabase_admin()
        
        result = supabase.table(Tables.OUTLETS)\
            .select('*')\
            .eq('id', outlet_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Outlet not found"
            )
        
        return result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching outlet info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch outlet info: {str(e)}"
        )

@router.put("/outlets/{outlet_id}")
async def update_outlet_info(
    outlet_id: str,
    outlet_data: Dict[str, Any],
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Update outlet business information (address, phone, email, website, etc.)"""
    try:
        supabase = get_supabase_admin()
        _require_manager_role(supabase, current_user, outlet_id, x_pos_staff_session)
        
        # Only allow updating specific fields for business info
        allowed_fields = ['name', 'phone', 'email', 'website', 'address']
        update_data = {
            'updated_at': datetime.utcnow().isoformat()
        }
        
        for field in allowed_fields:
            if field in outlet_data:
                update_data[field] = outlet_data[field]
        
        result = supabase.table(Tables.OUTLETS)\
            .update(update_data)\
            .eq('id', outlet_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Outlet not found"
            )
        
        return result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating outlet info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update outlet info: {str(e)}"
        )


@router.get("/staff/outlet/{outlet_id}", response_model=StaffProfileListResponse)
async def get_outlet_staff(outlet_id: str):
    """Get all active staff for an outlet (public endpoint for POS systems)"""
    try:
        profiles = await StaffService.get_staff_by_outlet(outlet_id)

        return StaffProfileListResponse(
            profiles=profiles,
            total=len(profiles)
        )

    except Exception as e:
        logger.error(f"Error fetching outlet staff: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch outlet staff: {str(e)}"
        )
