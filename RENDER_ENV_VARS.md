# Render Environment Variables Configuration

## Required Environment Variables for Backend Deployment on Render

Set these environment variables in your Render backend service dashboard:

### CORS Configuration
```
BACKEND_CORS_ORIGINS=https://compazz.app,http://localhost:5173,http://localhost:3000
```

### Supabase Configuration
```
SUPABASE_URL=https://swxxvbmjccbzqvywgapo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eHh2Ym1qY2NienF2eXdnYXBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NzUxNzcsImV4cCI6MjA3MjI1MTE3N30.LKJM6aaPBY7ltKRcAeIVa8g28t_AgErHdL9kIZRW728
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SERVICE_ROLE_KEY]
```

### Security Configuration
```
SECRET_KEY=[GENERATE_A_STRONG_SECRET_KEY]
ENVIRONMENT=production
DEBUG=false
```

### Stripe Configuration
```
STRIPE_SECRET_KEY=[YOUR_STRIPE_SECRET_KEY]
```

## Frontend Environment Variables for Vercel

Update these environment variables in your Vercel project dashboard:

### Backend URL Configuration
```
VITE_API_BASE_URL=https://[YOUR_RENDER_SERVICE_NAME].onrender.com/api/v1
```

### Other Variables (same as current)
```
VITE_SUPABASE_URL=https://swxxvbmjccbzqvywgapo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eHh2Ym1qY2NienF2eXdnYXBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NzUxNzcsImV4cCI6MjA3MjI1MTE3N30.LKJM6aaPBY7ltKRcAeIVa8g28t_AgErHdL9kIZRW728
VITE_STRIPE_PUBLISHABLE_KEY=[YOUR_STRIPE_PUBLISHABLE_KEY]
VITE_GOOGLE_CLIENT_ID=977259045549-bhade7h7dq01om0h7jv7asu1avh2d4i6.apps.googleusercontent.com
VITE_DEBUG=false
VITE_APP_NAME=Compazz
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=production
```

## Steps to Fix the CORS Issue

1. **Update Backend URL in Vercel:**
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Update `VITE_API_BASE_URL` to: `https://[YOUR_RENDER_SERVICE_NAME].onrender.com/api/v1`
   - Replace `[YOUR_RENDER_SERVICE_NAME]` with your actual Render service name

2. **Update CORS Origins in Render:**
   - Go to your Render service dashboard
   - Navigate to Environment
   - Add/update `BACKEND_CORS_ORIGINS` to: `https://compazz.app,http://localhost:5173,http://localhost:3000`

3. **Redeploy Both Services:**
   - Redeploy your Render backend service
   - Redeploy your Vercel frontend

## Troubleshooting

If you still get CORS errors after updating:

1. **Check Backend Logs:** Look at Render service logs for any startup errors
2. **Test Backend Health:** Visit `https://[YOUR_RENDER_SERVICE_NAME].onrender.com/health`
3. **Verify Environment Variables:** Ensure all variables are set correctly in both services
4. **Check Network Requests:** Use browser dev tools to see the exact URL being called

## Security Notes

- Never commit actual secret keys to the repository
- Use strong, randomly generated secret keys in production
- Regularly rotate your secret keys
- Monitor your API usage and set up alerts for unusual activity