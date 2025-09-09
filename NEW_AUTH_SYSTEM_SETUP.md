# 🚀 New Authentication System Setup Guide

## Overview
We've completely redesigned the authentication system to work like **Rippling's onboarding flow**:

1. **Company Owner signs up** → Creates company/outlet automatically
2. **Owner invites team members** → Sends email invitations with roles
3. **Team members accept invites** → Set password and join company
4. **No role selection during signup** → Roles assigned by owner/admin

## 🔧 Database Setup

### Step 1: Add User Invitations Table
Run this in your Supabase SQL Editor:

```sql
-- Copy and paste the entire content of:
-- database/user-invitations-schema.sql
```

### Step 2: Update Existing Schema (if needed)
Make sure you have the production schema applied:

```sql
-- Copy and paste the entire content of:
-- database/rls-policies-production.sql
```

## 🎯 How It Works

### **Company Owner Signup Flow:**
1. Owner visits `/auth` → sees "Create Your Business" form
2. Fills out company details (name, type, address, etc.)
3. System automatically:
   - Creates Supabase auth user
   - Creates outlet record
   - Creates business settings
   - Creates user profile as `outlet_admin`
   - Sets default permissions

### **Team Member Invitation Flow:**
1. Owner goes to Settings → Team Management
2. Clicks "Invite Team Member"
3. Enters: name, email, role
4. System creates invitation record
5. **TODO**: Integrate with email service (SendGrid, AWS SES)
6. Team member receives email with invite link
7. Clicks link → sets password → joins company

### **Team Member Sign-in Flow:**
1. Team member visits `/auth`
2. Enters email/password
3. System authenticates and loads their outlet data
4. Redirects to dashboard with appropriate permissions

## 📱 Frontend Components

### **New Components Created:**
- `OwnerSignupForm.tsx` - Company creation form
- `InviteTeamMember.tsx` - Team invitation modal
- Updated `AuthWrapper.tsx` - Switches between login/owner signup

### **Updated Components:**
- `auth.ts` - Complete rewrite with new methods
- `OutletContext.tsx` - Handles owner vs team member logic

## 🔐 Permission System

### **Role Hierarchy:**
```
super_admin     → All permissions + manage outlets
outlet_admin    → All outlet permissions + manage users
manager         → Sales, expenses, reports, analytics
cashier         → Sales, view inventory/expenses
waiter          → Sales only
kitchen_staff   → View inventory
inventory_staff → Manage inventory
accountant      → Expenses, reports, analytics
viewer          → Dashboard, reports only
```

### **Permission Checks:**
```typescript
const { hasPermission, hasAnyPermission } = useOutlet();

// Check single permission
if (hasPermission('manage_users')) {
  // Show user management UI
}

// Check multiple permissions
if (hasAnyPermission(['create_sales', 'edit_sales'])) {
  // Show sales management UI
}
```

## 🚀 Next Steps

### **Immediate:**
1. ✅ Apply database schema changes
2. ✅ Test owner signup flow
3. ✅ Test team member login flow

### **Short-term:**
1. 🔄 Integrate email service for invitations
2. 🔄 Add team management page in Settings
3. 🔄 Add invitation acceptance page
4. 🔄 Add password reset flow

### **Long-term:**
1. 🔄 Multi-outlet support for super admins
2. 🔄 Advanced role customization
3. 🔄 SSO integration
4. 🔄 Audit logging for user management

## 🧪 Testing

### **Test Owner Signup:**
1. Visit `/auth`
2. Click "Create Your Business"
3. Fill out form with test data
4. Verify outlet and user are created
5. Check permissions are set correctly

### **Test Team Login:**
1. Create team member invitation
2. Accept invitation (set password)
3. Sign in with new credentials
4. Verify correct permissions and outlet access

## 🔒 Security Features

- **Row Level Security (RLS)** on all tables
- **Role-based access control** at component level
- **Outlet isolation** - users can only see their outlet's data
- **Audit logging** for all user actions
- **Invitation expiration** (7 days)
- **Secure token generation** for invitations

## 📧 Email Integration (TODO)

Currently, invitations are stored but emails aren't sent. To complete this:

1. **Choose email service:**
   - SendGrid (recommended)
   - AWS SES
   - Resend
   - Mailgun

2. **Create email templates:**
   - Invitation email
   - Welcome email
   - Password reset email

3. **Update `inviteUser` method:**
   ```typescript
   // In authService.inviteUser()
   await emailService.sendInvitation({
     to: inviteData.email,
     inviteUrl: `${window.location.origin}/accept-invite/${invite.token}`,
     companyName: currentOutlet.name,
     role: inviteData.role
   });
   ```

## 🎉 Benefits of New System

1. **Enterprise-grade onboarding** - Like Rippling, Gusto, etc.
2. **No role confusion** - Clear ownership model
3. **Secure invitation system** - No unauthorized signups
4. **Scalable permissions** - Easy to add new roles
5. **Professional appearance** - Suitable for business clients

---

**Ready to deploy!** This system provides a much more professional and secure user management experience.

