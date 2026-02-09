# 🐛 Realtime Debug Guide

## Issue: Channels Showing "CLOSED" Status

You're seeing:
```
📡 Products channel: CLOSED
📡 Inventory channel: CLOSED
🔴 Starting COMPREHENSIVE real-time sync
🔴 Stopping comprehensive real-time sync
```

This means:
- ✅ Realtime publication is configured (tables are members)
- ✅ Frontend has correct Supabase credentials
- ❌ **Realtime service is NOT ENABLED in Supabase Dashboard**

---

## ✅ Solution: Enable Realtime in Supabase Dashboard

### Step 1: Go to Supabase Dashboard
1. Visit https://app.supabase.com
2. Select your project: `swxxvbmjccbzqvywgapo`

### Step 2: Enable Realtime Service
1. Click **"Database"** in left sidebar
2. Click **"Replication"** tab
3. Look for **"Realtime"** section
4. **Enable the "Realtime" toggle** if it's off
5. You should see `supabase_realtime` publication listed

### Step 3: Verify Tables in Publication
In the same "Replication" page, expand the `supabase_realtime` publication:

✅ **Should see these tables:**
- pos_products
- pos_transactions
- pos_transaction_items
- pos_stock_movements
- pos_stock_transfers
- pos_cash_drawer_sessions
- customers
- invoices
- staff_profiles
- outlets

If tables are missing, run this SQL in **SQL Editor**:
```sql
-- Only add tables that are missing
ALTER PUBLICATION supabase_realtime ADD TABLE pos_products;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_transactions;
-- ... etc (only the ones not already added)
```

### Step 4: Alternative - Enable via API Settings
1. Click **"Settings"** in left sidebar (bottom)
2. Click **"API"** tab
3. Scroll to **"Realtime"** section
4. Make sure **"Enable Realtime"** is checked/toggled ON

---

## 🧪 Test Realtime Connection

After enabling Realtime:

1. **Refresh your Dashboard app** (hard refresh: `Cmd+Shift+R`)
2. **Open Browser Console** (F12)
3. **Look for these logs:**
   ```
   🔴 Starting COMPREHENSIVE real-time sync for outlet: xxx
   📡 Products channel: SUBSCRIBED ✅
   📡 Transactions channel: SUBSCRIBED ✅
   📡 Inventory channel: SUBSCRIBED ✅
   ```

4. **Test it:**
   - Open POS app in another tab
   - Add a product
   - Watch Dashboard console - should show:
     ```
     📦 Product changed: INSERT { name: "...", ... }
     ```

---

## 🔍 Still Not Working?

### Check 1: Browser Console Errors
Look for:
- `WebSocket connection failed`
- `401 Unauthorized` 
- `403 Forbidden`
- `realtime` errors

### Check 2: Supabase Project Limits
Free tier limits:
- ✅ Realtime: 200 concurrent connections
- ✅ 2 GB database
- ✅ 5 GB bandwidth

Check usage in Dashboard → Settings → Usage

### Check 3: Network/Firewall
- Realtime uses WebSocket protocol
- Check if corporate firewall blocks WebSockets
- Try on different network/device

### Check 4: Supabase Service Status
Visit: https://status.supabase.com
Check if Realtime service is operational

---

## 📊 Products Not Loading?

You're also seeing "0 products" - let's verify:

### Check Products in Database:
```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) FROM pos_products;
SELECT * FROM pos_products LIMIT 5;
```

### Check in POS App:
1. Open POS app: http://localhost:5175
2. Login with staff PIN
3. Can you see products there?
4. If yes → products exist, just need Dashboard to load them

### Check IndexedDB Cache:
1. Open Browser DevTools (F12)
2. Go to **Application** tab
3. Click **IndexedDB** → **CompazzPOS** → **products**
4. Are products cached there?

If products show in POS but not Dashboard:
- Hard refresh Dashboard (`Cmd+Shift+R`)
- Clear browser cache for Dashboard
- Check console for "Loading products" logs

---

## 🚀 Expected Behavior After Fix

**Console Logs (Dashboard):**
```
🔴 Starting COMPREHENSIVE real-time sync for outlet: d8215344...
📡 Products channel: SUBSCRIBED
📡 Transactions channel: SUBSCRIBED
📡 Inventory channel: SUBSCRIBED
📦 Loading products for outlet: fadob mall (ID: d8215344...)
✅ Loaded 50 products from offline cache (shared with POS)
```

**UI:**
- Products show in table
- "Total Products: 50"
- Real-time updates work (add product in one tab, see it in another instantly)

---

## 💡 Quick Troubleshooting Checklist

- [ ] Realtime enabled in Supabase Dashboard → Database → Replication
- [ ] Realtime enabled in Supabase Dashboard → Settings → API
- [ ] Hard refreshed browser (`Cmd+Shift+R`)
- [ ] Cleared browser cache
- [ ] Checked browser console for errors
- [ ] Verified products exist in database (SQL query)
- [ ] Tested in POS app (products show there?)
- [ ] Tried different browser/incognito mode
- [ ] Checked Supabase service status

---

## 📞 Still Stuck?

Share these details:
1. Screenshot of Supabase Dashboard → Database → Replication page
2. Browser console logs (full output)
3. Result of `SELECT COUNT(*) FROM pos_products;`
4. Does POS app show products?
5. Any errors in Supabase Dashboard → Logs?

---

**Last Updated:** February 9, 2026
