# EOD Reporting App - Clean Database Architecture

## Core Tables (Keep These)

### 1. Authentication
```sql
-- Users table (fix the trigger)
users:
  - id (uuid, pk)
  - email (text, unique)
  - name (text)
  - role (enum: 'owner', 'admin', 'manager', 'staff')
  - company_name (text, nullable)
  - business_type (text, nullable)
  - phone (text, nullable)
  - created_at (timestamp)
  - updated_at (timestamp)
```

### 2. Business Structure
```sql
-- Business outlets/locations
outlets:
  - id (uuid, pk)
  - name (text)
  - business_type (text)
  - address (text)
  - owner_id (uuid, fk -> users.id)
  - created_at (timestamp)
```

### 3. EOD Reports (Core Feature)
```sql
-- Daily end-of-day reports
daily_reports:
  - id (uuid, pk)
  - outlet_id (uuid, fk -> outlets.id)
  - report_date (date)
  - sales_cash (decimal)
  - sales_transfer (decimal)
  - sales_pos (decimal)
  - sales_credit (decimal)
  - opening_balance (decimal)
  - closing_balance (decimal)
  - bank_deposit (decimal)
  - inventory_cost (decimal)
  - notes (text, nullable)
  - status (enum: 'draft', 'submitted', 'approved')
  - created_by (uuid, fk -> users.id)
  - submitted_at (timestamp, nullable)
  - approved_at (timestamp, nullable)
  - created_at (timestamp)
```

### 4. Supporting Tables
```sql
-- Expense tracking
expenses:
  - id (uuid, pk)
  - outlet_id (uuid, fk -> outlets.id)
  - amount (decimal)
  - category (text)
  - description (text)
  - receipt_url (text, nullable)
  - expense_date (date)
  - created_by (uuid, fk -> users.id)
  - created_at (timestamp)

-- Document storage for receipts/images
eod_images:
  - id (uuid, pk)
  - report_id (uuid, fk -> daily_reports.id)
  - image_url (text)
  - image_type (enum: 'receipt', 'bank_slip', 'other')
  - uploaded_at (timestamp)
```

## Tables to Remove/Simplify

### Remove These (Over-engineered for EOD app):
- `anomalies` - Not needed for basic EOD
- `approval_workflows` - Keep approval simple in daily_reports.status
- `audit_entries` - Use Supabase built-in audit
- `price_benchmarks` - Not core to EOD reporting
- `business_settings` - Store in outlets table
- `email_queue` - Use Supabase email functions
- `customers` - Not needed for EOD focus
- `invoices` + `invoice_items` - Too complex for manual EOD
- `vendor_invoices` + `vendors` - Use simple expenses table
- `payments` - Track in daily_reports only

### Keep but Simplify:
- `subscriptions` - For payment plans
- `user_invitations` - For team management

## Clean User Roles
```sql
CREATE TYPE user_role AS ENUM (
  'owner',      -- Business owner (default signup)
  'admin',      -- Outlet administrator
  'manager',    -- Store manager
  'staff'       -- Regular employee
);
```

## Migration Strategy
1. Fix auth trigger first (immediate fix for signup)
2. Clean up unused tables
3. Standardize daily_reports as main EOD table
4. Add proper foreign keys and constraints
5. Set up proper RLS policies

This gives you a focused, maintainable database for manual EOD reporting without over-engineering.