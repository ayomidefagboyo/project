"""
Pydantic schemas for POS system data validation
Nigerian Supermarket Focus
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
from decimal import Decimal


# ===============================================
# ENUMS
# ===============================================

class PaymentMethod(str, Enum):
    """Payment methods for Nigerian supermarkets"""
    CASH = "cash"
    TRANSFER = "transfer"
    POS = "pos"
    CREDIT = "credit"
    MOBILE = "mobile"


class TransactionStatus(str, Enum):
    """Transaction status"""
    PENDING = "pending"
    COMPLETED = "completed"
    VOIDED = "voided"
    REFUNDED = "refunded"


class MovementType(str, Enum):
    """Stock movement types"""
    SALE = "sale"
    RETURN = "return"
    ADJUSTMENT = "adjustment"
    TRANSFER_IN = "transfer_in"
    TRANSFER_OUT = "transfer_out"
    RECEIVE = "receive"


class SyncStatus(str, Enum):
    """Synchronization status"""
    PENDING = "pending"
    SYNCING = "syncing"
    SYNCED = "synced"
    FAILED = "failed"


# ===============================================
# PRODUCT SCHEMAS
# ===============================================

class POSProductBase(BaseModel):
    """Base product schema"""
    sku: str = Field(..., min_length=1, max_length=100, description="Stock Keeping Unit")
    barcode: Optional[str] = Field(None, max_length=100, description="Product barcode")
    name: str = Field(..., min_length=1, max_length=255, description="Product name")
    description: Optional[str] = Field(None, description="Product description")
    category: Optional[str] = Field(None, max_length=100, description="Product category")
    unit_price: Decimal = Field(..., gt=0, description="Selling price in Naira")
    cost_price: Optional[Decimal] = Field(None, ge=0, description="Cost price in Naira")
    tax_rate: Decimal = Field(0.075, ge=0, le=1, description="Tax rate (default 7.5% VAT)")
    quantity_on_hand: int = Field(0, ge=0, description="Current inventory quantity")
    reorder_level: int = Field(10, ge=0, description="Reorder alert level")
    reorder_quantity: int = Field(50, ge=0, description="Suggested reorder quantity")
    is_active: bool = Field(True, description="Whether product is active for sale")
    vendor_id: Optional[str] = Field(None, description="Supplier vendor ID")
    image_url: Optional[str] = Field(None, description="Product image URL")
    display_order: int = Field(0, description="Display order in POS")

    @validator('unit_price', 'cost_price')
    def validate_prices(cls, v):
        if v is not None and v < 0:
            raise ValueError('Prices cannot be negative')
        return v

    @validator('sku')
    def validate_sku(cls, v):
        if not v or not v.strip():
            raise ValueError('SKU cannot be empty')
        return v.upper().strip()

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Product name cannot be empty')
        return v.strip()


class POSProductCreate(POSProductBase):
    """Schema for creating a new product"""
    outlet_id: str = Field(..., description="Outlet ID")


class POSProductUpdate(BaseModel):
    """Schema for updating a product"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    unit_price: Optional[Decimal] = Field(None, gt=0)
    cost_price: Optional[Decimal] = Field(None, ge=0)
    tax_rate: Optional[Decimal] = Field(None, ge=0, le=1)
    quantity_on_hand: Optional[int] = Field(None, ge=0)
    reorder_level: Optional[int] = Field(None, ge=0)
    reorder_quantity: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    vendor_id: Optional[str] = None
    image_url: Optional[str] = None
    display_order: Optional[int] = None


class POSProductResponse(POSProductBase):
    """Schema for product response"""
    id: str = Field(..., description="Product unique identifier")
    outlet_id: str = Field(..., description="Outlet identifier")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


# ===============================================
# TRANSACTION SCHEMAS
# ===============================================

class TransactionItemCreate(BaseModel):
    """Schema for creating transaction items"""
    product_id: str = Field(..., description="Product ID")
    quantity: int = Field(..., gt=0, description="Quantity sold")
    unit_price: Optional[Decimal] = Field(None, description="Override price (optional)")
    discount_amount: Decimal = Field(0, ge=0, description="Item discount")


class TransactionItemResponse(BaseModel):
    """Schema for transaction item response"""
    id: str = Field(..., description="Item unique identifier")
    product_id: str = Field(..., description="Product ID")
    sku: str = Field(..., description="Product SKU")
    product_name: str = Field(..., description="Product name")
    quantity: int = Field(..., description="Quantity sold")
    unit_price: Decimal = Field(..., description="Unit price")
    discount_amount: Decimal = Field(..., description="Discount applied")
    tax_amount: Decimal = Field(..., description="Tax amount")
    line_total: Decimal = Field(..., description="Line total amount")

    class Config:
        from_attributes = True


