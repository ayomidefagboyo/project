"""
Pydantic schemas for POS system data validation
Nigerian Supermarket Focus
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, date
from enum import Enum
from decimal import Decimal
import re


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


class ReceiptType(str, Enum):
    """Receipt types"""
    SALE = "sale"
    RETURN = "return"
    VOID = "void"
    REFUND = "refund"


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


class POSRole(str, Enum):
    """POS user roles"""
    INVENTORY = "inventory"
    CASHIER = "cashier"
    MANAGER = "manager"
    OWNER = "owner"
    ADMIN = "admin"


class TransferStatus(str, Enum):
    """Inventory transfer status"""
    PENDING = "pending"
    APPROVED = "approved"
    IN_TRANSIT = "in_transit"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class LoyaltyTransactionType(str, Enum):
    """Loyalty transaction types"""
    EARN = "earn"
    REDEEM = "redeem"
    ADJUSTMENT = "adjustment"


class PatientGender(str, Enum):
    """Patient gender values for pharmacy records."""
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    UNSPECIFIED = "unspecified"


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
    # Enhanced fields
    expiry_date: Optional[date] = Field(None, description="Product expiry date")
    batch_number: Optional[str] = Field(None, max_length=100, description="Batch number")
    markup_percentage: Decimal = Field(30.00, ge=0, description="Markup percentage for auto-pricing")
    auto_pricing: bool = Field(True, description="Auto-calculate price from cost + markup")
    category_tax_rate: Optional[Decimal] = Field(None, ge=0, le=1, description="Category-specific tax rate")
    reorder_notification_sent: bool = Field(False, description="Whether reorder notification was sent")
    last_received: Optional[datetime] = Field(None, description="Last time stock was received")
    min_shelf_life_days: int = Field(30, ge=0, description="Minimum shelf life required in days")
    # Multi-unit selling support
    base_unit_name: str = Field("Unit", max_length=30, description="Base stock/sales unit label")
    pack_enabled: bool = Field(False, description="Whether pack sales are enabled for this product")
    pack_name: Optional[str] = Field(None, max_length=30, description="Pack unit label, e.g. Pack/Carton")
    units_per_pack: Optional[int] = Field(
        None,
        ge=2,
        description="How many base units are in one pack when pack mode is enabled"
    )
    pack_price: Optional[Decimal] = Field(
        None,
        gt=0,
        description="Selling price for one pack when pack mode is enabled"
    )
    pack_barcode: Optional[str] = Field(
        None,
        max_length=100,
        description="Optional barcode that directly selects pack sale mode"
    )

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

    @validator('base_unit_name')
    def validate_base_unit_name(cls, v):
        normalized = str(v or '').strip()
        if not normalized:
            raise ValueError('Base unit name cannot be empty')
        return normalized

    @validator('pack_name')
    def validate_pack_name(cls, v):
        if v is None:
            return v
        normalized = str(v).strip()
        return normalized or None

    @validator('pack_barcode')
    def validate_pack_barcode(cls, v):
        if v is None:
            return v
        normalized = str(v).strip()
        return normalized or None

    @validator('units_per_pack', always=True)
    def validate_units_per_pack(cls, v, values):
        if values.get('pack_enabled'):
            if v is None or int(v) < 2:
                raise ValueError('units_per_pack must be at least 2 when pack sales are enabled')
        return v

    @validator('pack_price', always=True)
    def validate_pack_price(cls, v, values):
        if values.get('pack_enabled'):
            if v is None or Decimal(str(v)) <= 0:
                raise ValueError('pack_price must be greater than 0 when pack sales are enabled')
        return v


class POSProductCreate(POSProductBase):
    """Schema for creating a new product"""
    outlet_id: str = Field(..., description="Outlet ID")


class POSProductUpdate(BaseModel):
    """Schema for updating a product"""
    sku: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=100)
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
    base_unit_name: Optional[str] = Field(None, max_length=30)
    pack_enabled: Optional[bool] = None
    pack_name: Optional[str] = Field(None, max_length=30)
    units_per_pack: Optional[int] = Field(None, ge=2)
    pack_price: Optional[Decimal] = Field(None, gt=0)
    pack_barcode: Optional[str] = Field(None, max_length=100)

    @validator('base_unit_name')
    def validate_update_base_unit_name(cls, v):
        if v is None:
            return v
        normalized = str(v).strip()
        if not normalized:
            raise ValueError('Base unit name cannot be empty')
        return normalized

    @validator('pack_name')
    def validate_update_pack_name(cls, v):
        if v is None:
            return v
        normalized = str(v).strip()
        return normalized or None

    @validator('pack_barcode')
    def validate_update_pack_barcode(cls, v):
        if v is None:
            return v
        normalized = str(v).strip()
        return normalized or None


class POSProductResponse(POSProductBase):
    """Schema for product response"""
    id: str = Field(..., description="Product unique identifier")
    outlet_id: str = Field(..., description="Outlet identifier")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class DepartmentBase(BaseModel):
    """Base schema for department master records."""
    name: str = Field(..., min_length=1, max_length=100, description="Department name")
    code: Optional[str] = Field(None, max_length=30, description="Optional short code")
    description: Optional[str] = Field(None, max_length=255, description="Optional description")
    sort_order: int = Field(0, description="Display order")
    default_markup_percentage: Decimal = Field(
        30.00,
        ge=0,
        le=1000,
        description="Default markup percentage used for auto sale price"
    )
    auto_pricing_enabled: bool = Field(
        True,
        description="Whether auto pricing is enabled for this department"
    )

    @validator('name')
    def validate_department_name(cls, v):
        normalized = re.sub(r'\s+', ' ', v.strip())
        if not normalized:
            raise ValueError('Department name cannot be empty')
        return normalized

    @validator('code')
    def validate_department_code(cls, v):
        if v is None:
            return v
        normalized = re.sub(r'[^A-Z0-9-]', '', v.strip().upper())
        return normalized[:30] or None


class DepartmentCreate(DepartmentBase):
    """Create department payload."""
    outlet_id: str = Field(..., description="Outlet ID")


class DepartmentUpdate(BaseModel):
    """Update department payload."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = Field(None, max_length=30)
    description: Optional[str] = Field(None, max_length=255)
    sort_order: Optional[int] = None
    default_markup_percentage: Optional[Decimal] = Field(
        None,
        ge=0,
        le=1000,
        description="Default markup percentage for auto sale price"
    )
    auto_pricing_enabled: Optional[bool] = Field(
        None,
        description="Whether auto pricing is enabled for this department"
    )
    is_active: Optional[bool] = None

    @validator('name')
    def validate_department_name(cls, v):
        if v is None:
            return v
        normalized = re.sub(r'\s+', ' ', v.strip())
        if not normalized:
            raise ValueError('Department name cannot be empty')
        return normalized

    @validator('code')
    def validate_department_code(cls, v):
        if v is None:
            return v
        normalized = re.sub(r'[^A-Z0-9-]', '', v.strip().upper())
        return normalized[:30] or None


