-- ===============================================
-- Enable Realtime for ALL POS Tables
-- Run this in Supabase SQL Editor
-- ===============================================

-- Enable Realtime replication for ALL POS-related tables
ALTER PUBLICATION supabase_realtime ADD TABLE pos_products;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_transaction_items;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_stock_transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_stock_transfer_items;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_cash_drawer_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_sync_queue;

-- Enable for supporting tables
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE staff_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE outlets;

-- Optional: Enable for vendor/supplier related tables
-- ALTER PUBLICATION supabase_realtime ADD TABLE vendors;
-- ALTER PUBLICATION supabase_realtime ADD TABLE vendor_invoices;

-- Verify all tables were added successfully
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- You should see all the above tables in the results
-- Look for tables starting with 'pos_' and others like 'customers', 'invoices', etc.

-- ===============================================
-- SUCCESS INDICATORS:
-- ===============================================
-- After running this script, you should see:
-- ✅ pos_products
-- ✅ pos_transactions
-- ✅ pos_transaction_items
-- ✅ pos_stock_movements
-- ✅ pos_stock_transfers
-- ✅ pos_stock_transfer_items
-- ✅ pos_cash_drawer_sessions
-- ✅ pos_sync_queue
-- ✅ customers
-- ✅ invoices
-- ✅ staff_profiles
-- ✅ outlets
-- ===============================================
