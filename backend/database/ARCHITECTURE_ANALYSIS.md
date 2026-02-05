# Database Architecture Analysis

## Table Verification: pos_held_receipts

✅ **Table Created**: `pos_held_receipts`
- **Purpose**: Stores sales that are put on hold (parked carts)
- **Status**: Should exist if migration was run successfully

## Complete Table Inventory

### Core Business Tables
1. **outlets** - Business outlets/locations
2. **users** - User accounts (extends auth.users)
3. **customers** - Customer records (main customer table)
4. **vendors** - Supplier/vendor records
5. **invoices** - Customer invoices
6. **invoice_items** - Invoice line items
7. **expenses** - Business expenses
8. **daily_reports** - Daily business reports
9. **eod** - End of day reports
10. **business_settings** - Business configuration
11. **user_invitations** - User invitation system
12. **audit_entries** - Audit trail
13. **payments** - Payment records
14. **anomalies** - Anomaly tracking
15. **approvals** - Approval workflow
16. **files** - File storage references

### POS System Tables
1. **pos_products** - Product catalog for POS
2. **pos_transactions** - Completed sales transactions
3. **pos_transaction_items** - Transaction line items
4. **pos_held_receipts** ⭐ NEW - Held receipts (parked carts)
5. **pos_stock_movements** - Inventory movement tracking
6. **pos_stock_transfers** - Inter-outlet stock transfers
7. **pos_stock_transfer_items** - Transfer line items
8. **pos_sync_queue** - Offline sync queue
9. **pos_cash_drawer_sessions** - Cash drawer management

### POS Enhancement Tables
1. **pos_customers** ⚠️ - POS-specific customer records
2. **pos_loyalty_transactions** - Loyalty point transactions
3. **pos_loyalty_settings** - Loyalty program settings
4. **pos_inventory_transfers** ⚠️ - Inventory transfers (alternative name?)
5. **pos_inventory_transfer_items** ⚠️ - Transfer items (alternative name?)

### Other Tables
1. **inventory_transfers** - Inventory transfer records
2. **inventory_transfer_items** - Transfer line items
3. **receipt_settings** - Receipt configuration
4. **ocr_processing** - OCR processing records

## ⚠️ Potential Duplicates/Overlaps

### 1. Customer Tables - NEEDS REVIEW
- **`customers`** (main schema) - General customer records
- **`pos_customers`** (enhancements) - POS-specific customers

**Analysis**: 
- These serve different purposes but could potentially be unified
- `customers` is for general CRM
- `pos_customers` is for POS loyalty program
- **Recommendation**: Keep separate if loyalty is POS-specific, but consider linking via foreign key

### 2. Stock Transfer Tables - NEEDS REVIEW
- **`pos_stock_transfers`** (pos-system-migration.sql)
- **`pos_inventory_transfers`** (pos-enhancements-migration.sql)
- **`inventory_transfers`** (possibly from another migration)

**Analysis**:
- `pos_stock_transfers` - Basic inter-outlet transfers
- `pos_inventory_transfers` - Enhanced transfers with approval workflow
- **Recommendation**: Check if `pos_inventory_transfers` replaces `pos_stock_transfers` or if they serve different purposes

### 3. Transaction vs Invoice - OK
- **`pos_transactions`** - Real-time POS sales
- **`invoices`** - Customer invoicing/billing

**Analysis**: ✅ These serve different purposes
- POS transactions are immediate sales
- Invoices are for credit/billing
- **Recommendation**: Keep separate

### 4. Stock Movements - OK
- **`pos_stock_movements`** - General inventory movements
- **`pos_stock_transfers`** / **`pos_inventory_transfers`** - Specific transfer type

**Analysis**: ✅ These complement each other
- Stock movements track all changes (sales, adjustments, transfers)
- Transfers are a specific type of movement
- **Recommendation**: Keep separate, transfers create movements

## ✅ Tables That Are Correctly Separated

1. **pos_products** vs **invoice_items** - Different purposes
2. **pos_transactions** vs **invoices** - Different purposes  
3. **pos_stock_movements** vs **pos_stock_transfers** - General vs specific
4. **pos_held_receipts** - Unique purpose, no duplicates

## 🔍 Verification Queries for Supabase

Run these in Supabase SQL Editor to verify:

```sql
-- 1. Check if pos_held_receipts exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'pos_held_receipts'
);

-- 2. Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pos_held_receipts'
ORDER BY ordinal_position;

-- 3. Check for duplicate customer tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%customer%'
ORDER BY table_name;

-- 4. Check for duplicate transfer tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%transfer%' OR table_name LIKE '%stock%')
ORDER BY table_name;

-- 5. List all POS tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'pos_%'
ORDER BY table_name;
```

## 📋 Recommendations

1. **Verify pos_held_receipts table exists** - Run verification queries above
2. **Review customer table duplication** - Decide if `pos_customers` should link to `customers` or be separate
3. **Review transfer table naming** - Check if `pos_stock_transfers` and `pos_inventory_transfers` are duplicates
4. **Consider table inheritance** - PostgreSQL supports table inheritance, but current structure is fine for this use case
5. **Document relationships** - Create ER diagram showing table relationships

## 🎯 Action Items

- [ ] Run verification queries in Supabase
- [ ] Confirm pos_held_receipts table structure matches schema
- [ ] Review and potentially consolidate customer tables
- [ ] Review and potentially consolidate transfer tables
- [ ] Update documentation with final table structure
