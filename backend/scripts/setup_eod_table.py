#!/usr/bin/env python3
"""
Setup script to create the unified EOD table in Supabase.
This script reads the SQL file and executes it using the Supabase admin client.
"""

import os
import sys
from pathlib import Path

# Add the parent directory to the path so we can import app modules
sys.path.append(str(Path(__file__).parent.parent))

from app.core.database import get_supabase_admin
from app.core.config import settings
import asyncio


async def setup_eod_table():
    """Create the EOD table using the SQL script"""
    try:
        # Read the SQL script
        sql_file_path = Path(__file__).parent / "create_eod_table.sql"

        if not sql_file_path.exists():
            raise FileNotFoundError(f"SQL script not found: {sql_file_path}")

        with open(sql_file_path, 'r') as f:
            sql_content = f.read()

        print("🔗 Connecting to Supabase...")
        print(f"Database URL: {settings.SUPABASE_URL}")

        # Initialize database connection
        from app.core.database import init_db
        await init_db()

        # Get admin client
        supabase = get_supabase_admin()

        print("📝 Executing SQL script to create EOD table...")

        # Execute the SQL script
        # Note: Supabase Python client doesn't have direct SQL execution
        # You'll need to run this SQL manually in the Supabase dashboard
        # or use a direct PostgreSQL connection

        print("⚠️  IMPORTANT:")
        print("The SQL script has been created at:")
        print(f"   {sql_file_path}")
        print()
        print("Please run this SQL script manually in your Supabase dashboard:")
        print("1. Go to https://supabase.com/dashboard")
        print("2. Select your project")
        print("3. Go to SQL Editor")
        print("4. Copy and paste the SQL content from the file above")
        print("5. Click 'Run'")
        print()
        print("Alternatively, you can run it via psql:")
        print(f"   psql 'your-connection-string' -f {sql_file_path}")

        # Try to verify if table exists (this will work after manual creation)
        try:
            result = supabase.table('eod').select('id').limit(1).execute()
            print("✅ EOD table already exists and is accessible!")
            return True
        except Exception as e:
            print(f"ℹ️  EOD table not yet created (this is expected): {e}")
            return False

    except Exception as e:
        print(f"❌ Error setting up EOD table: {e}")
        return False


def print_sql_content():
    """Print the SQL content for manual execution"""
    sql_file_path = Path(__file__).parent / "create_eod_table.sql"

    if sql_file_path.exists():
        print("\n" + "="*80)
        print("SQL SCRIPT CONTENT (copy this to Supabase SQL Editor):")
        print("="*80)
        with open(sql_file_path, 'r') as f:
            print(f.read())
        print("="*80)
    else:
        print("❌ SQL script file not found!")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Setup EOD table in Supabase")
    parser.add_argument("--show-sql", action="store_true",
                       help="Print the SQL script content")

    args = parser.parse_args()

    if args.show_sql:
        print_sql_content()
    else:
        asyncio.run(setup_eod_table())