class DepartmentResponse(BaseModel):
    """Department response."""
    id: str = Field(..., description="Department ID")
    outlet_id: str = Field(..., description="Outlet ID")
    name: str = Field(..., description="Department name")
    code: Optional[str] = Field(None, description="Department short code")
    description: Optional[str] = Field(None, description="Department description")
    sort_order: int = Field(0, description="Display order")
    default_markup_percentage: Decimal = Field(
        30.00,
        description="Default markup percentage for auto pricing"
    )
    auto_pricing_enabled: bool = Field(
        True,
        description="Whether auto pricing is enabled for this department"
    )
    is_active: bool = Field(True, description="Department active flag")
    source: Optional[str] = Field(None, description="master or product_category")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    class Config:
        from_attributes = True


class ProductImportItem(POSProductBase):
    """Product payload used by bulk import."""
    # Keep import resilient: allow unit_price=0 at request-parse stage
    # so endpoint logic can return row-level errors instead of whole-request 422s.
    unit_price: Decimal = Field(..., ge=0, description="Selling price in Naira")


class ProductBulkImportRequest(BaseModel):
    """Bulk import request for POS products."""
    outlet_id: str = Field(..., description="Outlet ID")
    products: List[ProductImportItem] = Field(..., min_items=1, description="Products to import")
    dedupe_by: Literal['sku_or_barcode', 'sku', 'barcode', 'none'] = Field(
        'sku_or_barcode',
        description="How to detect existing products"
    )
    update_existing: bool = Field(
        True,
        description="Whether to update existing matched products (if false, matched rows are skipped)"
    )
    dry_run: bool = Field(False, description="Validate and match rows without writing to database")


class ProductBulkImportError(BaseModel):
    """Single row error for product bulk import."""
    row: int = Field(..., description="1-based row number in submitted payload")
    sku: Optional[str] = Field(None, description="Submitted SKU")
    barcode: Optional[str] = Field(None, description="Submitted barcode")
    name: Optional[str] = Field(None, description="Submitted product name")
    message: str = Field(..., description="Error message")


class ProductBulkImportResponse(BaseModel):
    """Summary of product bulk import results."""
    total_received: int = Field(..., description="Total rows received")
    created_count: int = Field(..., description="Number of rows created")
    updated_count: int = Field(..., description="Number of rows updated")
    skipped_count: int = Field(..., description="Number of rows skipped due to dedupe policy")
    error_count: int = Field(..., description="Number of rows that failed")
    errors: List[ProductBulkImportError] = Field(default_factory=list, description="Row-level errors")


# ===============================================
# TRANSACTION SCHEMAS
# ===============================================

class TransactionItemCreate(BaseModel):
    """Schema for creating transaction items"""
    product_id: str = Field(..., description="Product ID")
    quantity: int = Field(..., gt=0, description="Quantity sold")
    unit_price: Optional[Decimal] = Field(None, description="Override price (optional)")
    discount_amount: Decimal = Field(0, ge=0, description="Item discount")
    sale_unit: Literal['unit', 'pack'] = Field('unit', description="Sale unit mode")
    units_per_sale_unit: Optional[int] = Field(
        None,
        ge=1,
        description="Optional multiplier (base units per sold unit)"
    )


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
    sale_unit: Optional[Literal['unit', 'pack']] = Field('unit', description="Sale unit mode")
    sale_quantity: Optional[int] = Field(None, description="Sold quantity in selected sale unit")
    sale_unit_price: Optional[Decimal] = Field(None, description="Price per selected sale unit")
    units_per_sale_unit: Optional[int] = Field(1, description="Base units represented by one sold unit")
    base_units_quantity: Optional[int] = Field(None, description="Quantity impact in base stock units")

    class Config:
        from_attributes = True


