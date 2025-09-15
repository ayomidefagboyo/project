# Demo OCR Security Setup Guide

## Overview
This guide explains how to create a separate, restricted Google Cloud Vision API key specifically for the demo functionality to prevent abuse and limit costs.

## Step 1: Create a Separate API Key

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/apis/credentials
   - Select your project

2. **Create New API Key**
   - Click "CREATE CREDENTIALS" → "API key"
   - Name it: `Compazz-Demo-OCR-Restricted`

## Step 2: Apply Restrictions

### Application Restrictions
Set **HTTP referrers (web sites)** with these patterns:
```
https://compazz.app/*
https://compazz.vercel.app/*
https://*.vercel.app/*
http://localhost:*
http://127.0.0.1:*
```

### API Restrictions
- Select "Restrict key"
- Enable only: **Cloud Vision API**
- Disable all other APIs

## Step 3: Set Quotas (Important!)

1. **Go to Quotas page**
   - Visit: https://console.cloud.google.com/iam-admin/quotas
   - Filter by "Vision API"

2. **Set these limits for the demo key:**
   ```
   Requests per day: 500
   Requests per minute: 30
   Requests per 100 seconds per user: 10
   ```

3. **Create a separate quota for your main application:**
   - Use a different API key for authenticated users
   - Set higher limits for production usage

## Step 4: Update Environment Variables

### Development (.env)
```bash
# Main OCR API Key (for authenticated users)
VITE_GOOGLE_VISION_API_KEY=your_main_api_key_here

# Demo-specific OCR API Key (with restrictions)
VITE_GOOGLE_VISION_DEMO_API_KEY=your_restricted_demo_api_key_here
```

### Production (Vercel)
Set the same environment variables in your Vercel dashboard.

## Step 5: Monitor Usage

1. **Set up alerts**
   - Go to Cloud Monitoring
   - Create alerts for quota usage > 80%

2. **Regular monitoring**
   - Check usage weekly
   - Monitor for unusual spikes
   - Review error rates

## Security Features Implemented

### Client-Side Rate Limiting
- **Hourly limit**: 5 requests per user
- **Daily limit**: 15 requests per user
- **Storage**: Uses localStorage to track usage
- **Reset**: Automatic reset after time windows

### API Key Restrictions
- **Referrer restrictions**: Only works on your domains
- **API restrictions**: Only Vision API enabled
- **Quota limits**: Server-side limits prevent abuse

### File Validation
- **Size limit**: 5MB (stricter than main app's 10MB)
- **Type validation**: Images only
- **Content validation**: Basic security checks

### Error Handling
- **Quota exceeded**: Clear user messaging
- **Invalid requests**: Graceful fallbacks
- **Network errors**: Retry logic with backoff

## Cost Protection

### Expected Usage
- Demo users: ~100-200 requests/day
- Cost per 1000 requests: ~$1.50
- Monthly demo cost: ~$10-20

### Cost Alerts
Set up billing alerts at:
- $5/month (warning)
- $25/month (critical)

### Fallback Strategy
If quotas are exceeded:
1. Demo shows sample data instead
2. Users encouraged to sign up
3. No service interruption

## Monitoring Dashboard

Track these metrics:
- Demo API requests per day
- Success/error rates
- Top error types
- User conversion from demo

## Security Checklist

- [ ] Separate API key created
- [ ] HTTP referrer restrictions applied
- [ ] API restrictions set (Vision API only)
- [ ] Quotas configured
- [ ] Billing alerts set up
- [ ] Client-side rate limiting implemented
- [ ] Error handling tested
- [ ] Monitoring configured
- [ ] Fallback behavior verified

## Troubleshooting

### Common Issues

1. **"Quota exceeded" errors**
   - Check Google Cloud Console quotas
   - Verify rate limiting is working
   - Consider increasing limits if needed

2. **"Access denied" errors**
   - Verify referrer restrictions
   - Check API key is correctly configured
   - Ensure Vision API is enabled

3. **Demo not working**
   - Check environment variables
   - Verify API key has correct permissions
   - Test with sample image

### Testing
```bash
# Test the demo locally
npm run dev

# Check browser console for errors
# Try uploading a test receipt
# Verify rate limiting works after 5 requests
```

## Production Deployment

When deploying:
1. Use the restricted demo key in production
2. Keep the main key for authenticated features
3. Monitor usage closely for first week
4. Adjust quotas based on actual usage

This setup provides robust protection against API abuse while maintaining a smooth demo experience for legitimate users.
