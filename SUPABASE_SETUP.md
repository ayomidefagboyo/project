# Supabase Setup Guide for Compass Platform

## 🚀 Overview
This guide will help you set up Supabase as the backend for your Compass financial management platform. Supabase provides PostgreSQL database, authentication, real-time subscriptions, and a powerful API.

## 📋 Prerequisites
- A Supabase account (free tier available)
- Node.js and npm/yarn installed
- Basic knowledge of SQL and database concepts

## 🔧 Step 1: Create Supabase Project

### 1.1 Sign Up/Login
1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in to your account
3. Click "New Project"

### 1.2 Project Configuration
1. **Organization**: Select your organization
2. **Name**: `compass-finance-platform`
3. **Database Password**: Create a strong password (save this!)
4. **Region**: Choose closest to your users
5. **Pricing Plan**: Start with Free tier
6. Click "Create new project"

### 1.3 Wait for Setup
- Database setup takes 2-3 minutes
- You'll receive an email when ready

## 🗄️ Step 2: Database Setup

### 2.1 Access SQL Editor
1. In your Supabase dashboard, go to **SQL Editor**
2. Click **"New Query"**

### 2.2 Run Schema Script
1. Copy the contents of `database/schema.sql`
2. Paste into the SQL editor
3. Click **"Run"** to execute

### 2.3 Run RLS Policies
1. Copy the contents of `database/rls-policies.sql`
2. Paste into a new SQL query
3. Click **"Run"** to execute

### 2.4 Seed Sample Data
1. Copy the contents of `database/seed-data.sql`
2. Paste into a new SQL query
3. Click **"Run"** to execute

## 🔐 Step 3: Authentication Setup

### 3.1 Configure Auth Settings
1. Go to **Authentication** → **Settings**
2. **Site URL**: Set to your frontend URL (e.g., `http://localhost:5173`)
3. **Redirect URLs**: Add your frontend URLs
4. **Enable Email Confirmations**: Turn OFF for development
5. **Enable Phone Confirmations**: Turn OFF for development

### 3.2 Email Templates (Optional)
1. Go to **Authentication** → **Email Templates**
2. Customize welcome, confirmation, and reset emails
3. Use your brand colors and logo

## 🔑 Step 4: Get API Keys

### 4.1 Project API Keys
1. Go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://xyz.supabase.co`)
   - **anon public** key
   - **service_role** key (keep secret!)

### 4.2 Environment Variables
1. Create `.env` file in your project root
2. Add your Supabase credentials:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Optional: Service Role Key (for server-side operations only)
# VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# App Configuration
VITE_APP_NAME=Compass
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=development
```

## 🧪 Step 5: Test Integration

### 5.1 Test Database Connection
1. Start your development server: `yarn dev`
2. Check browser console for any connection errors
3. Verify Supabase client is initialized

### 5.2 Test Authentication
1. Try to sign up a new user
2. Check if user appears in Supabase **Authentication** → **Users**
3. Verify user profile is created in **Table Editor** → **users**

### 5.3 Test Data Operations
1. Create a test outlet
2. Verify data appears in **Table Editor**
3. Check audit logs are being created

## 🔒 Step 6: Security Configuration

### 6.1 Row Level Security (RLS)
- RLS is already enabled via the schema script
- Policies ensure users can only access their outlet's data
- Super admins can access all data

### 6.2 API Security
- Never expose service role key in frontend
- Use RLS policies for data access control
- Validate all user inputs

### 6.3 Environment Security
- Keep `.env` file out of version control
- Use different keys for development/production
- Regularly rotate API keys

## 📊 Step 7: Database Monitoring

### 7.1 Enable Logs
1. Go to **Settings** → **Logs**
2. Enable **Database logs**
3. Enable **API logs**
4. Set retention period (7-30 days recommended)

### 7.2 Performance Monitoring
1. Go to **Reports** → **Database**
2. Monitor query performance
3. Check for slow queries
4. Optimize indexes if needed

## 🚀 Step 8: Production Deployment

### 8.1 Environment Variables
1. Update production environment variables
2. Use production Supabase project
3. Set proper redirect URLs

### 8.2 Database Backups
1. Go to **Settings** → **Database**
2. Enable **Point in time recovery**
3. Set up automated backups

### 8.3 Monitoring
1. Set up alerts for:
   - High CPU usage
   - Database size limits
   - Failed authentication attempts
   - API rate limits

## 🐛 Troubleshooting

### Common Issues

#### 1. Connection Errors
```bash
# Check if Supabase URL is correct
# Verify anon key is valid
# Check if project is active
```

#### 2. RLS Policy Issues
```bash
# Verify policies are created
# Check user roles and permissions
# Test with different user types
```

#### 3. Authentication Issues
```bash
# Check redirect URLs
# Verify email templates
# Check spam folder for emails
```

#### 4. Database Errors
```bash
# Check SQL syntax in schema
# Verify table relationships
# Check for missing indexes
```

### Debug Mode
Enable debug mode in your Supabase client:
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-debug': 'true'
    }
  }
});
```

## 📚 Additional Resources

### Supabase Documentation
- [Official Docs](https://supabase.com/docs)
- [JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Database Guide](https://supabase.com/docs/guides/database)
- [Auth Guide](https://supabase.com/docs/guides/auth)

### Community Support
- [Supabase Discord](https://discord.supabase.com)
- [GitHub Issues](https://github.com/supabase/supabase/issues)
- [Community Forum](https://github.com/supabase/supabase/discussions)

## ✅ Checklist

- [ ] Supabase project created
- [ ] Database schema executed
- [ ] RLS policies applied
- [ ] Sample data seeded
- [ ] Environment variables configured
- [ ] Authentication tested
- [ ] Data operations tested
- [ ] Security policies verified
- [ ] Monitoring enabled
- [ ] Production deployment ready

## 🎯 Next Steps

After completing this setup:

1. **Integrate with Frontend**: Update components to use Supabase instead of mock data
2. **Add Real-time Features**: Implement live updates for invoices, expenses, etc.
3. **File Storage**: Set up Supabase Storage for receipts and documents
4. **Edge Functions**: Create serverless functions for complex business logic
5. **Analytics**: Implement business intelligence and reporting features

---

**Need Help?** Check the troubleshooting section or reach out to the Supabase community!

