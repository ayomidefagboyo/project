# EOD Multi-Outlet Setup Guide

## 🎯 What's Been Implemented

### ✅ **Completed Features:**
1. **Frontend Migration**: EOD Dashboard now uses FastAPI services instead of Supabase
2. **Multi-Outlet Dashboard**: New comprehensive view for managers/admins
3. **Environment Configuration**: `.env` file created for backend connection
4. **Navigation**: Added EOD routes and sidebar navigation
5. **Error Handling**: Integrated with new error handling system
6. **Loading States**: Proper loading indicators throughout

### 🚀 **Quick Start**

#### 1. Backend Setup
```bash
# Install Python dependencies (if not already done)
cd backend
pip install -r requirements.txt

# Start the FastAPI backend
cd ..
python start-backend.py
```

#### 2. Frontend Setup
```bash
# Install Node dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

#### 3. Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### 📱 **EOD Features Available**

#### Single Outlet EOD (`/eod`)
- Submit daily sales by payment method (Cash, Transfer, POS, Credit)
- Cash management (Opening/Closing balance, Bank deposits)
- Inventory cost tracking
- Automatic variance calculations
- Recent reports view
- Analytics dashboard

#### Multi-Outlet EOD (`/eod/multi-outlet`)
- Overview of all outlets' performance
- Real-time status indicators (Good/Warning/Critical)
- Consolidated metrics across outlets
- Individual outlet details
- Pending reports tracking
- Cross-outlet analytics (coming soon)

### 🔐 **Permissions Required**

#### Single Outlet Access:
- `manage_reports` - Create/update EOD reports
- `view_reports` - View EOD reports and analytics

#### Multi-Outlet Access:
- `view_all_outlets` - View data from all outlets
- `super_admin` or `outlet_admin` role

### 🗄️ **Database Schema**

The system uses the existing `daily_reports` table with these key fields:
- `outlet_id` - Links report to specific outlet
- `date` - Report date (unique per outlet)
- `sales_*` - Payment method breakdowns
- `opening_balance` / `closing_balance` - Cash management
- `total_sales` - Calculated total
- `gross_profit` - Calculated profit
- `cash_variance` - Calculated variance
- `status` - Report status (draft/submitted/approved)
- `discrepancies` - JSON field for variance tracking

### 🔧 **Configuration**

#### Environment Variables (`.env`):
```env
# FastAPI Backend
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Debug Mode
VITE_DEBUG=true

# Supabase (for legacy compatibility)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 🧪 **Testing the System**

1. **Start both servers** (backend and frontend)
2. **Login** with your user account
3. **Navigate to EOD Reports** (`/eod`)
4. **Submit a test report** with sample data
5. **Check Multi-Outlet view** (`/eod/multi-outlet`) if you have permissions

### 🎨 **Key Features**

#### Smart Variance Detection:
- **Green**: Variance < $5 (Good)
- **Yellow**: Variance $5-$50 (Warning)  
- **Red**: Variance > $50 (Critical)

#### Automatic Calculations:
- Total sales across payment methods
- Expected cash vs actual cash
- Gross profit and margin percentages
- Cash flow variance detection

#### Multi-Outlet Intelligence:
- Outlet status based on pending reports and variances
- Best/worst performing outlet identification
- Consolidated analytics across locations

### 🚨 **Troubleshooting**

#### Common Issues:

1. **Backend Connection Error**:
   - Check if FastAPI server is running on port 8000
   - Verify `.env` file has correct `VITE_API_BASE_URL`

2. **Permission Denied**:
   - Ensure user has `manage_reports` or `view_reports` permissions
   - For multi-outlet: need `view_all_outlets` or admin role

3. **Data Not Loading**:
   - Check browser console for API errors
   - Verify database connection in backend
   - Ensure outlet_id is properly set for user

4. **Authentication Issues**:
   - Check JWT token is valid
   - Verify user session hasn't expired

### 📈 **Next Steps**

#### Planned Enhancements:
- [ ] Cross-outlet comparison charts
- [ ] Automated anomaly detection
- [ ] Email notifications for discrepancies
- [ ] Export functionality for reports
- [ ] Mobile-responsive improvements
- [ ] Offline capability

### 🤝 **Support**

If you encounter issues:
1. Check the browser console for errors
2. Verify backend logs for API errors
3. Ensure all environment variables are set
4. Test with a simple EOD report first

---

**Status**: ✅ Ready for testing with multi-outlet EOD reporting functionality!
