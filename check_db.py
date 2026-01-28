#!/usr/bin/env python3
"""
Quick script to check existing tables in Supabase
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

def check_tables():
    """Check existing tables in Supabase database"""

    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }

    try:
        # Query information_schema to get table names
        url = f"{SUPABASE_URL}/rest/v1/rpc/get_table_names"

        # Alternative: Direct query to a known table to test connection
        test_url = f"{SUPABASE_URL}/rest/v1/outlets?select=id&limit=1"

        response = requests.get(test_url, headers=headers)

        if response.status_code == 200:
            print("✅ Supabase connection successful!")

            # Try to get table information using SQL query
            sql_query = """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
            """

            # Use PostgREST to execute raw SQL
            sql_url = f"{SUPABASE_URL}/rest/v1/rpc/get_tables"

            # For now, let's just list some known tables
            known_tables = [
                'outlets', 'users', 'vendors', 'invoices', 'expenses',
                'payments', 'daily_reports', 'eod', 'business_settings',
                'user_invitations', 'audit_entries', 'anomalies',
                'approvals', 'files', 'ocr_processing'
            ]

            print("\n🗄️ Checking existing tables:")
            for table in known_tables:
                check_url = f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit=0"
                table_response = requests.get(check_url, headers=headers)

                if table_response.status_code == 200:
                    print(f"  ✅ {table}")
                elif table_response.status_code == 404:
                    print(f"  ❌ {table} (not found)")
                else:
                    print(f"  ⚠️ {table} (status: {table_response.status_code})")

        else:
            print(f"❌ Connection failed: {response.status_code}")
            print(f"Response: {response.text}")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_tables()