# Test Accounts for Compass App

This document contains test account credentials for all role levels in the Compass business management system.

## 🔐 Test Account Credentials

### Super Admin Account
- **Email**: `superadmin@compass.test`
- **Password**: `SuperAdmin123!`
- **Role**: Super Admin
- **Permissions**: Full system access, manage all outlets, manage all users
- **Description**: Highest level access, can manage multiple outlets and all users

### Outlet Admin Account
- **Email**: `outletadmin@compass.test`
- **Password**: `OutletAdmin123!`
- **Role**: Outlet Admin
- **Permissions**: Full outlet management, manage outlet users, view analytics
- **Description**: Manages a specific outlet, can invite team members

### Manager Account
- **Email**: `manager@compass.test`
- **Password**: `Manager123!`
- **Role**: Manager
- **Permissions**: View sales, create sales, view inventory, manage expenses, generate reports
- **Description**: Mid-level management, can oversee daily operations

### Cashier Account
- **Email**: `cashier@compass.test`
- **Password**: `Cashier123!`
- **Role**: Cashier
- **Permissions**: View sales, create sales, view inventory, view expenses
- **Description**: Point-of-sale operations, handles transactions

### Waiter Account
- **Email**: `waiter@compass.test`
- **Password**: `Waiter123!`
- **Role**: Waiter
- **Permissions**: View sales, create sales
- **Description**: Service staff, takes orders and handles customer interactions

### Kitchen Staff Account
- **Email**: `kitchen@compass.test`
- **Password**: `Kitchen123!`
- **Role**: Kitchen Staff
- **Permissions**: View dashboard, view inventory
- **Description**: Kitchen operations, inventory management

### Inventory Staff Account
- **Email**: `inventory@compass.test`
- **Password**: `Inventory123!`
- **Role**: Inventory Staff
- **Permissions**: View dashboard, view inventory, manage inventory
- **Description**: Inventory management and stock control

### Accountant Account
- **Email**: `accountant@compass.test`
- **Password**: `Accountant123!`
- **Role**: Accountant
- **Permissions**: View expenses, manage expenses, view reports, generate reports, view analytics
- **Description**: Financial management and reporting

### Viewer Account
- **Email**: `viewer@compass.test`
- **Password**: `Viewer123!`
- **Role**: Viewer
- **Permissions**: View dashboard, view reports
- **Description**: Read-only access for stakeholders and investors

## 🏪 Test Outlet Information

### Main Outlet
- **Name**: Compass Main Store
- **Type**: Retail
- **Address**: 123 Business Street, City, State 12345
- **Phone**: (555) 123-4567
- **Email**: main@compass.test

### Secondary Outlet
- **Name**: Compass Downtown Branch
- **Type**: Restaurant
- **Address**: 456 Commerce Ave, City, State 12345
- **Phone**: (555) 987-6543
- **Email**: downtown@compass.test

## 🧪 Testing Scenarios

### 1. Super Admin Testing
- Login with `superadmin@compass.test`
- Verify access to all outlets
- Test user management features
- Verify system-wide analytics

### 2. Outlet Admin Testing
- Login with `outletadmin@compass.test`
- Verify outlet-specific access
- Test team member invitation
- Verify outlet analytics

### 3. Role-Based Access Testing
- Test each role's specific permissions
- Verify restricted access to certain features
- Test navigation and UI elements

### 4. Multi-Outlet Testing
- Test outlet switching functionality
- Verify data isolation between outlets
- Test cross-outlet analytics (for appropriate roles)

## 🔧 Setup Instructions

### Step 1: Create Test Users
1. Go to your Supabase Dashboard
2. Navigate to **Authentication** > **Users**
3. Create each test user with the provided credentials
4. Assign appropriate roles in the `users` table

### Step 2: Create Test Outlets
1. Go to **Table Editor** > **outlets**
2. Create the test outlets with the provided information
3. Assign users to appropriate outlets

### Step 3: Set User Roles
1. Go to **Table Editor** > **users**
2. Update each user's role and permissions
3. Ensure proper outlet assignments

## 📊 Expected Behavior by Role

### Super Admin
- ✅ Access to all outlets
- ✅ User management across all outlets
- ✅ System-wide analytics and reports
- ✅ Can create and manage outlets

### Outlet Admin
- ✅ Access to assigned outlet only
- ✅ Can invite team members to outlet
- ✅ Outlet-specific analytics and reports
- ✅ Can manage outlet settings

### Manager
- ✅ View and create sales
- ✅ View inventory
- ✅ Manage expenses
- ✅ Generate reports
- ❌ Cannot manage users
- ❌ Cannot access other outlets

### Cashier
- ✅ View and create sales
- ✅ View inventory
- ✅ View expenses
- ❌ Cannot manage expenses
- ❌ Cannot generate reports

### Waiter
- ✅ View and create sales
- ❌ Cannot view inventory
- ❌ Cannot view expenses

### Kitchen Staff
- ✅ View dashboard
- ✅ View inventory
- ❌ Cannot view sales
- ❌ Cannot view expenses

### Inventory Staff
- ✅ View dashboard
- ✅ View and manage inventory
- ❌ Cannot view sales
- ❌ Cannot view expenses

### Accountant
- ✅ View and manage expenses
- ✅ View and generate reports
- ✅ View analytics
- ❌ Cannot manage users
- ❌ Cannot view sales

### Viewer
- ✅ View dashboard
- ✅ View reports
- ❌ Cannot create or modify data
- ❌ Cannot access management features

## 🚨 Security Notes

- These are **TEST ACCOUNTS ONLY**
- **DO NOT** use these credentials in production
- **DO NOT** use real email addresses
- **DO NOT** use weak passwords in production
- These accounts are for **DEVELOPMENT AND TESTING ONLY**

## 🔄 Password Reset

If you need to reset any test account password:
1. Go to Supabase Dashboard
2. Navigate to **Authentication** > **Users**
3. Find the user and click **Reset Password**
4. Or use the app's password reset feature

## 📝 Additional Test Data

### Sample Sales Data
- Various transaction types
- Different payment methods
- Multiple time periods
- Different amounts and categories

### Sample Inventory Data
- Product categories
- Stock levels
- Supplier information
- Price variations

### Sample Expense Data
- Different expense categories
- Various amounts
- Multiple vendors
- Different time periods

## 🎯 Testing Checklist

- [ ] All roles can log in successfully
- [ ] Role-based permissions are enforced
- [ ] Navigation shows appropriate menu items
- [ ] Data access is restricted by role
- [ ] Multi-outlet functionality works
- [ ] User invitation system works
- [ ] EOD reporting works for appropriate roles
- [ ] Analytics and reports are role-appropriate

## 📞 Support

If you encounter issues with test accounts:
1. Check Supabase Dashboard for user status
2. Verify role assignments in the database
3. Check console for authentication errors
4. Ensure proper outlet assignments

---

**Remember**: These are test accounts for development purposes only. Never use these credentials in a production environment.
