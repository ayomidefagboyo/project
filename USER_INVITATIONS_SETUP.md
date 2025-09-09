# User Invitations Setup Guide

The user invitation feature requires the `user_invitations` table to be created in your Supabase database. Follow these steps to set it up.

## 🚀 Quick Setup

### Step 1: Access Supabase Dashboard
1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your project

### Step 2: Create the Table
1. Navigate to **SQL Editor** in the left sidebar
2. Click **New Query**
3. Copy and paste the entire contents of `backend/database/user-invitations-schema.sql`
4. Click **Run** to execute the SQL

### Step 3: Verify Setup
1. Go to **Table Editor** in the left sidebar
2. You should see the `user_invitations` table listed
3. Check that it has the following columns:
   - `id` (UUID, Primary Key)
   - `email` (VARCHAR)
   - `name` (VARCHAR)
   - `role` (user_role)
   - `outlet_id` (UUID, Foreign Key)
   - `status` (VARCHAR)
   - `expires_at` (TIMESTAMP)
   - `created_at` (TIMESTAMP)
   - `accepted_at` (TIMESTAMP)
   - `accepted_by` (UUID, Foreign Key)
   - `invited_by` (UUID, Foreign Key)
   - `token` (VARCHAR)

## 🔧 What This Creates

### Table Structure
- **user_invitations**: Stores team member invitations
- **Foreign Keys**: Links to `outlets` and `users` tables
- **Constraints**: Ensures data integrity and prevents duplicate pending invitations

### Security (RLS Policies)
- **View**: Users can only see invitations for their outlet
- **Create**: Only outlet admins and super admins can create invitations
- **Update**: Only outlet admins and super admins can update invitations
- **Delete**: Only outlet admins and super admins can delete invitations

### Performance
- **Indexes**: Optimized for common queries (email, outlet_id, status, etc.)
- **Unique Constraint**: Prevents duplicate pending invitations per email/outlet

### Functions
- **cleanup_expired_invitations()**: Marks expired invitations as 'expired'

## 🧪 Test the Setup

After creating the table, test the invitation feature:

1. Go to **Settings** in your app
2. Click **Invite Team Member**
3. Fill in the form with:
   - Name: Test User
   - Email: test@example.com
   - Role: Cashier
4. Click **Send Invitation**

If successful, you should see:
- ✅ "Invitation sent to test@example.com"
- A new record in the `user_invitations` table

## 🐛 Troubleshooting

### Error: "relation 'user_invitations' does not exist"
- The table wasn't created successfully
- Re-run the SQL schema in Supabase SQL Editor

### Error: "permission denied for table user_invitations"
- RLS policies are blocking access
- Check that your user has the correct role and outlet_id

### Error: "column 'invited_by' does not exist"
- The table was created with an older schema
- Drop and recreate the table with the latest schema

### Error: "duplicate key value violates unique constraint"
- A pending invitation already exists for this email/outlet
- Check the `user_invitations` table for existing records

## 📝 Next Steps

Once the table is set up, the invitation feature will work automatically. Users can:

1. **Send Invitations**: Outlet admins can invite team members
2. **Accept Invitations**: Invited users can create accounts
3. **Manage Invitations**: View and manage pending invitations
4. **Automatic Cleanup**: Expired invitations are marked as expired

## 🔗 Related Files

- `backend/database/user-invitations-schema.sql` - Complete SQL schema
- `src/lib/auth.ts` - Invitation logic
- `src/components/auth/InviteTeamMember.tsx` - Invitation UI
- `src/components/auth/LoginForm.tsx` - Login with invitation acceptance
