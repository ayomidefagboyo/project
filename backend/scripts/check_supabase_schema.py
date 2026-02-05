"""
Direct Supabase connection script to verify pos_held_receipts table
and analyze database architecture
"""

import os
import sys
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file
env_path = Path(__file__).parent.parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
else:
    # Try backend/.env
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)

# Get Supabase credentials from environment
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Missing Supabase credentials!")
    print("Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file")
    print(f"Looking for .env at: {env_path}")
    sys.exit(1)

try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Supabase client not installed. Run: pip install supabase")
    sys.exit(1)

def check_table_exists(supabase: Client, table_name: str) -> tuple[bool, dict]:
    """Check if a table exists and get its structure"""
    try:
        # Try to query the table with limit 0 to get column info
        result = supabase.table(table_name).select("*").limit(0).execute()
        
        # Try to get one record to see actual structure
        try:
            sample = supabase.table(table_name).select("*").limit(1).execute()
            count_result = supabase.table(table_name).select("id", count="exact").limit(0).execute()
            record_count = count_result.count if hasattr(count_result, 'count') else 0
        except:
            record_count = 0
        
        return True, {
            "exists": True,
            "record_count": record_count,
            "columns": list(result.data[0].keys()) if result.data and len(result.data) > 0 else []
        }
    except Exception as e:
        error_msg = str(e).lower()
        if "relation" in error_msg or "does not exist" in error_msg or "42p01" in error_msg:
            return False, {"exists": False, "error": "Table does not exist"}
        else:
            # Table might exist but have permission issues or be empty
            return None, {"exists": None, "error": str(e)}

def get_all_pos_tables():
    """List of all POS-related tables to check"""
    return [
        "pos_products",
        "pos_transactions", 
        "pos_transaction_items",
        "pos_held_receipts",
        "pos_stock_movements",
        "pos_stock_transfers",
        "pos_stock_transfer_items",
        "pos_sync_queue",
        "pos_cash_drawer_sessions",
        "pos_loyalty_transactions",
        "pos_loyalty_settings",
        "pos_customers",
        "pos_inventory_transfers",
        "pos_inventory_transfer_items"
    ]

def analyze_architecture(supabase: Client):
    """Analyze database architecture for duplicates and unnecessary tables"""
    print("\n" + "=" * 70)
    print("ARCHITECTURE ANALYSIS")
    print("=" * 70)
    
    # Check for potential duplicates
    concerns = []
    
    # 1. Check pos_transactions vs invoices
    tx_exists, _ = check_table_exists(supabase, "pos_transactions")
    inv_exists, _ = check_table_exists(supabase, "invoices")
    
    if tx_exists and inv_exists:
        print("\n📋 pos_transactions vs invoices:")
        print("   ✅ Both exist - Different purposes:")
        print("      - pos_transactions: Real-time POS sales")
        print("      - invoices: Customer billing/invoicing")
        print("   ✓ These should remain separate")
    
    # 2. Check stock movement tables
    stock_mov_exists, _ = check_table_exists(supabase, "pos_stock_movements")
    inv_transfers_exists, _ = check_table_exists(supabase, "pos_inventory_transfers")
    pos_transfers_exists, _ = check_table_exists(supabase, "pos_stock_transfers")
    
    if stock_mov_exists and (inv_transfers_exists or pos_transfers_exists):
        print("\n📋 Stock Movement Tables:")
        print("   ✅ Multiple stock-related tables exist:")
        if stock_mov_exists:
            print("      - pos_stock_movements: General stock movements")
        if pos_transfers_exists:
            print("      - pos_stock_transfers: Inter-outlet transfers")
        if inv_transfers_exists:
            print("      - pos_inventory_transfers: Alternative transfer table")
        
        if inv_transfers_exists and pos_transfers_exists:
            concerns.append({
                "type": "DUPLICATE",
                "tables": ["pos_inventory_transfers", "pos_stock_transfers"],
                "issue": "Two transfer tables exist - consider consolidating",
                "recommendation": "Use pos_stock_transfers (from pos-system-migration.sql) and remove pos_inventory_transfers if it's a duplicate"
            })
            print("   ⚠️  WARNING: Both pos_stock_transfers and pos_inventory_transfers exist!")
            print("      Consider consolidating to avoid confusion")
        else:
            print("   ✓ Different purposes - OK to keep separate")
    
    # 3. Check customer tables
    customers_exists, _ = check_table_exists(supabase, "customers")
    pos_customers_exists, _ = check_table_exists(supabase, "pos_customers")
    
    if customers_exists and pos_customers_exists:
        concerns.append({
            "type": "DUPLICATE",
            "tables": ["customers", "pos_customers"],
            "issue": "Two customer tables exist",
            "recommendation": "Consider using one unified customer table or clearly separate by purpose"
        })
        print("\n📋 Customer Tables:")
        print("   ⚠️  WARNING: Both 'customers' and 'pos_customers' exist!")
        print("      - customers: General customer management")
        print("      - pos_customers: POS-specific customers")
        print("   Consider: Use one unified table or clearly separate by purpose")
    
    # Print concerns summary
    if concerns:
        print("\n" + "=" * 70)
        print("⚠️  CONCERNS FOUND")
        print("=" * 70)
        for i, concern in enumerate(concerns, 1):
            print(f"\n{i}. {concern['type']}: {', '.join(concern['tables'])}")
            print(f"   Issue: {concern['issue']}")
            print(f"   Recommendation: {concern['recommendation']}")
    else:
        print("\n✅ No major architectural concerns found!")

def main():
    print("=" * 70)
    print("SUPABASE DATABASE VERIFICATION")
    print("=" * 70)
    print(f"\n🔗 Connecting to: {SUPABASE_URL}")
    
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("✅ Connected successfully!\n")
        
        # 1. Check pos_held_receipts table
        print("=" * 70)
        print("1. VERIFYING pos_held_receipts TABLE")
        print("=" * 70)
        
        exists, info = check_table_exists(supabase, "pos_held_receipts")
        
        if exists:
            print("✅ Table 'pos_held_receipts' EXISTS")
            if info.get("columns"):
                print(f"   Columns ({len(info['columns'])}): {', '.join(info['columns'])}")
            if info.get("record_count") is not None:
                print(f"   Records: {info['record_count']}")
        elif exists is False:
            print("❌ Table 'pos_held_receipts' DOES NOT EXIST")
            print("   Please run: backend/database/create-pos-held-receipts-table.sql")
        else:
            print("⚠️  Could not determine table status")
            print(f"   Error: {info.get('error', 'Unknown')}")
        
        # 2. List all POS tables
        print("\n" + "=" * 70)
        print("2. POS TABLES STATUS")
        print("=" * 70)
        
        pos_tables = get_all_pos_tables()
        existing_tables = []
        missing_tables = []
        
        for table in pos_tables:
            exists, info = check_table_exists(supabase, table)
            if exists:
                status = "✅"
                existing_tables.append(table)
                count = info.get("record_count", "?")
                print(f"   {status} {table:<35} ({count} records)")
            elif exists is False:
                status = "❌"
                missing_tables.append(table)
                print(f"   {status} {table:<35} (MISSING)")
            else:
                status = "⚠️ "
                print(f"   {status} {table:<35} (UNKNOWN: {info.get('error', 'N/A')})")
        
        print(f"\n   Summary: {len(existing_tables)} existing, {len(missing_tables)} missing")
        
        # 3. Architecture analysis
        analyze_architecture(supabase)
        
        print("\n" + "=" * 70)
        print("✅ VERIFICATION COMPLETE")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n❌ Error connecting to Supabase: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
