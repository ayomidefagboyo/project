# 🚀 Deployment Guide

## Prerequisites

1. **Get API Keys:**
   - [OpenAI API Key](https://platform.openai.com/api-keys)
   - [Google Cloud Vision API Key](https://console.cloud.google.com/apis/credentials)

2. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

## 🔧 Deployment Steps

### 1. Deploy to Vercel

```bash
# Login to Vercel
vercel login

# Deploy the project
vercel

# Follow the prompts:
# - Link to existing project? No
# - Project name: compass-finance-management
# - Directory: ./
# - Framework: Vite
```

### 2. Set Environment Variables in Vercel

Go to your Vercel dashboard → Project Settings → Environment Variables and add:

**Production Variables:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
GOOGLE_CLOUD_VISION_KEY=your_google_vision_key
VITE_API_BASE_URL=https://your-app.vercel.app/api
VITE_APP_ENV=production
VITE_DEBUG=false
```

### 3. Deploy Backend Functions

The backend will be automatically deployed as Vercel serverless functions based on the `vercel.json` configuration.

### 4. Update API URLs

After deployment, update your frontend API client to use the production URL:
```javascript
// In src/lib/apiClient.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://your-app.vercel.app/api'
```

## 🧪 Testing Deployment

1. **Test OCR functionality:**
   - Upload an invoice image
   - Verify Google Vision API extracts text
   - Check OpenAI GPT-4 structures the data

2. **Test Database connectivity:**
   - Create vendors, invoices, EOD reports
   - Verify Supabase integration works

3. **Test Mobile responsiveness:**
   - Test on mobile devices
   - Verify touch-friendly interface

## 📊 Cost Monitoring

**Expected Monthly Costs:**
- Vercel: Free tier (up to 100GB bandwidth)
- OpenAI API: ~$10-30 (depending on usage)
- Google Vision API: ~$15 (1000 documents)
- Supabase: Free tier or $25/month Pro

**Total: ~$0-70/month depending on usage**

## 🔍 Monitoring

Set up monitoring for:
- API response times
- OCR accuracy rates  
- Database query performance
- Error rates and logs

## 🛠️ Troubleshooting

**Common Issues:**
1. **Build fails**: Check Node.js version compatibility
2. **API keys not working**: Verify environment variables are set correctly
3. **Database errors**: Check Supabase connection and RLS policies
4. **OCR not working**: Verify Google Vision API is enabled and quota is available

## 🔄 CI/CD Setup

The project is configured for automatic deployment on push to main branch. Any changes to the repository will trigger a new deployment.

## 📱 Mobile PWA (Optional)

To enable PWA features, add a PWA plugin to Vite and configure service workers for offline functionality.