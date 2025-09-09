# Test Accounts Setup Guide

This guide will help you create test accounts for all role levels in your Compass app.

## 🚀 Quick Setup

### Step 1: Create Users in Supabase Auth

1. **Go to your Supabase Dashboard**
2. **Navigate to Authentication > Users**
3. **Click "Add User"** for each test account
4. **Use these credentials**:

#### Super Admin
- **Email**: `superadmin@compass.test`
- **Password**: `SuperAdmin123!`

#### Outlet Admin
- **Email**: `outletadmin@compass.test`
- **Password**: `OutletAdmin123!`

#### Manager
- **Email**: `manager@compass.test`
- **Password**: `Manager123!`

#### Cashier
- **Email**: `cashier@compass.test`
- **Password**: `Cashier123!`

#### Waiter
- **Email**: `waiter@compass.test`
- **Password**: `Waiter123!`

#### Kitchen Staff
- **Email**: `kitchen@compass.test`
- **Password**: `Kitchen123!`

#### Inventory Staff
- **Email**: `inventory@compass.test`
- **Password**: `Inventory123!`

#### Accountant
- **Email**: `accountant@compass.test`
- **Password**: `Accountant123!`

#### Viewer
- **Email**: `viewer@compass.test`
- **Password**: `Viewer123!`

### Step 2: Run the Database Setup Script

1. **Go to SQL Editor** in your Supabase Dashboard
2. **Copy and paste** the entire contents of `backend/database/test-accounts-setup.sql`
3. **Click Run** to execute the script
4. **Verify success** - you should see "Test accounts and sample data created successfully!"

### Step 3: Update User IDs in Database

After creating users in Supabase Auth, you need to update the user IDs in the database:

1. **Go to Table Editor > users**
2. **Find each test user** by email
3. **Copy the actual user ID** from Supabase Auth
4. **Update the user record** with the correct ID

### Step 4: Test the Accounts

1. **Go to your app**: http://localhost:5173
2. **Try logging in** with each test account
3. **Verify role-based access** works correctly
4. **Check that each role** sees appropriate menu items and data

## 🔍 Verification Checklist

### Database Tables to Check:
- [ ] **outlets** - Should have 2 test outlets
- [ ] **users** - Should have 9 test users with correct roles
- [ ] **business_settings** - Should have settings for both outlets
- [ ] **daily_reports** - Should have sample EOD reports
- [ ] **invoices** - Should have sample invoices
- [ ] **expenses** - Should have sample expenses
- [ ] **vendors** - Should have sample vendors

### Role Permissions to Test:
- [ ] **Super Admin** - Can access all features
- [ ] **Outlet Admin** - Can manage outlet and invite users
- [ ] **Manager** - Can view sales, inventory, expenses, reports
- [ ] **Cashier** - Can view/create sales, view inventory/expenses
- [ ] **Waiter** - Can view/create sales only
- [ ] **Kitchen Staff** - Can view dashboard and inventory
- [ ] **Inventory Staff** - Can view dashboard and manage inventory
- [ ] **Accountant** - Can view/manage expenses and reports
- [ ] **Viewer** - Can view dashboard and reports only

## 🧪 Testing Scenarios

### 1. Login Testing
- Test each account can log in
- Verify correct role is assigned
- Check that navigation shows appropriate menu items

### 2. Permission Testing
- Try to access features not allowed for each role
- Verify that restricted features are hidden or show error messages
- Test that data is filtered by outlet (where applicable)

### 3. Multi-Outlet Testing
- Test outlet switching (for appropriate roles)
- Verify data isolation between outlets
- Test cross-outlet analytics (for Super Admin)

### 4. EOD Reporting Testing
- Test EOD report creation (for appropriate roles)
- Verify report data is outlet-specific
- Test multi-outlet EOD view (for managers/admins)

## 🚨 Troubleshooting

### Common Issues:

#### "User not found" error
- **Cause**: User ID mismatch between Auth and database
- **Fix**: Update user ID in the users table

#### "Permission denied" error
- **Cause**: Incorrect role or permissions
- **Fix**: Check role assignment and permissions array

#### "No outlet selected" error
- **Cause**: User not assigned to an outlet
- **Fix**: Ensure user has correct outlet_id

#### Navigation items missing
- **Cause**: Role permissions not properly set
- **Fix**: Check permissions array in users table

### Debug Steps:
1. **Check Supabase Auth** - Verify users exist and are confirmed
2. **Check users table** - Verify role and outlet assignments
3. **Check console** - Look for authentication errors
4. **Check network tab** - Look for API call failures

## 📊 Sample Data Created

The setup script creates:

### Outlets
- **Compass Main Store** (Retail)
- **Compass Downtown Branch** (Restaurant)

### Daily Reports
- Sample EOD reports for both outlets
- Various sales data and balances

### Invoices
- Sample paid and pending invoices
- Different customers and amounts

### Expenses
- Sample expenses in different categories
- Various payment methods

### Vendors
- Sample suppliers for both outlets
- Contact information and addresses

## 🔄 Resetting Test Data

To reset all test data:

1. **Delete from users table**:
   ```sql
   DELETE FROM users WHERE email LIKE '%@compass.test';
   ```

2. **Delete from outlets table**:
   ```sql
   DELETE FROM outlets WHERE name LIKE 'Compass%';
   ```

3. **Delete sample data**:
   ```sql
   DELETE FROM daily_reports WHERE created_by IN (SELECT id FROM users WHERE email LIKE '%@compass.test');
   DELETE FROM invoices WHERE created_by IN (SELECT id FROM users WHERE email LIKE '%@compass.test');
   DELETE FROM expenses WHERE created_by IN (SELECT id FROM users WHERE email LIKE '%@compass.test');
   DELETE FROM vendors WHERE created_by IN (SELECT id FROM users WHERE email LIKE '%@compass.test');
   ```

4. **Re-run the setup script**

## 📝 Next Steps

After setting up test accounts:

1. **Test all role-based features**
2. **Verify multi-outlet functionality**
3. **Test user invitation system**
4. **Test EOD reporting**
5. **Test analytics and reports**

## 🔗 Related Files

- `TEST_ACCOUNTS.md` - Complete list of test credentials
- `backend/database/test-accounts-setup.sql` - Database setup script
- `src/lib/auth.ts` - Authentication logic
- `src/contexts/OutletContext.tsx` - Outlet management
- `src/components/layout/Sidebar.tsx` - Navigation based on roles

---

**Remember**: These are test accounts for development only. Never use these credentials in production!
