# Supabase Setup Guide for Compass

## 🚀 Quick Setup

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up/Login to your account
3. Click "New Project"
4. Choose your organization
5. Enter project details:
   - **Name**: `compass-finance` (or your preferred name)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to your location
6. Click "Create new project"
7. Wait for the project to be created (2-3 minutes)

### 2. Get Your Credentials

Once your project is ready:

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy the following values:
   - **Project URL** (looks like: `https://your-project-id.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

### 3. Update Environment Variables

Update your `.env` file with the real Supabase credentials:

```bash
# FastAPI Backend Configuration
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Debug Mode
VITE_DEBUG=true

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Set Up Database Schema

Run the SQL scripts in your Supabase SQL Editor:

1. Go to **SQL Editor** in your Supabase dashboard
2. Run the scripts from `backend/database/` in this order:
   - `schema.sql` - Main database schema
   - `rls-policies.sql` - Row Level Security policies
   - `seed-data.sql` - Sample data (optional)

### 5. Configure Authentication

1. Go to **Authentication** → **Settings** in Supabase dashboard
2. Configure your auth settings:
   - **Site URL**: `http://localhost:5173`
   - **Redirect URLs**: `http://localhost:5173/**`
   - Enable **Email** authentication
   - Optionally enable **Google** or other providers

### 6. Set Up Storage (Optional)

If you need file uploads:

1. Go to **Storage** in Supabase dashboard
2. Create buckets:
   - `invoices` - For invoice documents
   - `expenses` - For expense receipts
   - `reports` - For report files

## 🔧 Alternative: Use Existing Supabase Project

If you already have a Supabase project:

1. Go to your existing project dashboard
2. Navigate to **Settings** → **API**
3. Copy your Project URL and anon key
4. Update the `.env` file with these values

## 🧪 Test Your Setup

1. Restart your development server:
   ```bash
   yarn dev
   ```

2. Visit `http://localhost:5173`
3. Check the browser console for any Supabase errors
4. Try the authentication flow

## 🆘 Troubleshooting

### Common Issues:

1. **"Invalid URL" error**: Check that your `VITE_SUPABASE_URL` is correct
2. **"Invalid API key" error**: Verify your `VITE_SUPABASE_ANON_KEY` is correct
3. **CORS errors**: Make sure your Site URL is set to `http://localhost:5173`
4. **Database connection errors**: Ensure your database schema is properly set up

### Getting Help:

- Check Supabase documentation: [https://supabase.com/docs](https://supabase.com/docs)
- Supabase Discord: [https://discord.supabase.com](https://discord.supabase.com)
- GitHub Issues: [https://github.com/supabase/supabase](https://github.com/supabase/supabase)

## 📋 Next Steps

Once Supabase is configured:

1. ✅ Test authentication (signup/login)
2. ✅ Test database operations (CRUD)
3. ✅ Test file uploads (if using storage)
4. ✅ Set up production environment variables
5. ✅ Configure Row Level Security policies

Your Compass app will then have full Supabase integration for:
- User authentication
- Database operations
- Real-time updates
- File storage
- Row-level security
