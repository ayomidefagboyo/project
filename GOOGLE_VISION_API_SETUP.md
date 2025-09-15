# Google Cloud Vision API Setup Guide

This guide will help you set up the Google Cloud Vision API for OCR functionality in Compazz.

## 🎯 **What You Need**

**API Service:** Google Cloud Vision API (Text Detection)
- **Purpose:** Extract text from receipt and invoice images
- **Accuracy:** 95%+ text recognition
- **Speed:** ~2-5 seconds processing time
- **Cost:** First 1,000 requests/month FREE

## 🚀 **Step-by-Step Setup**

### **1. Create Google Cloud Project**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a Project" → "New Project"
3. Enter project name: `Compazz OCR` (or your preferred name)
4. Select your billing account (required for API access)
5. Click "Create"

### **2. Enable Cloud Vision API**

1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "**Cloud Vision API**"
3. Click on "Cloud Vision API" from the results
4. Click the **"Enable"** button
5. Wait for the API to be enabled (usually takes 1-2 minutes)

### **3. Create API Credentials**

1. Go to **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"API Key"**
3. Copy the generated API key (it looks like: `REDACTED_GOOGLE_API_KEY`)
4. Click **"Restrict Key"** (recommended for security)

### **4. Configure API Key Restrictions (Recommended)**

#### **Application Restrictions:**
- Select **"HTTP referrers (web sites)"**
- Add these referrers:
  ```
  https://your-domain.com/*
  https://*.vercel.app/*
  http://localhost:5173/*
  http://localhost:3000/*
  ```

#### **API Restrictions:**
- Select **"Restrict key"**
- Choose **"Cloud Vision API"** from the dropdown
- Click **"Save"**

### **5. Add API Key to Environment Variables**

#### **Frontend (.env):**
```bash
# Google Cloud Vision API for OCR
VITE_GOOGLE_VISION_API_KEY=REDACTED_GOOGLE_API_KEY
```

#### **Backend (backend/.env):**
```bash
# Google Cloud Vision API for OCR
GOOGLE_VISION_API_KEY=REDACTED_GOOGLE_API_KEY
```

## 💰 **Pricing Information**

### **Free Tier:**
- **First 1,000 requests/month:** FREE
- Perfect for development and small-scale testing

### **Paid Tier:**
- **1,001 - 5,000,000 requests:** $1.50 per 1,000 requests
- **5,000,001+ requests:** $0.60 per 1,000 requests

### **Cost Examples:**
- **100 receipts/day:** ~$45/month (3,000 requests)
- **500 receipts/day:** ~$225/month (15,000 requests)
- **1,000 receipts/day:** ~$450/month (30,000 requests)

## 🔧 **Technical Details**

### **API Endpoint:**
```
https://vision.googleapis.com/v1/images:annotate
```

### **Request Format:**
```json
{
  "requests": [{
    "image": {
      "content": "base64_encoded_image_data"
    },
    "features": [{
      "type": "TEXT_DETECTION",
      "maxResults": 1
    }]
  }]
}
```

### **Supported Image Formats:**
- **JPEG** (recommended)
- **PNG**
- **GIF**
- **BMP**
- **WebP**
- **RAW**
- **ICO**
- **PDF** (first page only)
- **TIFF**

### **File Size Limits:**
- **Maximum:** 20MB per image
- **Recommended:** Under 10MB for faster processing
- **Optimal:** 2-5MB for best speed/quality balance

## 🛡️ **Security Best Practices**

### **1. API Key Restrictions:**
- Always restrict API keys to specific domains
- Use separate keys for development and production
- Regularly rotate API keys (every 90 days)

### **2. Environment Variables:**
- Never commit API keys to version control
- Use different keys for different environments
- Store production keys in secure deployment platforms

### **3. Usage Monitoring:**
- Set up billing alerts in Google Cloud Console
- Monitor API usage in the Console dashboard
- Implement rate limiting in your application

## 🧪 **Testing the Setup**

### **1. Test API Key:**
Use this curl command to test your API key:
```bash
curl -X POST \
  "https://vision.googleapis.com/v1/images:annotate?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [{
      "image": {
        "source": {
          "imageUri": "https://cloud.google.com/vision/docs/images/sign_text.png"
        }
      },
      "features": [{
        "type": "TEXT_DETECTION",
        "maxResults": 1
      }]
    }]
  }'
```

### **2. Test in Compazz:**
1. Start your development server
2. Go to the landing page
3. Try the "Live Receipt Scanner" demo
4. Upload a receipt image
5. Verify that text extraction works

## 🚨 **Troubleshooting**

### **Common Issues:**

#### **"API key not valid" error:**
- Check that the API key is correctly copied
- Verify that Cloud Vision API is enabled
- Ensure API key restrictions allow your domain

#### **"Quota exceeded" error:**
- Check your usage in Google Cloud Console
- Upgrade to paid tier if needed
- Implement rate limiting

#### **"Permission denied" error:**
- Verify billing is enabled on your Google Cloud project
- Check that the API key has proper permissions
- Ensure the API is enabled

#### **Slow processing:**
- Optimize image size (2-5MB recommended)
- Use JPEG format for better compression
- Consider image preprocessing (contrast, resolution)

## 📊 **Monitoring Usage**

### **Google Cloud Console:**
1. Go to **APIs & Services** → **Dashboard**
2. Click on **"Cloud Vision API"**
3. View usage metrics, quotas, and errors

### **Set Up Billing Alerts:**
1. Go to **Billing** → **Budgets & Alerts**
2. Create a new budget
3. Set alert thresholds (e.g., $10, $50, $100)
4. Add notification email addresses

## ✅ **Verification Checklist**

- [ ] Google Cloud project created
- [ ] Cloud Vision API enabled
- [ ] API key generated and restricted
- [ ] Environment variables configured
- [ ] API key tested with curl command
- [ ] OCR demo working in application
- [ ] Billing alerts configured
- [ ] Usage monitoring set up

## 🔗 **Useful Links**

- [Google Cloud Vision API Documentation](https://cloud.google.com/vision/docs)
- [API Reference](https://cloud.google.com/vision/docs/reference/rest)
- [Pricing Calculator](https://cloud.google.com/products/calculator)
- [Best Practices](https://cloud.google.com/vision/docs/best-practices)

---

**Need Help?** 
- Check the [Google Cloud Vision API documentation](https://cloud.google.com/vision/docs)
- Visit [Google Cloud Support](https://cloud.google.com/support)
- Review the troubleshooting section above
