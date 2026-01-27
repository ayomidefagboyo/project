"""
POS System API Endpoints
Nigerian Supermarket Focus
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
from datetime import datetime, date
import uuid
import logging
from decimal import Decimal

from app.core.database import get_supabase_admin
from app.core.security import CurrentUser
from app.schemas.pos import (
    # Products
    POSProductCreate, POSProductUpdate, POSProductResponse,
    ProductListResponse, ProductSearchRequest,
    # Transactions
    POSTransactionCreate, POSTransactionResponse,
    TransactionListResponse, TransactionSearchRequest,
    # Inventory
    StockMovementCreate, StockMovementResponse,
    # Cash Drawer
    CashDrawerSessionCreate, CashDrawerSessionClose, CashDrawerSessionResponse,
    # Statistics
    InventoryStatsResponse, SalesStatsResponse,
    # Base types
    PaymentMethod, TransactionStatus, MovementType, SyncStatus
)

router = APIRouter()
logger = logging.getLogger(__name__)


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
    active_only: bool = Query(True, description="Show only active products"),
    current_user=Depends(CurrentUser())
):
    """Get products for POS with pagination and filtering"""
    try:
        supabase = get_supabase_admin()

        # Build query
        query = supabase.table('pos_products').select('*').eq('outlet_id', outlet_id)

        if active_only:
            query = query.eq('is_active', True)

        if category:
            query = query.eq('category', category)

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
    current_user=Depends(CurrentUser())
):
    """Create a new product"""
    try:
        supabase = get_supabase_admin()

        # Generate product ID
        product_id = str(uuid.uuid4())

        # Prepare product data
        product_data = {
            'id': product_id,
            **product.dict(),
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
    current_user=Depends(CurrentUser())
):
    """Update a product"""
    try:
        supabase = get_supabase_admin()

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
    current_user=Depends(CurrentUser())
):
    """Delete a product (soft delete by setting inactive)"""
    try:
        supabase = get_supabase_admin()

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
    current_user=Depends(CurrentUser())
):
    """Process a new POS transaction"""
    try:
        supabase = get_supabase_admin()

        # Generate transaction ID and number
        transaction_id = str(uuid.uuid4())
        transaction_number = f"TXN-{datetime.now().strftime('%Y%m%d')}-{transaction_id[:8].upper()}"

        # Calculate totals
        subtotal = Decimal(0)
        tax_amount = Decimal(0)
        total_amount = Decimal(0)

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

            # Use provided price or product price
            unit_price = item.unit_price if item.unit_price else Decimal(str(product['unit_price']))

            # Calculate line totals
            line_subtotal = unit_price * item.quantity
            line_discount = item.discount_amount
            line_tax = (line_subtotal - line_discount) * Decimal(str(product['tax_rate']))
            line_total = line_subtotal - line_discount + line_tax

            # Add to transaction totals
            subtotal += line_subtotal
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

        # Apply transaction discount
        total_amount -= transaction.discount_amount

        # Calculate change for cash payments
        change_amount = Decimal(0)
        if transaction.payment_method == PaymentMethod.CASH and transaction.tendered_amount:
            change_amount = transaction.tendered_amount - total_amount
            if change_amount < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Insufficient payment amount"
                )

        # Prepare transaction data
        transaction_data = {
            'id': transaction_id,
            'transaction_number': transaction_number,
            'outlet_id': transaction.outlet_id,
            'cashier_id': transaction.cashier_id,
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
            'transaction_date': datetime.utcnow().isoformat(),
            'sync_status': SyncStatus.SYNCED.value,
            'offline_id': transaction.offline_id,
            'notes': transaction.notes,
            'receipt_printed': False,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        # Insert transaction
        tx_result = supabase.table('pos_transactions').insert(transaction_data).execute()
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
    size: int = Query(50, ge=1, le=200, description="Page size"),
    date_from: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    cashier_id: Optional[str] = Query(None, description="Filter by cashier"),
    payment_method: Optional[PaymentMethod] = Query(None, description="Filter by payment method"),
    current_user=Depends(CurrentUser())
):
    """Get transactions with filtering and pagination"""
    try:
        supabase = get_supabase_admin()

        # Build query
        query = supabase.table('pos_transactions').select('*, pos_transaction_items(*)').eq('outlet_id', outlet_id)

        if date_from:
            query = query.gte('transaction_date', date_from.isoformat())
        if date_to:
            query = query.lte('transaction_date', date_to.isoformat())
        if cashier_id:
            query = query.eq('cashier_id', cashier_id)
        if payment_method:
            query = query.eq('payment_method', payment_method.value)

        # Get total count
        count_result = query.execute()
        total = len(count_result.data) if count_result.data else 0

        # Apply pagination and ordering
        offset = (page - 1) * size
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

        # Get transaction with items
        result = supabase.table('pos_transactions').select('*, pos_transaction_items(*)').eq('id', transaction_id).execute()

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
    void_reason: str,
    current_user=Depends(CurrentUser())
):
    """Void a transaction"""
    try:
        supabase = get_supabase_admin()

        result = supabase.table('pos_transactions').update({
            'is_voided': True,
            'voided_by': current_user['id'],
            'voided_at': datetime.utcnow().isoformat(),
            'void_reason': void_reason,
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
    current_user=Depends(CurrentUser())
):
    """Create manual stock adjustment"""
    try:
        supabase = get_supabase_admin()

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
            'performed_by': movement.performed_by,
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