class POSTransactionCreate(BaseModel):
    """Schema for creating a POS transaction"""
    outlet_id: str = Field(..., description="Outlet ID")
    cashier_id: str = Field(..., description="Cashier user ID")
    customer_id: Optional[str] = Field(None, description="Customer ID (optional)")
    customer_name: Optional[str] = Field(None, max_length=255, description="Customer name for receipt")
    items: List[TransactionItemCreate] = Field(..., min_items=1, description="Transaction items")
    payment_method: PaymentMethod = Field(..., description="Payment method")
    tendered_amount: Optional[Decimal] = Field(None, ge=0, description="Amount tendered (for cash)")
    payment_reference: Optional[str] = Field(None, max_length=100, description="Payment reference")
    discount_amount: Decimal = Field(0, ge=0, description="Total transaction discount")
    notes: Optional[str] = Field(None, description="Transaction notes")
    offline_id: Optional[str] = Field(None, description="Offline transaction ID")

    @validator('tendered_amount')
    def validate_tendered_amount(cls, v, values):
        if values.get('payment_method') == PaymentMethod.CASH and v is None:
            raise ValueError('Tendered amount required for cash payments')
        return v


class POSTransactionResponse(BaseModel):
    """Schema for transaction response"""
    id: str = Field(..., description="Transaction unique identifier")
    outlet_id: str = Field(..., description="Outlet identifier")
    transaction_number: str = Field(..., description="Transaction number")
    cashier_id: str = Field(..., description="Cashier ID")
    customer_id: Optional[str] = Field(None, description="Customer ID")
    customer_name: Optional[str] = Field(None, description="Customer name")
    subtotal: Decimal = Field(..., description="Subtotal amount")
    tax_amount: Decimal = Field(..., description="Tax amount")
    discount_amount: Decimal = Field(..., description="Discount amount")
    total_amount: Decimal = Field(..., description="Total amount")
    payment_method: PaymentMethod = Field(..., description="Payment method")
    tendered_amount: Optional[Decimal] = Field(None, description="Amount tendered")
    change_amount: Decimal = Field(..., description="Change amount")
    payment_reference: Optional[str] = Field(None, description="Payment reference")
    status: TransactionStatus = Field(..., description="Transaction status")
    transaction_date: datetime = Field(..., description="Transaction timestamp")
    sync_status: SyncStatus = Field(..., description="Sync status")
    items: List[TransactionItemResponse] = Field(..., description="Transaction items")
    notes: Optional[str] = Field(None, description="Transaction notes")
    receipt_printed: bool = Field(..., description="Whether receipt was printed")
    created_at: datetime = Field(..., description="Creation timestamp")

    class Config:
        from_attributes = True


# ===============================================
# INVENTORY SCHEMAS
# ===============================================

class StockMovementCreate(BaseModel):
    """Schema for creating stock movements"""
    product_id: str = Field(..., description="Product ID")
    outlet_id: str = Field(..., description="Outlet ID")
    movement_type: MovementType = Field(..., description="Type of movement")
    quantity_change: int = Field(..., description="Quantity change (positive or negative)")
    reference_id: Optional[str] = Field(None, description="Reference ID")
    reference_type: Optional[str] = Field(None, description="Reference type")
    unit_cost: Optional[Decimal] = Field(None, ge=0, description="Unit cost")
    notes: Optional[str] = Field(None, description="Movement notes")
    performed_by: str = Field(..., description="User who performed the movement")


class StockMovementResponse(BaseModel):
    """Schema for stock movement response"""
    id: str = Field(..., description="Movement unique identifier")
    product_id: str = Field(..., description="Product ID")
    outlet_id: str = Field(..., description="Outlet ID")
    movement_type: MovementType = Field(..., description="Movement type")
    quantity_change: int = Field(..., description="Quantity change")
    quantity_before: int = Field(..., description="Quantity before movement")
    quantity_after: int = Field(..., description="Quantity after movement")
    reference_id: Optional[str] = Field(None, description="Reference ID")
    reference_type: Optional[str] = Field(None, description="Reference type")
    unit_cost: Optional[Decimal] = Field(None, description="Unit cost")
    total_value: Optional[Decimal] = Field(None, description="Total value")
    notes: Optional[str] = Field(None, description="Notes")
    performed_by: str = Field(..., description="User who performed")
    movement_date: datetime = Field(..., description="Movement timestamp")

    class Config:
        from_attributes = True


# ===============================================
# CASH DRAWER SCHEMAS
# ===============================================