class SplitPaymentEntry(BaseModel):
    """Split payment line item"""
    method: PaymentMethod = Field(..., description="Payment method for this split line")
    amount: Decimal = Field(..., gt=0, description="Amount paid with this method")
    reference: Optional[str] = Field(None, max_length=100, description="Optional payment reference")


class POSTransactionCreate(BaseModel):
    """Schema for creating a POS transaction"""
    outlet_id: str = Field(..., description="Outlet ID")
    cashier_id: str = Field(..., description="Cashier staff profile ID")
    customer_id: Optional[str] = Field(None, description="Customer ID (optional)")
    customer_name: Optional[str] = Field(None, max_length=255, description="Customer name for receipt")
    items: List[TransactionItemCreate] = Field(..., min_items=1, description="Transaction items")
    payment_method: PaymentMethod = Field(..., description="Payment method")
    tendered_amount: Optional[Decimal] = Field(None, ge=0, description="Amount tendered (for cash)")
    payment_reference: Optional[str] = Field(None, max_length=100, description="Payment reference")
    discount_amount: Decimal = Field(0, ge=0, description="Total transaction discount")
    receipt_type: ReceiptType = Field(ReceiptType.SALE, description="Type of receipt")
    notes: Optional[str] = Field(None, description="Transaction notes")
    offline_id: Optional[str] = Field(None, description="Offline transaction ID")
    discount_authorizer_session_token: Optional[str] = Field(
        None,
        description="Optional POS staff session token from manager/pharmacist authorizing discounts"
    )
    split_payments: Optional[List[SplitPaymentEntry]] = Field(
        None,
        description="Split payment breakdown for mixed payments"
    )

    @validator('tendered_amount')
    def validate_tendered_amount(cls, v, values):
        if values.get('payment_method') == PaymentMethod.CASH and v is None:
            raise ValueError('Tendered amount required for cash payments')
        return v


class POSTransactionResponse(BaseModel):
    """Schema for transaction response"""
    id: str = Field(..., description="Transaction unique identifier")
    outlet_id: str = Field(..., description="Outlet identifier")
    transaction_number: str = Field("", description="Transaction number")
    cashier_id: str = Field("", description="Cashier staff profile ID")
    customer_id: Optional[str] = Field(None, description="Customer ID")
    customer_name: Optional[str] = Field(None, description="Customer name")
    subtotal: Decimal = Field(0, description="Subtotal amount")
    tax_amount: Decimal = Field(0, description="Tax amount")
    discount_amount: Decimal = Field(0, description="Discount amount")
    total_amount: Decimal = Field(0, description="Total amount")
    payment_method: PaymentMethod = Field(..., description="Payment method")
    tendered_amount: Optional[Decimal] = Field(None, description="Amount tendered")
    change_amount: Decimal = Field(0, description="Change amount")
    payment_reference: Optional[str] = Field(None, description="Payment reference")
    status: TransactionStatus = Field(TransactionStatus.COMPLETED, description="Transaction status")
    transaction_date: datetime = Field(..., description="Transaction timestamp")
    sync_status: SyncStatus = Field(SyncStatus.SYNCED, description="Sync status")
    items: List[TransactionItemResponse] = Field(..., description="Transaction items")
    receipt_type: ReceiptType = Field(ReceiptType.SALE, description="Type of receipt")
    split_payments: Optional[List[SplitPaymentEntry]] = Field(
        None,
        description="Split payment breakdown for mixed payments"
    )
    cashier_name: Optional[str] = Field(None, description="Name of the cashier")
    voided_by: Optional[str] = Field(None, description="ID of staff who voided transaction")
    voided_by_name: Optional[str] = Field(None, description="Name of staff who voided transaction")
    void_reason: Optional[str] = Field(None, description="Reason for voiding")
    voided_at: Optional[datetime] = Field(None, description="When transaction was voided")
    notes: Optional[str] = Field(None, description="Transaction notes")
    has_returns: bool = Field(False, description="Whether this sale has one or more return transactions")
    return_count: int = Field(0, description="Number of returns linked to this transaction")
    returned_amount: Decimal = Field(0, description="Total amount already returned")
    remaining_refundable_amount: Decimal = Field(0, description="Amount still available to return")
    receipt_printed: bool = Field(False, description="Whether receipt was printed")
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


class StocktakeCommitItem(BaseModel):
    """Schema for stocktake line-item commit payload."""
    product_id: str = Field(..., description="Product ID")
    current_quantity: int = Field(..., ge=0, description="System quantity seen during count")
    counted_quantity: int = Field(..., ge=0, description="Physical counted quantity")
    reason: Optional[str] = Field(None, max_length=255, description="Variance reason")
    notes: Optional[str] = Field(None, description="Optional line notes")
    unit_cost: Optional[Decimal] = Field(None, ge=0, description="Unit cost for variance valuation")


class StocktakeCommitRequest(BaseModel):
    """Batch stocktake commit payload."""
    outlet_id: str = Field(..., description="Outlet ID")
    performed_by: Optional[str] = Field(None, description="Actor identifier from client context")
    terminal_id: Optional[str] = Field(None, max_length=120, description="Terminal identifier")
    started_at: Optional[datetime] = Field(None, description="Count start time")
    notes: Optional[str] = Field(None, description="Session notes")
    items: List[StocktakeCommitItem] = Field(..., min_items=1, description="Stocktake rows")


