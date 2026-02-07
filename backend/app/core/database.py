"""
Database configuration and connection management
"""

from supabase import create_client, Client, ClientOptions
from app.core.config import settings
from typing import Optional
import logging
import traceback

logger = logging.getLogger(__name__)

# Global Supabase clients
supabase: Optional[Client] = None
supabase_admin: Optional[Client] = None


async def init_db() -> None:
    """Initialize database connections"""
    global supabase, supabase_admin

    try:
        # Validate that we have the required settings
        if not settings.SUPABASE_URL:
            raise ValueError("SUPABASE_URL is required but not set")
        if not settings.SUPABASE_ANON_KEY:
            raise ValueError("SUPABASE_ANON_KEY is required but not set")
        if not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY is required but not set")

        logger.info(f"🔗 Connecting to Supabase at: {settings.SUPABASE_URL}")

        # Create regular Supabase client with compatible options
        client_options = ClientOptions()
        supabase = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_ANON_KEY,
            client_options
        )

        # Create admin client for server-side operations
        admin_options = ClientOptions()
        supabase_admin = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
            admin_options
        )

        logger.info("✅ Database connections initialized successfully")

    except Exception as e:
        logger.error(f"❌ Failed to initialize database: {e}")
        logger.error(f"Database error traceback: {traceback.format_exc()}")
        logger.error("💡 Make sure SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are set in environment variables")
        raise


def get_supabase() -> Client:
    """Get regular Supabase client"""
    if supabase is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return supabase


def get_supabase_admin() -> Client:
    """Get admin Supabase client"""
    if supabase_admin is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return supabase_admin


# Database table names
class Tables:
    OUTLETS = "outlets"
    USERS = "users"
    VENDORS = "vendors"
    CUSTOMERS = "customers"
    INVOICES = "invoices"
    INVOICE_ITEMS = "invoice_items"
    EXPENSES = "expenses"
    DAILY_REPORTS = "daily_reports"
    EOD = "eod"
    BUSINESS_SETTINGS = "business_settings"
    USER_INVITATIONS = "user_invitations"
    AUDIT_ENTRIES = "audit_entries"
    PAYMENTS = "payments"
    ANOMALIES = "anomalies"
    APPROVALS = "approvals"
    FILES = "files"
    OCR_PROCESSING = "ocr_processing"
    POS_PRODUCTS = "pos_products"
    POS_TRANSACTIONS = "pos_transactions"
    POS_TRANSACTION_ITEMS = "pos_transaction_items"
    STOCK_MOVEMENTS = "stock_movements"
    CASH_DRAWER_SESSIONS = "pos_cash_drawer_sessions"
    LOYALTY_TRANSACTIONS = "loyalty_transactions"
    LOYALTY_SETTINGS = "loyalty_settings"
    INVENTORY_TRANSFERS = "inventory_transfers"
    INVENTORY_TRANSFER_ITEMS = "inventory_transfer_items"
    RECEIPT_SETTINGS = "receipt_settings"
    POS_HELD_RECEIPTS = "pos_held_receipts"
    STAFF_PROFILES = "staff_profiles"


# RLS Policy names
class Policies:
    # Outlets
    OUTLETS_SUPER_ADMIN_ALL = "Super admins can manage all outlets"
    OUTLETS_USERS_VIEW_OWN = "Users can view their own outlet"
    OUTLETS_USERS_UPDATE_OWN = "Users can update their own outlet"
    
    # Users
    USERS_SUPER_ADMIN_ALL = "Super admins can manage all users"
    USERS_VIEW_OUTLET = "Users can view users in their outlet"
    USERS_UPDATE_OUTLET = "Users can update users in their outlet"
    USERS_DELETE_OUTLET = "Users can delete users in their outlet"
    
    # Vendors
    VENDORS_SUPER_ADMIN_ALL = "Super admins can manage all vendors"
    VENDORS_VIEW_OUTLET = "Users can view vendors in their outlet"
    VENDORS_MANAGE_OUTLET = "Users can manage vendors in their outlet"
    
    # Invoices
    INVOICES_SUPER_ADMIN_ALL = "Super admins can manage all invoices"
    INVOICES_VIEW_OUTLET = "Users can view invoices in their outlet"
    INVOICES_MANAGE_OUTLET = "Users can manage invoices in their outlet"
    
    # Expenses
    EXPENSES_SUPER_ADMIN_ALL = "Super admins can manage all expenses"
    EXPENSES_VIEW_OUTLET = "Users can view expenses in their outlet"
    EXPENSES_MANAGE_OUTLET = "Users can manage expenses in their outlet"
    
    # User Invitations
    INVITATIONS_SUPER_ADMIN_ALL = "Super admins can manage all user invitations"
    INVITATIONS_VIEW_OUTLET = "Users can view invitations for their outlet"
    INVITATIONS_CREATE_OUTLET = "Users can create invitations for their outlet"
    INVITATIONS_UPDATE_OUTLET = "Users can update invitations for their outlet"
