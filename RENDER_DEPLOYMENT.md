# 🚀 Render Deployment Guide - Compazz Backend

## 📋 **Pre-Deployment Checklist**

### ✅ **Backend Ready**
- [x] FastAPI application (`main.py`)
- [x] Requirements file (`requirements.txt`)
- [x] Render configuration (`render.yaml`)
- [x] Startup script (`start.sh`)
- [x] Environment variables prepared

## 🌐 **Step-by-Step Render Deployment**

### **Step 1: Go to Render**
1. Visit https://render.com
2. Sign up/Login with GitHub
3. Click "New +" → "Web Service"

### **Step 2: Connect Repository**
1. **Connect GitHub Repository:**
   - Click "Connect GitHub"
   - Authorize Render
   - Select your repository: `ayomidefagboyo/project`

2. **Configure Service:**
   - **Name:** `compazz-backend`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3.11`
   - **Build Command:** `pip install --upgrade pip && pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1`

### **Step 3: Set Environment Variables**
Click "Advanced" → "Environment Variables" and add:

```
SUPABASE_URL=https://swxxvbmjccbzqvywgapo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
OPENAI_API_KEY=your_openai_api_key_here
BACKEND_CORS_ORIGINS=*
PYTHON_VERSION=3.11
```

### **Step 4: Deploy**
1. Click "Create Web Service"
2. Render will start building your backend
3. Wait for deployment to complete (5-10 minutes)

### **Step 5: Get Your Backend URL**
After deployment, you'll get a URL like:
```
https://compazz-backend-xxxx.onrender.com
```

Your API endpoints will be at:
```
https://compazz-backend-xxxx.onrender.com/api/v1
```

## 🔧 **Update Frontend with Backend URL**

### **Step 1: Update Vercel Environment Variables**
1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Update `VITE_API_BASE_URL` to your Render URL:
   ```
   VITE_API_BASE_URL=https://compazz-backend-xxxx.onrender.com/api/v1
   ```

### **Step 2: Redeploy Frontend**
1. In Vercel, go to Deployments
2. Click "Redeploy" on the latest deployment
3. Wait for redeployment to complete

## 🧪 **Test Your Deployment**

### **Test Backend:**
1. Visit: `https://your-backend-url.onrender.com/health`
2. Should return: `{"status": "healthy"}`

2. Visit: `https://your-backend-url.onrender.com/docs`
3. Should show FastAPI documentation

### **Test Frontend-Backend Connection:**
1. Open your frontend app
2. Try creating an EOD report
3. Check browser console for any errors

## 🚨 **Troubleshooting**

### **Common Issues:**

1. **Build Fails (Python Version Error):**
   - ✅ **FIXED:** Use Python 3.11.0 (not 3.13)
   - ✅ **FIXED:** Updated requirements.txt with compatible versions
   - ✅ **FIXED:** Added runtime.txt for explicit Python version

2. **Package Installation Errors:**
   - ✅ **FIXED:** Removed problematic packages (pandas, numpy, redis, celery)
   - ✅ **FIXED:** Simplified requirements.txt for production
   - ✅ **FIXED:** Added pip upgrade in build command

3. **Environment Variables Not Working:**
   - Double-check variable names
   - Ensure no extra spaces

4. **CORS Errors:**
   - Update `BACKEND_CORS_ORIGINS` to include your frontend URL
   - Example: `https://your-frontend.vercel.app,http://localhost:5173`

5. **Database Connection Issues:**
   - Verify Supabase credentials
   - Check if RLS policies are enabled

### **Render Free Tier Limitations:**
- ⚠️ **Cold starts:** First request after inactivity takes 30+ seconds
- ⚠️ **Sleep mode:** App sleeps after 15 minutes of inactivity
- ⚠️ **Build time:** 750 minutes per month
- ⚠️ **Bandwidth:** 100GB per month

## 📊 **Monitoring Your Deployment**

### **Render Dashboard:**
- View logs in real-time
- Monitor resource usage
- Check deployment status

### **Health Checks:**
- Backend: `https://your-backend-url.onrender.com/health`
- API Docs: `https://your-backend-url.onrender.com/docs`

## 🔄 **Updating Your Backend**

1. **Push changes to GitHub:**
   ```bash
   git add .
   git commit -m "Update backend"
   git push origin master
   ```

2. **Render auto-deploys:**
   - Render automatically detects changes
   - Triggers new deployment
   - Updates your live backend

## ✅ **Success Checklist**

- [ ] Backend deployed on Render
- [ ] Backend URL obtained
- [ ] Frontend updated with backend URL
- [ ] Health check passes
- [ ] API documentation accessible
- [ ] Frontend-backend connection working
- [ ] EOD reports can be created

---

## 🎉 **You're All Set!**

Your Compazz Finance Management system is now fully deployed:
- **Frontend:** Vercel
- **Backend:** Render
- **Database:** Supabase

**Next step:** Test the complete system! 🚀