class StocktakeCommitResponse(BaseModel):
    """Result summary for a committed stocktake session."""
    session_id: str = Field(..., description="Stocktake session ID")
    outlet_id: str = Field(..., description="Outlet ID")
    terminal_id: Optional[str] = Field(None, description="Terminal identifier")
    performed_by: str = Field(..., description="Authenticated actor user ID")
    performed_by_name: Optional[str] = Field(None, description="Staff display name at commit time")
    started_at: datetime = Field(..., description="Session start timestamp")
    completed_at: datetime = Field(..., description="Session completion timestamp")
    status: str = Field(..., description="Session status")
    total_items: int = Field(..., description="Rows submitted for stocktake")
    adjusted_items: int = Field(..., description="Rows that changed stock")
    unchanged_items: int = Field(..., description="Rows without variance")
    positive_variance_items: int = Field(..., description="Rows with positive variance")
    negative_variance_items: int = Field(..., description="Rows with negative variance")
    net_quantity_variance: int = Field(..., description="Net quantity variance")
    total_variance_value: Optional[Decimal] = Field(None, description="Total absolute variance value")
    movement_ids: List[str] = Field(default_factory=list, description="Created stock movement IDs")


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
    limit: int = Field(50, ge=1, description="Maximum results")


# ===============================================
# RESPONSE WRAPPERS
# ===============================================

class ProductListResponse(BaseModel):
    """Paginated product list response"""
    items: List[POSProductResponse] = Field(..., description="Products")
    total: int = Field(..., description="Total count")
    page: int = Field(..., description="Current page")
    size: int = Field(..., description="Page size")


class DepartmentListResponse(BaseModel):
    """Department list response."""
    items: List[DepartmentResponse] = Field(..., description="Departments")
    total: int = Field(..., description="Total count")


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


# ===============================================
# CUSTOMER LOYALTY SCHEMAS
# ===============================================

class CustomerBase(BaseModel):
    """Base customer schema"""
    name: str = Field(..., min_length=1, max_length=255, description="Customer name")
    phone: str = Field(..., min_length=10, max_length=20, description="Customer phone number")
    email: Optional[str] = Field(None, description="Customer email")
    date_of_birth: Optional[date] = Field(None, description="Customer date of birth")
    address: Optional[str] = Field(None, description="Customer address")

    @validator('phone')
    def validate_phone(cls, v):
        # Basic Nigerian phone number validation
        if v and not v.startswith(('+234', '234', '0')):
            raise ValueError('Phone number must be a valid Nigerian number')
        return v

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Customer name cannot be empty')
        return v.strip()


class CustomerCreate(CustomerBase):
    """Schema for creating a customer"""
    outlet_id: str = Field(..., description="Outlet ID")


