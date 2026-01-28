#!/usr/bin/env python3
"""
Apply POS System Migration to Supabase Database
"""

import os
import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')

def apply_migration():
    """Apply the POS migration to Supabase"""

    try:
        # Check migration file exists
        migration_file = Path("backend/database/pos-system-migration.sql")
        if not migration_file.exists():
            print(f"❌ Migration file not found: {migration_file}")
            return False

        print("📖 POS Migration file ready!")
        print("📁 Location:", migration_file.absolute())
        print()

        # Get Supabase details
        supabase_url = os.getenv('SUPABASE_URL')
        print("🗄️ Target Database:", supabase_url)
        print()

        print("🚀 NEXT STEP: Apply migration to Supabase")
        print("=" * 60)
        print("Since we can't execute raw SQL via Python client, you need to:")
        print()
        print("1. Open Supabase Dashboard:")
        print("   https://supabase.com/dashboard/project/swxxvbmjccbzqvywgapo")
        print()
        print("2. Go to 'SQL Editor' (left sidebar)")
        print()
        print("3. Click 'New query'")
        print()
        print("4. Copy ALL contents from:")
        print(f"   {migration_file.absolute()}")
        print()
        print("5. Paste into SQL Editor and click 'Run'")
        print()
        print("📊 This will create 8 new POS tables:")
        print("   • pos_products")
        print("   • pos_transactions")
        print("   • pos_transaction_items")
        print("   • pos_stock_movements")
        print("   • pos_stock_transfers")
        print("   • pos_stock_transfer_items")
        print("   • pos_sync_queue")
        print("   • pos_cash_drawer_sessions")
        print()
        print("🔗 Fully integrated with your existing tables!")
        print("✅ Complete with RLS policies and sample data")

        # Show file contents summary
        with open(migration_file, 'r') as f:
            content = f.read()
            lines = len(content.split('\n'))
            print(f"\n📄 Migration file: {lines} lines of SQL ready to execute")

        return True

    except Exception as e:
        print(f"❌ Error preparing migration: {e}")
        return False

if __name__ == "__main__":
    success = apply_migration()
    if success:
        print("\n🎯 After running the migration, return here to continue with API development!")
    else:
        print("\n❌ Migration preparation failed")
        sys.exit(1)