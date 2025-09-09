# Test Accounts Quick Reference

## 🔐 Login Credentials

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| **Super Admin** | `superadmin@compass.test` | `SuperAdmin123!` | All outlets, all features |
| **Outlet Admin** | `outletadmin@compass.test` | `OutletAdmin123!` | One outlet, full management |
| **Manager** | `manager@compass.test` | `Manager123!` | Sales, inventory, expenses, reports |
| **Cashier** | `cashier@compass.test` | `Cashier123!` | Sales, view inventory/expenses |
| **Waiter** | `waiter@compass.test` | `Waiter123!` | Sales only |
| **Kitchen Staff** | `kitchen@compass.test` | `Kitchen123!` | Dashboard, inventory |
| **Inventory Staff** | `inventory@compass.test` | `Inventory123!` | Dashboard, manage inventory |
| **Accountant** | `accountant@compass.test` | `Accountant123!` | Expenses, reports, analytics |
| **Viewer** | `viewer@compass.test` | `Viewer123!` | Dashboard, reports (read-only) |

## 🏪 Test Outlets

- **Compass Main Store** (Retail) - Main outlet
- **Compass Downtown Branch** (Restaurant) - Secondary outlet

## 🧪 Quick Test Scenarios

### 1. Super Admin Testing
- Login → Should see all outlets
- Navigate → All menu items visible
- Test → User management, outlet switching

### 2. Outlet Admin Testing
- Login → Should see assigned outlet only
- Navigate → Most menu items visible
- Test → Invite team member, outlet settings

### 3. Role-Based Testing
- Login with each role
- Verify menu items match permissions
- Test restricted features show errors

### 4. Multi-Outlet Testing
- Switch between outlets (Super Admin)
- Verify data isolation
- Test cross-outlet analytics

## 🚀 Setup Steps

1. **Create users** in Supabase Auth
2. **Run SQL script** in Supabase SQL Editor
3. **Update user IDs** in database
4. **Test login** with each account
5. **Verify permissions** work correctly

## 🔧 Troubleshooting

- **Can't login?** → Check user exists in Supabase Auth
- **Wrong permissions?** → Check role in users table
- **No outlet?** → Check outlet_id assignment
- **Missing menu items?** → Check permissions array

---

**App URL**: http://localhost:5173
**Supabase Dashboard**: https://supabase.com/dashboard
