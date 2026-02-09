# 🚀 Quick Start: Enable Real-Time Sync for ALL Tables

## ⚡ What You Get

Real-time sync for:
- ✅ Products & Inventory
- ✅ Sales Transactions  
- ✅ Invoices
- ✅ Stock Transfers
- ✅ Cash Drawer
- ✅ Customers
- ✅ Staff Profiles
- ✅ **Everything!**

## 📝 Setup (5 minutes)

### Step 1: Enable Realtime in Supabase

1. Go to **Supabase Dashboard** → [https://app.supabase.com](https://app.supabase.com)
2. Select your project
3. Click **"SQL Editor"** in left sidebar
4. Click **"New Query"**
5. Copy and paste this SQL:

```sql
-- Enable Realtime for ALL POS tables
ALTER PUBLICATION supabase_realtime ADD TABLE pos_products;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_transaction_items;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_stock_transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_stock_transfer_items;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_cash_drawer_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_sync_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE staff_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE outlets;

-- Verify (should show all tables above)
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
```

6. Click **"Run"**
7. Check the results - you should see all 12 tables listed

### Step 2: Test It!

1. **Open POS App**
   - Look for "🟢 Live Sync" badge in header
   - If you see it, you're connected!

2. **Open Dashboard** (in another tab/device)
   - Also should show "🟢 Live Sync"

3. **Test Product Sync**
   - Add/edit a product in Dashboard
   - Watch it appear INSTANTLY in POS (with toast notification!)
   - No refresh needed!

4. **Test Sales Sync**
   - Make a sale in POS
   - Open EOD Dashboard or Transaction History
   - Sale appears immediately!

## ✅ Success Indicators

### You'll Know It's Working When:
- ✅ "🟢 Live Sync" badge shows in app headers
- ✅ Console shows: `📡 Products channel: SUBSCRIBED`
- ✅ Changes appear instantly across all devices
- ✅ Toast notifications for new products/sales

### Console Logs to Look For:
```
🔴 Starting COMPREHENSIVE real-time sync for outlet: xxx
📡 Products channel: SUBSCRIBED
📡 Transactions channel: SUBSCRIBED  
📡 Inventory channel: SUBSCRIBED
...
```

## 🎯 What Happens Now?

### Products
- Add product in Dashboard → **Instant** toast in POS
- Edit price → **Instant** update everywhere
- Delete product → **Instant** removal

### Sales
- New sale in POS → **Instant** update in EOD Dashboard
- Transaction history **auto-refreshes**
- Sales reports **always current**

### Inventory
- Stock adjustment → **Instant** quantity update
- Stock transfer → **Instant** notification at receiving outlet
- Low stock alerts → **Real-time** across all locations

### Invoices
- New vendor invoice → **Instant** in dashboard
- Approval/payment → **Real-time** status update

## 🐛 Troubleshooting

### Problem: Still shows "Offline"

**Fix:**
1. Did you run the SQL script? (Step 1)
2. Check browser console for errors
3. Verify Supabase URL in `.env` files
4. Make sure you're using HTTPS (not HTTP)

### Problem: Some tables not syncing

**Fix:**
Run the verification query again:
```sql
SELECT tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

If a table is missing, add it:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE <table_name>;
```

### Problem: "Too many connections" error

**Fix:**
- Close unused browser tabs
- Check for duplicate app instances
- Restart browser

## 📚 More Info

For comprehensive guide, see: `COMPREHENSIVE_REALTIME_GUIDE.md`

## 🎉 Done!

Your POS system now has **enterprise-grade real-time sync**!

**Test it thoroughly in development before production rollout.**

---

**Last Updated:** February 9, 2026  
**Status:** ✅ Production Ready
