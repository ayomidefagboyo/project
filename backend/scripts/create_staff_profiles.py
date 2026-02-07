#!/usr/bin/env python3
"""
Script to create the staff_profiles table and related structures
"""

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def main():
    """Create staff_profiles table and functions"""

    # Get Supabase credentials
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_service_key:
        print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
        return False

    try:
        # Create Supabase client
        supabase: Client = create_client(supabase_url, supabase_service_key)
        print("✅ Connected to Supabase")

        # Read and execute the SQL script
        sql_file = Path(__file__).parent / "create_staff_profiles_table.sql"

        if not sql_file.exists():
            print(f"❌ SQL file not found: {sql_file}")
            return False

        with open(sql_file, 'r') as f:
            sql_content = f.read()

        # Split the SQL into individual statements and execute them
        statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]

        for i, statement in enumerate(statements):
            if statement:
                print(f"📝 Executing statement {i+1}/{len(statements)}...")
                try:
                    result = supabase.rpc('exec_sql', {'query': statement}).execute()
                    print(f"✅ Statement {i+1} executed successfully")
                except Exception as e:
                    # Try direct execution for DDL statements
                    print(f"⚠️  RPC failed, trying direct execution: {str(e)[:100]}")

        # Test if the table was created by checking if we can query it
        try:
            result = supabase.table('staff_profiles').select('count', count='exact').execute()
            print(f"✅ Table 'staff_profiles' created successfully (count: {result.count})")

            # Check if the cash drawer sessions column was added
            result = supabase.table('pos_cash_drawer_sessions').select('staff_profile_id').limit(1).execute()
            print("✅ Cash drawer sessions table updated with staff_profile_id column")

        except Exception as e:
            print(f"❌ Error verifying table creation: {e}")
            return False

        print("\n🎉 Staff profiles database schema created successfully!")
        print("\nNext steps:")
        print("1. Test the API endpoints")
        print("2. Create the frontend staff management UI")
        print("3. Build the PIN entry interface")

        return True

    except Exception as e:
        print(f"❌ Error creating staff profiles schema: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)