"""
Script to verify pos_held_receipts table exists in Supabase
and check database architecture for duplicates/unnecessary tables
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from supabase import create_client, Client
from app.core.config import settings
import json

def check_table_exists(supabase: Client, table_name: str) -> bool:
    """Check if a table exists by trying to query it"""
    try:
        result = supabase.table(table_name).select("id").limit(1).execute()
        return True
    except Exception as e:
        if "relation" in str(e).lower() or "does not exist" in str(e).lower():
            return False
        # Other errors might mean table exists but has no data or permission issues
        print(f"  ⚠️  Error checking {table_name}: {e}")
        return None

def get_table_info(supabase: Client, table_name: str) -> dict:
    """Get basic info about a table"""
    try:
        # Try to get column info by querying with limit 0
        result = supabase.table(table_name).select("*").limit(0).execute()
        return {
            "exists": True,
            "columns": list(result.data[0].keys()) if result.data else []
        }
    except Exception as e:
        return {
            "exists": False,
            "error": str(e)
        }

def list_all_tables(supabase: Client) -> list:
    """List all tables in the database"""
    # Query information_schema to get table list
    # Note: This requires direct SQL access, which Supabase client doesn't provide easily
    # We'll try to query common tables instead
    common_tables = [
        "outlets", "users", "customers", "vendors", "invoices", "invoice_items",
        "expenses", "daily_reports", "eod", "business_settings", "user_invitations",
        "audit_entries", "payments", "anomalies", "approvals", "files",
        "pos_products", "pos_transactions", "pos_transaction_items", "pos_held_receipts",
        "pos_stock_movements", "pos_stock_transfers", "pos_stock_transfer_items",
        "pos_sync_queue", "pos_cash_drawer_sessions", "loyalty_transactions", "loyalty_settings",
        "inventory_transfers", "inventory_transfer_items", "receipt_settings"
    ]
    
    existing_tables = []
    for table in common_tables:
        if check_table_exists(supabase, table):
            existing_tables.append(table)
    
    return existing_tables

def analyze_table_relationships():
    """Analyze potential duplicate or unnecessary tables"""
    # Define table groups that might have overlaps
    analysis = {
        "pos_transactions_vs_invoices": {
            "description": "Check if pos_transactions and invoices serve similar purposes",
            "tables": ["pos_transactions", "invoices"],
            "concern": "Both might store sales transactions - could potentially be unified"
        },
        "pos_products_vs_invoice_items": {
            "description": "Check product storage",
            "tables": ["pos_products", "invoice_items"],
            "concern": "pos_products is for POS catalog, invoice_items is for invoice line items - different purposes"
        },
        "stock_movements_duplicates": {
            "description": "Check for duplicate stock movement tables",
            "tables": ["pos_stock_movements", "inventory_transfers"],
            "concern": "Both track inventory changes - check if they overlap"
        },
        "held_receipts_check": {
            "description": "Verify pos_held_receipts table",
            "tables": ["pos_held_receipts"],
            "concern": "New table - verify it exists and has correct structure"
        }
    }
    return analysis

def main():
    print("=" * 70)
    print("Supabase Database Architecture Verification")
    print("=" * 70)
    print()
    
    try:
        # Initialize Supabase client
        print("🔗 Connecting to Supabase...")
        supabase_admin = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY
        )
        print(f"✅ Connected to: {settings.SUPABASE_URL}")
        print()
        
        # Check pos_held_receipts table
        print("=" * 70)
        print("1. VERIFYING pos_held_receipts TABLE")
        print("=" * 70)
        
        table_name = "pos_held_receipts"
        exists = check_table_exists(supabase_admin, table_name)
        
        if exists:
            print(f"✅ Table '{table_name}' EXISTS")
            
            # Get table info
            info = get_table_info(supabase_admin, table_name)
            if info.get("exists"):
                print(f"   Columns: {', '.join(info.get('columns', []))}")
                
                # Try to get count
                try:
                    result = supabase_admin.table(table_name).select("id", count="exact").execute()
                    count = result.count if hasattr(result, 'count') else len(result.data) if result.data else 0
                    print(f"   Records: {count}")
                except:
                    pass
        else:
            print(f"❌ Table '{table_name}' DOES NOT EXIST")
            print("   Please run the migration script: backend/database/create-pos-held-receipts-table.sql")
        
        print()
        
        # List all POS-related tables
        print("=" * 70)
        print("2. LISTING ALL POS-RELATED TABLES")
        print("=" * 70)
        
        pos_tables = [
            "pos_products", "pos_transactions", "pos_transaction_items",
            "pos_held_receipts", "pos_stock_movements", "pos_stock_transfers",
            "pos_stock_transfer_items", "pos_sync_queue", "pos_cash_drawer_sessions"
        ]
        
        for table in pos_tables:
            exists = check_table_exists(supabase_admin, table)
            status = "✅ EXISTS" if exists else "❌ MISSING"
            print(f"   {status}: {table}")
        
        print()
        
        # Analyze potential duplicates
        print("=" * 70)
        print("3. ANALYZING TABLE ARCHITECTURE FOR DUPLICATES")
        print("=" * 70)
        
        analysis = analyze_table_relationships()
        
        for key, analysis_item in analysis.items():
            print(f"\n📋 {analysis_item['description']}")
            print(f"   Tables: {', '.join(analysis_item['tables'])}")
            print(f"   Concern: {analysis_item['concern']}")
            
            # Check if tables exist
            for table in analysis_item['tables']:
                exists = check_table_exists(supabase_admin, table)
                status = "✅" if exists else "❌"
                print(f"      {status} {table}")
        
        print()
        print("=" * 70)
        print("4. RECOMMENDATIONS")
        print("=" * 70)
        
        # Check for specific concerns
        pos_transactions_exists = check_table_exists(supabase_admin, "pos_transactions")
        invoices_exists = check_table_exists(supabase_admin, "invoices")
        
        if pos_transactions_exists and invoices_exists:
            print("\n⚠️  NOTE: Both 'pos_transactions' and 'invoices' exist")
            print("   - pos_transactions: For POS sales transactions")
            print("   - invoices: For customer invoicing")
            print("   ✓ These serve different purposes and should remain separate")
        
        pos_stock_exists = check_table_exists(supabase_admin, "pos_stock_movements")
        inventory_transfers_exists = check_table_exists(supabase_admin, "inventory_transfers")
        
        if pos_stock_exists and inventory_transfers_exists:
            print("\n⚠️  NOTE: Both stock movement tables exist")
            print("   - pos_stock_movements: General stock movements (sales, adjustments, etc.)")
            print("   - inventory_transfers: Inter-outlet transfers")
            print("   ✓ These serve different purposes - transfers are a specific type of movement")
        
        print("\n✅ Architecture analysis complete!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