class CashDrawerSessionCreate(BaseModel):
    """Schema for creating cash drawer session"""
    outlet_id: str = Field(..., description="Outlet ID")
    terminal_id: str = Field(..., max_length=100, description="Terminal ID")
    cashier_id: str = Field(..., description="Cashier ID")
    opening_balance: Decimal = Field(0, ge=0, description="Opening cash balance")
    opening_notes: Optional[str] = Field(None, description="Opening notes")


class CashDrawerSessionClose(BaseModel):
    """Schema for closing cash drawer session"""
    actual_balance: Decimal = Field(..., ge=0, description="Actual counted cash")
    closing_notes: Optional[str] = Field(None, description="Closing notes")


class CashDrawerSessionResponse(BaseModel):
    """Schema for cash drawer session response"""
    id: str = Field(..., description="Session unique identifier")
    outlet_id: str = Field(..., description="Outlet ID")
    terminal_id: str = Field(..., description="Terminal ID")
    session_number: str = Field(..., description="Session number")
    cashier_id: str = Field(..., description="Cashier ID")
    opening_balance: Decimal = Field(..., description="Opening balance")
    cash_sales_total: Decimal = Field(..., description="Cash sales total")
    cash_refunds_total: Decimal = Field(..., description="Cash refunds total")
    expected_balance: Optional[Decimal] = Field(None, description="Expected balance")
    actual_balance: Optional[Decimal] = Field(None, description="Actual counted balance")
    variance: Optional[Decimal] = Field(None, description="Variance amount")
    status: str = Field(..., description="Session status")
    opened_at: datetime = Field(..., description="Session opened timestamp")
    closed_at: Optional[datetime] = Field(None, description="Session closed timestamp")
    opening_notes: Optional[str] = Field(None, description="Opening notes")
    closing_notes: Optional[str] = Field(None, description="Closing notes")

    class Config:
        from_attributes = True


# ===============================================
# SEARCH AND FILTER SCHEMAS
# ===============================================

class ProductSearchRequest(BaseModel):
    """Schema for product search"""
    query: Optional[str] = Field(None, max_length=255, description="Search query")
    category: Optional[str] = Field(None, description="Filter by category")
    barcode: Optional[str] = Field(None, description="Search by barcode")
    active_only: bool = Field(True, description="Show only active products")
    limit: int = Field(20, ge=1, le=100, description="Maximum results")


class TransactionSearchRequest(BaseModel):
    """Schema for transaction search"""
    date_from: Optional[datetime] = Field(None, description="Start date")
    date_to: Optional[datetime] = Field(None, description="End date")
    cashier_id: Optional[str] = Field(None, description="Filter by cashier")
    payment_method: Optional[PaymentMethod] = Field(None, description="Filter by payment method")
    status: Optional[TransactionStatus] = Field(None, description="Filter by status")
    limit: int = Field(50, ge=1, le=200, description="Maximum results")


# ===============================================
# RESPONSE WRAPPERS
# ===============================================

class ProductListResponse(BaseModel):
    """Paginated product list response"""
    items: List[POSProductResponse] = Field(..., description="Products")
    total: int = Field(..., description="Total count")
    page: int = Field(..., description="Current page")
    size: int = Field(..., description="Page size")


class TransactionListResponse(BaseModel):
    """Paginated transaction list response"""
    items: List[POSTransactionResponse] = Field(..., description="Transactions")
    total: int = Field(..., description="Total count")
    page: int = Field(..., description="Current page")
    size: int = Field(..., description="Page size")


class InventoryStatsResponse(BaseModel):
    """Inventory statistics response"""
    total_products: int = Field(..., description="Total products")
    active_products: int = Field(..., description="Active products")
    low_stock_count: int = Field(..., description="Products below reorder level")
    out_of_stock_count: int = Field(..., description="Out of stock products")
    total_inventory_value: Decimal = Field(..., description="Total inventory value")


class SalesStatsResponse(BaseModel):
    """Sales statistics response"""
    total_sales: Decimal = Field(..., description="Total sales amount")
    transaction_count: int = Field(..., description="Number of transactions")
    avg_transaction_value: Decimal = Field(..., description="Average transaction value")
    cash_sales: Decimal = Field(..., description="Cash sales amount")
    transfer_sales: Decimal = Field(..., description="Transfer sales amount")
    pos_sales: Decimal = Field(..., description="POS sales amount")
    top_products: List[Dict[str, Any]] = Field(..., description="Top selling products")


# ===============================================
# ERROR SCHEMAS
# ===============================================

class ErrorResponse(BaseModel):
    """Error response schema"""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional details")


class ValidationErrorResponse(BaseModel):
    """Validation error response"""
    error: str = Field("validation_error", description="Error type")
    message: str = Field(..., description="Validation error message")
    field_errors: List[Dict[str, str]] = Field(..., description="Field-specific errors")