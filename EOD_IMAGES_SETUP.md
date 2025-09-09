# 📸 EOD Images Setup Guide

This guide explains how the EOD image storage system works and how to set it up.

## 🏗️ **Architecture Overview**

### **Two-Tier Storage System:**

1. **Supabase Storage** (`eod-images` bucket)
   - Stores actual image files
   - Provides public URLs for access
   - Handles file uploads and deletions

2. **Database Table** (`eod_images`)
   - Stores image metadata and relationships
   - Links images to specific EOD reports
   - Tracks upload details and permissions

### **Data Flow:**
```
User Uploads Image → Supabase Storage → Database Record → EOD Report Link
```

## 📊 **Database Schema**

### **Updated `daily_reports` table:**
```sql
-- Added columns for sales breakdown and image URLs
ALTER TABLE daily_reports 
ADD COLUMN images TEXT[] DEFAULT '{}',
ADD COLUMN sales_cash DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN sales_transfer DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN sales_pos DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN sales_credit DECIMAL(12,2) DEFAULT 0.00;
```

### **New `eod_images` table:**
```sql
CREATE TABLE eod_images (
    id UUID PRIMARY KEY,
    report_id UUID REFERENCES daily_reports(id),
    outlet_id UUID REFERENCES outlets(id),
    file_name VARCHAR(255),
    file_path TEXT,
    file_url TEXT,
    file_size INTEGER,
    mime_type VARCHAR(100),
    image_type VARCHAR(50), -- receipt, cash_drawer, document, other
    description TEXT,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

## 🚀 **Setup Instructions**

### **Step 1: Create Storage Bucket**
1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New Bucket"**
3. Name: `eod-images`
4. Public: ✅ **Yes** (for public URLs)
5. File size limit: `50MB`
6. Allowed MIME types: `image/jpeg, image/png, image/webp, image/gif`

### **Step 2: Run Database Schema**
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the contents of `backend/database/eod-images-schema.sql`
3. Click **"Run"**

### **Step 3: Verify Setup**
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('daily_reports', 'eod_images');

-- Check if storage bucket exists
SELECT name FROM storage.buckets WHERE name = 'eod-images';
```

## 🔧 **How It Works**

### **Image Upload Process:**
1. **User selects images** in the EOD form
2. **Images uploaded** to Supabase Storage bucket
3. **Database records created** with metadata
4. **URLs stored** in both `daily_reports.images` and `eod_images.file_url`
5. **Images linked** to specific EOD report

### **Image Retrieval:**
```typescript
// Get all images for a report
const { data: images } = await eodService.getReportImages(reportId);

// Get report with image URLs
const { data: report } = await eodService.getReport(reportId);
// report.images contains array of URLs
```

### **Image Management:**
- **View images**: Display in gallery format
- **Delete images**: Remove from both storage and database
- **Update metadata**: Change description or type
- **Access control**: RLS policies ensure users only see their outlet's images

## 📱 **Frontend Integration**

### **Image Upload Component:**
```typescript
// In EODDashboard.tsx
const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(event.target.files || []);
  setFormData(prev => ({
    ...prev,
    images: [...prev.images, ...files].slice(0, 5) // Max 5 images
  }));
};
```

### **Image Display:**
```typescript
// Display uploaded images
{formData.images.map((image, index) => (
  <div key={index} className="relative">
    <img
      src={URL.createObjectURL(image)}
      alt={`Upload ${index + 1}`}
      className="w-full h-24 object-cover rounded-lg"
    />
    <button onClick={() => removeImage(index)}>
      <X className="w-3 h-3" />
    </button>
  </div>
))}
```

## 🔒 **Security & Permissions**

### **Row Level Security (RLS):**
- Users can only view images from their outlet
- Users can only upload images to their outlet
- Users can only modify images they uploaded
- Super admins can access all images

### **Storage Security:**
- Images are stored in a dedicated bucket
- Public URLs for easy access
- File type validation (images only)
- Size limits (50MB per file)

## 📈 **Benefits of This Architecture**

### **✅ Advantages:**
- **Scalable**: Can handle thousands of images
- **Organized**: Proper metadata and relationships
- **Secure**: RLS policies and access control
- **Efficient**: Fast queries and image retrieval
- **Flexible**: Easy to add image types and metadata
- **Maintainable**: Clear separation of concerns

### **🔄 Backward Compatibility:**
- Old reports still work with `images` array
- New reports use both systems
- Gradual migration possible

## 🛠️ **Maintenance**

### **Cleanup Old Images:**
```sql
-- Find orphaned images (no associated report)
SELECT * FROM eod_images 
WHERE report_id NOT IN (SELECT id FROM daily_reports);
```

### **Storage Usage:**
```sql
-- Check storage usage by outlet
SELECT 
    outlet_id,
    COUNT(*) as image_count,
    SUM(file_size) as total_size_bytes
FROM eod_images 
GROUP BY outlet_id;
```

## 🚨 **Troubleshooting**

### **Common Issues:**
1. **Images not uploading**: Check storage bucket permissions
2. **Images not displaying**: Verify public URL generation
3. **Permission denied**: Check RLS policies
4. **Large file errors**: Increase file size limit

### **Debug Queries:**
```sql
-- Check recent uploads
SELECT * FROM eod_images ORDER BY created_at DESC LIMIT 10;

-- Check storage bucket contents
SELECT * FROM storage.objects WHERE bucket_id = 'eod-images';
```

## 📋 **Next Steps**

1. **Run the setup scripts** to create the database schema
2. **Test image upload** in the EOD dashboard
3. **Verify permissions** work correctly
4. **Monitor storage usage** and performance
5. **Consider image optimization** for large files

The EOD image system is now ready to handle photo attachments for your end-of-day reports! 📸✨