class CustomerUpdate(BaseModel):
    """Schema for updating a customer"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    email: Optional[str] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None


class CustomerResponse(CustomerBase):
    """Customer response schema"""
    id: str = Field(..., description="Customer unique identifier")
    outlet_id: str = Field(..., description="Outlet identifier")
    loyalty_points: int = Field(..., description="Current loyalty points")
    total_spent: Decimal = Field(..., description="Total amount spent")
    visit_count: int = Field(..., description="Number of visits")
    last_visit: Optional[datetime] = Field(None, description="Last visit date")
    is_active: bool = Field(..., description="Whether customer is active")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class CustomerListResponse(BaseModel):
    """Paginated customer list response."""
    items: List[CustomerResponse] = Field(default_factory=list, description="Customer rows")
    total: int = Field(..., description="Total matched customers")
    page: int = Field(..., description="Current page")
    size: int = Field(..., description="Requested page size")


class PatientProfileBase(BaseModel):
    """Base patient profile payload for pharmacy operations."""
    full_name: str = Field(..., min_length=1, max_length=255, description="Patient full name")
    phone: Optional[str] = Field(None, max_length=30, description="Primary contact phone")
    gender: Optional[PatientGender] = Field(PatientGender.UNSPECIFIED, description="Patient gender")
    date_of_birth: Optional[date] = Field(None, description="Patient date of birth")
    address: Optional[str] = Field(None, max_length=500, description="Patient address")
    emergency_contact_name: Optional[str] = Field(None, max_length=255, description="Emergency contact name")
    emergency_contact_phone: Optional[str] = Field(None, max_length=30, description="Emergency contact phone")
    allergies: Optional[str] = Field(None, description="Known allergies")
    chronic_conditions: Optional[str] = Field(None, description="Chronic conditions / diagnosis history")
    current_medications: Optional[str] = Field(None, description="Current medication list")
    notes: Optional[str] = Field(None, description="Clinical notes")
    is_active: bool = Field(True, description="Whether patient record is active")

    @validator('full_name')
    def validate_patient_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Patient name cannot be empty')
        return v.strip()


class PatientProfileCreate(PatientProfileBase):
    """Create patient profile payload."""
    outlet_id: str = Field(..., description="Outlet ID")


class PatientProfileUpdate(BaseModel):
    """Update patient profile payload."""
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=30)
    gender: Optional[PatientGender] = Field(None, description="Patient gender")
    date_of_birth: Optional[date] = Field(None, description="Patient date of birth")
    address: Optional[str] = Field(None, max_length=500)
    emergency_contact_name: Optional[str] = Field(None, max_length=255)
    emergency_contact_phone: Optional[str] = Field(None, max_length=30)
    allergies: Optional[str] = Field(None)
    chronic_conditions: Optional[str] = Field(None)
    current_medications: Optional[str] = Field(None)
    notes: Optional[str] = Field(None)
    is_active: Optional[bool] = Field(None)

    @validator('full_name')
    def validate_patient_name(cls, v):
        if v is None:
            return v
        if not v.strip():
            raise ValueError('Patient name cannot be empty')
        return v.strip()


class PatientProfileResponse(PatientProfileBase):
    """Patient profile response."""
    id: str = Field(..., description="Patient ID")
    outlet_id: str = Field(..., description="Outlet ID")
    patient_code: str = Field(..., description="Human-friendly patient code")
    created_by: Optional[str] = Field(None, description="User ID that created the record")
    last_visit_at: Optional[datetime] = Field(None, description="Last recorded vitals timestamp")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class PatientProfileListResponse(BaseModel):
    """Paginated patient profile list response."""
    items: List[PatientProfileResponse] = Field(default_factory=list, description="Patient rows")
    total: int = Field(..., description="Total matched patients")
    page: int = Field(..., description="Current page")
    size: int = Field(..., description="Requested page size")


class PatientVitalCreate(BaseModel):
    """Create patient vitals payload."""
    recorded_at: Optional[datetime] = Field(None, description="When vitals were taken")
    systolic_bp: Optional[int] = Field(None, ge=40, le=300, description="Systolic BP (mmHg)")
    diastolic_bp: Optional[int] = Field(None, ge=20, le=200, description="Diastolic BP (mmHg)")
    pulse_bpm: Optional[int] = Field(None, ge=20, le=250, description="Pulse (beats per minute)")
    temperature_c: Optional[Decimal] = Field(None, ge=25, le=45, description="Body temperature in Celsius")
    respiratory_rate: Optional[int] = Field(None, ge=5, le=80, description="Respiratory rate")
    oxygen_saturation: Optional[int] = Field(None, ge=50, le=100, description="SpO2 percentage")
    blood_glucose_mmol: Optional[Decimal] = Field(None, ge=1, le=40, description="Blood glucose (mmol/L)")
    weight_kg: Optional[Decimal] = Field(None, ge=1, le=500, description="Weight in kg")
    height_cm: Optional[Decimal] = Field(None, ge=20, le=260, description="Height in cm")
    notes: Optional[str] = Field(None, description="Clinical notes")


class PatientVitalResponse(PatientVitalCreate):
    """Patient vital record response."""
    id: str = Field(..., description="Vitals ID")
    patient_id: str = Field(..., description="Patient ID")
    outlet_id: str = Field(..., description="Outlet ID")
    recorded_by: Optional[str] = Field(None, description="User ID who captured the vitals")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class PatientVitalListResponse(BaseModel):
    """Paginated vitals list response."""
    items: List[PatientVitalResponse] = Field(default_factory=list, description="Vitals rows")
    total: int = Field(..., description="Total matched vitals records")
    page: int = Field(..., description="Current page")
    size: int = Field(..., description="Requested page size")


class LoyaltyTransactionCreate(BaseModel):
    """Schema for creating loyalty transaction"""
    customer_id: str = Field(..., description="Customer ID")
    transaction_id: Optional[str] = Field(None, description="POS transaction ID")
    transaction_amount: Decimal = Field(..., gt=0, description="Transaction amount")
    points_earned: int = Field(0, ge=0, description="Points earned")
    points_redeemed: int = Field(0, ge=0, description="Points redeemed")
    transaction_type: LoyaltyTransactionType = Field(..., description="Transaction type")
    notes: Optional[str] = Field(None, description="Additional notes")


class LoyaltyTransactionResponse(BaseModel):
    """Loyalty transaction response"""
    id: str = Field(..., description="Transaction unique identifier")
    customer_id: str = Field(..., description="Customer ID")
    transaction_id: Optional[str] = Field(None, description="POS transaction ID")
    outlet_id: str = Field(..., description="Outlet ID")
    transaction_amount: Decimal = Field(..., description="Transaction amount")
    points_earned: int = Field(..., description="Points earned")
    points_redeemed: int = Field(..., description="Points redeemed")
    transaction_type: LoyaltyTransactionType = Field(..., description="Transaction type")
    notes: Optional[str] = Field(None, description="Notes")
    created_at: datetime = Field(..., description="Creation timestamp")

    class Config:
        from_attributes = True


class LoyaltySettingsUpdate(BaseModel):
    """Schema for updating loyalty settings"""
    points_per_naira: Optional[Decimal] = Field(None, ge=0, description="Points earned per naira spent")
    redemption_rate: Optional[Decimal] = Field(None, ge=0, description="Naira value per point redeemed")
    minimum_redemption_points: Optional[int] = Field(None, ge=0, description="Minimum points for redemption")
    point_expiry_months: Optional[int] = Field(None, ge=0, description="Point expiry in months")
    is_active: Optional[bool] = Field(None, description="Whether loyalty program is active")


class LoyaltySettingsResponse(BaseModel):
    """Loyalty settings response"""
    id: str = Field(..., description="Settings unique identifier")
    outlet_id: str = Field(..., description="Outlet ID")
    points_per_naira: Decimal = Field(..., description="Points per naira")
    redemption_rate: Decimal = Field(..., description="Redemption rate")
    minimum_redemption_points: int = Field(..., description="Minimum redemption points")
    point_expiry_months: int = Field(..., description="Point expiry months")
    is_active: bool = Field(..., description="Whether active")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Update timestamp")

    class Config:
        from_attributes = True


# ===============================================
# INVENTORY TRANSFER SCHEMAS
# ===============================================

class InventoryTransferItemCreate(BaseModel):
    """Schema for transfer item"""
    product_id: str = Field(..., description="Product ID")
    quantity_requested: int = Field(..., gt=0, description="Quantity requested")
    batch_number: Optional[str] = Field(None, description="Batch number")
    expiry_date: Optional[date] = Field(None, description="Expiry date")
    notes: Optional[str] = Field(None, description="Item notes")


class InventoryTransferCreate(BaseModel):
    """Schema for creating inventory transfer"""
    from_outlet_id: str = Field(..., description="Source outlet ID")
    to_outlet_id: str = Field(..., description="Destination outlet ID")
    transfer_reason: Optional[str] = Field(None, description="Reason for transfer")
    items: List[InventoryTransferItemCreate] = Field(..., min_items=1, description="Items to transfer")
    notes: Optional[str] = Field(None, description="Transfer notes")

    @validator('from_outlet_id', 'to_outlet_id')
    def validate_outlets_different(cls, v, values):
        if 'from_outlet_id' in values and v == values['from_outlet_id']:
            raise ValueError('Source and destination outlets cannot be the same')
        return v


class InventoryTransferUpdate(BaseModel):
    """Schema for updating transfer"""
    status: Optional[TransferStatus] = Field(None, description="Transfer status")
    notes: Optional[str] = Field(None, description="Updated notes")


class InventoryTransferApproval(BaseModel):
    """Schema for approving transfer"""
    approved: bool = Field(..., description="Whether to approve or reject")
    notes: Optional[str] = Field(None, description="Approval notes")


class InventoryTransferItemResponse(BaseModel):
    """Transfer item response"""
    id: str = Field(..., description="Item unique identifier")
    product_id: str = Field(..., description="Product ID")
    product_name: str = Field(..., description="Product name")
    sku: str = Field(..., description="Product SKU")
    quantity_requested: int = Field(..., description="Quantity requested")
    quantity_sent: int = Field(..., description="Quantity sent")
    quantity_received: int = Field(..., description="Quantity received")
    unit_cost: Optional[Decimal] = Field(None, description="Unit cost")
    batch_number: Optional[str] = Field(None, description="Batch number")
    expiry_date: Optional[date] = Field(None, description="Expiry date")
    notes: Optional[str] = Field(None, description="Notes")

    class Config:
        from_attributes = True


class InventoryTransferResponse(BaseModel):
    """Inventory transfer response"""
    id: str = Field(..., description="Transfer unique identifier")
    transfer_number: str = Field(..., description="Transfer number")
    from_outlet_id: str = Field(..., description="Source outlet ID")
    to_outlet_id: str = Field(..., description="Destination outlet ID")
    from_outlet_name: str = Field(..., description="Source outlet name")
    to_outlet_name: str = Field(..., description="Destination outlet name")
    status: TransferStatus = Field(..., description="Transfer status")
    transfer_reason: Optional[str] = Field(None, description="Transfer reason")
    total_items: int = Field(..., description="Total items")
    total_value: Decimal = Field(..., description="Total value")
    requested_by: str = Field(..., description="Requested by user ID")
    approved_by: Optional[str] = Field(None, description="Approved by user ID")
    received_by: Optional[str] = Field(None, description="Received by user ID")
    notes: Optional[str] = Field(None, description="Notes")
    requested_at: datetime = Field(..., description="Request timestamp")
    approved_at: Optional[datetime] = Field(None, description="Approval timestamp")
    received_at: Optional[datetime] = Field(None, description="Receipt timestamp")
    items: List[InventoryTransferItemResponse] = Field(..., description="Transfer items")

    class Config:
        from_attributes = True


# ===============================================
# ROLE & PERMISSION SCHEMAS
# ===============================================

class POSUserRoleCreate(BaseModel):
    """Schema for creating POS user role"""
    user_id: str = Field(..., description="User ID")
    outlet_id: str = Field(..., description="Outlet ID")
    role_name: POSRole = Field(..., description="Role name")
    permissions: Dict[str, bool] = Field(default_factory=dict, description="Role permissions")


class POSUserRoleUpdate(BaseModel):
    """Schema for updating POS user role"""
    role_name: Optional[POSRole] = Field(None, description="Role name")
    permissions: Optional[Dict[str, bool]] = Field(None, description="Updated permissions")
    is_active: Optional[bool] = Field(None, description="Whether role is active")


class POSUserRoleResponse(BaseModel):
    """POS user role response"""
    id: str = Field(..., description="Role unique identifier")
    user_id: str = Field(..., description="User ID")
    outlet_id: str = Field(..., description="Outlet ID")
    role_name: POSRole = Field(..., description="Role name")
    permissions: Dict[str, bool] = Field(..., description="Role permissions")
    is_active: bool = Field(..., description="Whether role is active")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Update timestamp")

    class Config:
        from_attributes = True


# ===============================================
# ENHANCED PRODUCT SCHEMAS
# ===============================================

class StockReceiptCreate(BaseModel):
    """Schema for receiving stock"""
    product_id: str = Field(..., description="Product ID")
    quantity_received: int = Field(..., gt=0, description="Quantity received")
    cost_price: Decimal = Field(..., gt=0, description="Cost price per unit")
    batch_number: Optional[str] = Field(None, description="Batch number")
    expiry_date: Optional[date] = Field(None, description="Expiry date")
    supplier_invoice: Optional[str] = Field(None, description="Supplier invoice number")
    received_by: str = Field(..., description="User who received the stock")
    notes: Optional[str] = Field(None, description="Receipt notes")

    @validator('expiry_date')
    def validate_expiry_date(cls, v):
        if v and v <= date.today():
            raise ValueError('Expiry date must be in the future')
        return v


class ExpiringProductsResponse(BaseModel):
    """Response for expiring products"""
    outlet_id: str = Field(..., description="Outlet ID")
    product_id: str = Field(..., description="Product ID")
    product_name: str = Field(..., description="Product name")
    sku: str = Field(..., description="Product SKU")
    batch_number: Optional[str] = Field(None, description="Batch number")
    expiry_date: Optional[date] = Field(None, description="Expiry date")
    days_until_expiry: int = Field(..., description="Days until expiry")
    quantity_on_hand: int = Field(..., description="Current quantity")

    class Config:
        from_attributes = True


class LowStockProductsResponse(BaseModel):
    """Response for low stock products"""
    outlet_id: str = Field(..., description="Outlet ID")
    product_id: str = Field(..., description="Product ID")
    product_name: str = Field(..., description="Product name")
    sku: str = Field(..., description="Product SKU")
    quantity_on_hand: int = Field(..., description="Current quantity")
    reorder_level: int = Field(..., description="Reorder level")
    reorder_quantity: int = Field(..., description="Suggested reorder quantity")
    supplier_id: Optional[str] = Field(None, description="Supplier ID")

    class Config:
        from_attributes = True


# ===============================================
# ENHANCED TRANSACTION SCHEMAS
# ===============================================

class EnhancedTransactionItemCreate(TransactionItemCreate):
    """Enhanced transaction item with loyalty support"""
    loyalty_points_earned: int = Field(0, ge=0, description="Points earned for this item")


class EnhancedPOSTransactionCreate(POSTransactionCreate):
    """Enhanced transaction with customer and loyalty support"""
    customer_id: Optional[str] = Field(None, description="Customer ID for loyalty")
    loyalty_points_redeemed: int = Field(0, ge=0, description="Loyalty points redeemed")
    loyalty_discount: Decimal = Field(0, ge=0, description="Discount from loyalty points")
    split_payments: Optional[List[Dict[str, Any]]] = Field(None, description="Split payment details")

    @validator('split_payments')
    def validate_split_payments(cls, v, values):
        if v and len(v) > 1:
            # Validate that split payment amounts sum to total
            total_split = sum(payment.get('amount', 0) for payment in v)
            # Note: We can't easily access the calculated total here, so this is a placeholder
            pass
        return v


# ===============================================
# RECEIPT CUSTOMIZATION SCHEMAS
# ===============================================

class ReceiptSettingsUpdate(BaseModel):
    """Schema for updating receipt settings"""
    header_text: Optional[str] = Field(None, description="Receipt header text")
    footer_text: Optional[str] = Field(None, description="Receipt footer text")
    logo_url: Optional[str] = Field(None, description="Logo URL")
    show_qr_code: Optional[bool] = Field(None, description="Whether to show QR code")
    show_customer_points: Optional[bool] = Field(None, description="Show customer points")
    show_tax_breakdown: Optional[bool] = Field(None, description="Show tax breakdown")
    receipt_width: Optional[int] = Field(None, ge=40, le=80, description="Receipt width in mm")
    font_size: Optional[str] = Field(None, description="Font size (small, normal, large)")


class ReceiptSettingsResponse(BaseModel):
    """Receipt settings response"""
    id: str = Field(..., description="Settings unique identifier")
    outlet_id: str = Field(..., description="Outlet ID")
    header_text: Optional[str] = Field(None, description="Header text")
    footer_text: Optional[str] = Field(None, description="Footer text")
    logo_url: Optional[str] = Field(None, description="Logo URL")
    show_qr_code: bool = Field(..., description="Show QR code")
    show_customer_points: bool = Field(..., description="Show customer points")
    show_tax_breakdown: bool = Field(..., description="Show tax breakdown")
    receipt_width: int = Field(..., description="Receipt width")
    font_size: str = Field(..., description="Font size")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Update timestamp")

    class Config:
        from_attributes = True


# ===============================================
# ANALYTICS & REPORTING SCHEMAS
# ===============================================

class EnhancedInventoryStatsResponse(InventoryStatsResponse):
    """Enhanced inventory statistics"""
    expiring_soon_count: int = Field(..., description="Products expiring within 30 days")
    expired_count: int = Field(..., description="Expired products")
    total_batches: int = Field(..., description="Total product batches")
    categories_count: int = Field(..., description="Number of categories")


class CustomerAnalyticsResponse(BaseModel):
    """Customer analytics response"""
    total_customers: int = Field(..., description="Total customers")
    active_customers: int = Field(..., description="Active customers")
    total_loyalty_points_issued: int = Field(..., description="Total points issued")
    total_loyalty_points_redeemed: int = Field(..., description="Total points redeemed")
    average_points_per_customer: Decimal = Field(..., description="Average points per customer")
    top_customers: List[Dict[str, Any]] = Field(..., description="Top customers by spending")


# ===============================================
# BULK OPERATION SCHEMAS
# ===============================================

class BulkProductUpdate(BaseModel):
    """Schema for bulk product updates"""
    product_ids: List[str] = Field(..., min_items=1, description="Product IDs to update")
    updates: Dict[str, Any] = Field(..., description="Updates to apply")
    apply_to_all: bool = Field(False, description="Apply to all products in outlet")


class BulkStockAdjustment(BaseModel):
    """Schema for bulk stock adjustments"""
    adjustments: List[Dict[str, Any]] = Field(..., min_items=1, description="Stock adjustments")
    reason: str = Field(..., description="Reason for adjustments")
    performed_by: str = Field(..., description="User performing adjustments")


# ===============================================
# HELD RECEIPT SCHEMAS
# ===============================================

class HeldReceiptItemCreate(BaseModel):
    """Schema for held receipt item"""
    product_id: str = Field(..., description="Product ID")
    product_name: str = Field("Product", description="Product name for display when loading later")
    quantity: int = Field(..., ge=1, description="Quantity")
    unit_price: Decimal = Field(..., gt=0, description="Unit price")
    discount: Decimal = Field(0, ge=0, description="Discount per item")
    sale_unit: Literal['unit', 'pack'] = Field('unit', description="Sale unit mode")
    units_per_sale_unit: Optional[int] = Field(
        None,
        ge=1,
        description="Optional multiplier (base units per sold unit)"
    )


class HeldReceiptCreate(BaseModel):
    """Schema for creating a held receipt"""
    outlet_id: str = Field(..., description="Outlet ID")
    cashier_id: str = Field(..., description="Cashier ID")
    items: List[HeldReceiptItemCreate] = Field(..., min_items=1, description="Cart items")
    total: Decimal = Field(..., gt=0, description="Total amount")


class HeldReceiptResponse(BaseModel):
    """Schema for held receipt response"""
    id: str = Field(..., description="Held receipt ID")
    outlet_id: str = Field(..., description="Outlet ID")
    cashier_id: str = Field(..., description="Cashier ID")
    cashier_name: str = Field(..., description="Cashier name")
    items: List[Dict[str, Any]] = Field(..., description="Cart items (stored as JSON)")
    total: Decimal = Field(..., description="Total amount")
    saved_at: datetime = Field(..., description="When receipt was held")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Update timestamp")

    class Config:
        from_attributes = True


class HeldReceiptListResponse(BaseModel):
    """Response for list of held receipts"""
    receipts: List[HeldReceiptResponse] = Field(..., description="List of held receipts")
    total: int = Field(..., description="Total count")


# ===============================================
# STAFF PROFILES SCHEMAS
# ===============================================

class StaffProfileCreate(BaseModel):
    """Schema for creating staff profile"""
    display_name: str = Field(..., max_length=100, description="Staff display name")
    pin: str = Field(..., min_length=6, max_length=6, pattern=r'^\d{6}$', description="6-digit PIN")
    role: str = Field(..., description="Staff role")
    outlet_id: str = Field(..., description="Outlet ID")
    permissions: Optional[List[str]] = Field(default=[], description="Custom permissions")


class StaffProfileUpdate(BaseModel):
    """Schema for updating staff profile"""
    display_name: Optional[str] = Field(None, max_length=100, description="Staff display name")
    pin: Optional[str] = Field(None, min_length=6, max_length=6, pattern=r'^\d{6}$', description="6-digit PIN")
    role: Optional[str] = Field(None, description="Staff role")
    permissions: Optional[List[str]] = Field(None, description="Custom permissions")
    is_active: Optional[bool] = Field(None, description="Active status")


class StaffProfileResponse(BaseModel):
    """Schema for staff profile response"""
    id: str = Field(..., description="Staff profile ID")
    parent_account_id: str = Field(..., description="Parent account ID")
    staff_code: str = Field(..., description="Unique staff code")
    display_name: str = Field(..., description="Staff display name")
    role: str = Field(..., description="Staff role")
    permissions: List[str] = Field(..., description="Staff permissions")
    outlet_id: str = Field(..., description="Outlet ID")
    is_active: bool = Field(..., description="Active status")
    last_login: Optional[datetime] = Field(None, description="Last login timestamp")
    failed_login_attempts: int = Field(..., description="Failed login attempts")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Update timestamp")

    class Config:
        from_attributes = True


class StaffProfileListResponse(BaseModel):
    """Response for list of staff profiles"""
    profiles: List[StaffProfileResponse] = Field(..., description="List of staff profiles")
    total: int = Field(..., description="Total count")


class StaffPinAuth(BaseModel):
    """Schema for PIN authentication"""
    staff_code: str = Field(..., max_length=10, description="Staff code")
    pin: str = Field(..., min_length=6, max_length=6, pattern=r'^\d{6}$', description="6-digit PIN")
    outlet_id: str = Field(..., description="Outlet ID")


class StaffAuthResponse(BaseModel):
    """Schema for staff authentication response"""
    staff_profile: StaffProfileResponse = Field(..., description="Staff profile")
    session_token: str = Field(..., description="Session token")
    expires_at: datetime = Field(..., description="Token expiration")

    class Config:
        from_attributes = True
