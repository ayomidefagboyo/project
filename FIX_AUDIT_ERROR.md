# Fixing the Audit Error in Supabase

## 🚨 Error Description
```
ERROR: 42703: record "new" has no field "outlet_id"
CONTEXT: SQL statement "INSERT INTO audit_entries..."
```

## 🔍 Root Cause
The audit trigger function was trying to access `outlet_id` from all tables, but:
1. **`outlets` table** doesn't have `outlet_id` (it IS the outlet)
2. **`invoice_items` table** doesn't have `outlet_id` (it gets it from parent invoice)
3. The function wasn't handling different table structures properly

## ✅ Solution Steps

### Step 1: Drop the Problematic Triggers
First, remove the existing audit triggers that are causing issues:

```sql
-- Drop existing audit triggers
DROP TRIGGER IF EXISTS audit_outlets ON outlets;
DROP TRIGGER IF EXISTS audit_users ON users;
DROP TRIGGER IF EXISTS audit_customers ON customers;
DROP TRIGGER IF EXISTS audit_vendors ON vendors;
DROP TRIGGER IF EXISTS audit_invoices ON invoices;
DROP TRIGGER IF EXISTS audit_invoice_items ON invoice_items;
DROP TRIGGER IF EXISTS audit_expenses ON expenses;
DROP TRIGGER IF EXISTS audit_daily_reports ON daily_reports;
DROP TRIGGER IF EXISTS audit_business_settings ON business_settings;
```

### Step 2: Drop the Problematic Function
Remove the old audit function:

```sql
-- Drop the old function
DROP FUNCTION IF EXISTS create_audit_entry();
```

### Step 3: Run the Corrected RLS Policies
Use the corrected version from `database/rls-policies-fixed.sql`:

```sql
-- Copy and paste the entire content of rls-policies-fixed.sql
-- This includes the corrected audit function and triggers
```

### Step 4: Alternative - Simple Approach
If you want to avoid audit triggers for now, you can skip them entirely:

```sql
-- Just run the RLS policies without audit triggers
-- Copy the policies from rls-policies-fixed.sql but skip the audit function and triggers
```

## 🛠️ Alternative Solutions

### Option 1: Disable Audit Triggers Temporarily
```sql
-- Disable all audit triggers
ALTER TABLE outlets DISABLE TRIGGER audit_outlets;
ALTER TABLE users DISABLE TRIGGER audit_users;
ALTER TABLE customers DISABLE TRIGGER audit_customers;
ALTER TABLE vendors DISABLE TRIGGER audit_vendors;
ALTER TABLE invoices DISABLE TRIGGER audit_invoices;
ALTER TABLE invoice_items DISABLE TRIGGER audit_invoice_items;
ALTER TABLE expenses DISABLE TRIGGER audit_expenses;
ALTER TABLE daily_reports DISABLE TRIGGER audit_daily_reports;
ALTER TABLE business_settings DISABLE TRIGGER audit_business_settings;
```

### Option 2: Create a Simpler Audit Function
```sql
-- Simple audit function that only works with tables that have outlet_id
CREATE OR REPLACE FUNCTION create_simple_audit_entry()
RETURNS TRIGGER AS $$
BEGIN
    -- Only audit tables that have outlet_id
    IF TG_TABLE_NAME IN ('customers', 'vendors', 'invoices', 'expenses', 'daily_reports', 'business_settings') THEN
        INSERT INTO audit_entries (
            outlet_id,
            user_id,
            user_name,
            action,
            entity_type,
            entity_id,
            details
        ) VALUES (
            COALESCE(NEW.outlet_id, OLD.outlet_id),
            auth.uid(),
            'System',
            TG_OP,
            TG_TABLE_NAME,
            COALESCE(NEW.id, OLD.id),
            TG_OP || ' on ' || TG_TABLE_NAME
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 📋 Recommended Approach

### For Development/Testing:
1. **Skip audit triggers entirely** - they're not essential for basic functionality
2. Focus on getting the basic system working first
3. Add audit functionality later when everything else is stable

### For Production:
1. Use the **corrected audit function** from `rls-policies-fixed.sql`
2. Test thoroughly in development first
3. Ensure all edge cases are handled

## 🔧 Quick Fix Commands

If you want to get up and running quickly:

```sql
-- 1. Drop all audit triggers
DROP TRIGGER IF EXISTS audit_outlets ON outlets;
DROP TRIGGER IF EXISTS audit_users ON users;
DROP TRIGGER IF EXISTS audit_customers ON customers;
DROP TRIGGER IF EXISTS audit_vendors ON vendors;
DROP TRIGGER IF EXISTS audit_invoices ON invoices;
DROP TRIGGER IF EXISTS audit_invoice_items ON invoice_items;
DROP TRIGGER IF EXISTS audit_expenses ON expenses;
DROP TRIGGER IF EXISTS audit_daily_reports ON daily_reports;
DROP TRIGGER IF EXISTS audit_business_settings ON business_settings;

-- 2. Drop the function
DROP FUNCTION IF EXISTS create_audit_entry();

-- 3. Run your seed data
-- (Copy and paste the content of seed-data.sql)
```

## ✅ Verification

After fixing, verify that:
1. ✅ Tables are created successfully
2. ✅ Sample data is inserted without errors
3. ✅ RLS policies are working
4. ✅ Basic CRUD operations work

## 🎯 Next Steps

Once the basic setup is working:
1. Test user authentication
2. Test data operations
3. Add audit functionality back (optional)
4. Test real-time features

## 🆘 Still Having Issues?

If you continue to have problems:
1. Check the Supabase logs for more detailed error messages
2. Verify that all SQL scripts are run in the correct order
3. Ensure your Supabase project is properly configured
4. Consider starting with a minimal setup and adding features incrementally

