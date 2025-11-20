import React, { useState, useEffect } from 'react';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Check,
  Save,
  Banknote,
  Smartphone,
  CreditCard,
  Receipt,
  FileText,
  Camera,
  X
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useOutlet } from '../../contexts/OutletContext';
import { eodService } from '../../lib/eodService';
import { useErrorHandler } from '../../lib/errorHandler';
import { currencyService } from '../../lib/currencyService';
import { supabase } from '../../lib/supabase';
import CompanyOnboarding from '../../components/onboarding/CompanyOnboarding';

interface EODFormData {
  date: string;
  salesCash: string;
  salesTransfer: string;
  salesPOS: string;
  expenses: string;
  notes: string;
  images: File[];
}

const EODDashboard: React.FC = () => {
  const { currentOutlet, refreshData } = useOutlet();
  const { error, setError, clearError } = useErrorHandler();
  
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formData, setFormData] = useState<EODFormData>({
    date: new Date().toISOString().split('T')[0],
    salesCash: '',
    salesTransfer: '',
    salesPOS: '',
    expenses: '',
    notes: '',
    images: []
  });

  const currentCurrency = currencyService.getCurrentCurrency();

  // Handle input changes for text fields
  const handleInputChange = (field: keyof EODFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle number input changes with proper validation
  const handleNumberInput = (field: keyof EODFormData, value: string) => {
    // Allow empty string, numbers, and decimal points
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // Convert string to number for calculations
  const toNumber = (value: string): number => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  // Format currency for display
  const formatCurrency = (amount: string | number): string => {
    const value = typeof amount === 'string' ? toNumber(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currentCurrency.code,
      minimumFractionDigits: 2
    }).format(value);
  };

  // Calculate totals
  const totalSales = toNumber(formData.salesCash) + toNumber(formData.salesTransfer) + toNumber(formData.salesPOS);
  const netProfit = totalSales - toNumber(formData.expenses);

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...files].slice(0, 5) // Max 5 images
    }));
  };

  // Remove image
  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      setLoading(true);
      clearError();

      if (!currentOutlet) {
        setError('No outlet selected');
        return;
      }

      // Validate required fields
      if (!formData.date) {
        setError('Date is required');
        return;
      }
      
      // Test database connection
      console.log('Testing database connection...');
      try {
        const { data: testResult, error: testError } = await supabase
          .from('daily_reports')
          .select('count')
          .limit(1);
        console.log('DB test result:', { testResult, testError });
      } catch (dbError) {
        console.error('Database connection test failed:', dbError);
      }

      const reportData = {
        outlet_id: currentOutlet.id,
        date: formData.date,
        sales_cash: toNumber(formData.salesCash),
        sales_transfer: toNumber(formData.salesTransfer),
        sales_pos: toNumber(formData.salesPOS),
        expenses: toNumber(formData.expenses),
        notes: formData.notes,
        images: formData.images
      };

      console.log('Creating EOD report with data:', reportData);
      const result = await eodService.createReport(reportData);
      console.log('EOD creation result:', result);
      
      if (result.error) {
        setError(`Failed to create EOD report: ${result.error}`);
        return;
      }
      
      setShowSuccess(true);
      
      // Reset form after success
      setTimeout(() => {
        setShowSuccess(false);
        setFormData({
          date: new Date().toISOString().split('T')[0],
          salesCash: '',
          salesTransfer: '',
          salesPOS: '',
          expenses: '',
          notes: '',
          images: []
        });
      }, 2000);

    } catch (err) {
      setError('Failed to create EOD report');
      console.error('Create report error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!currentOutlet) {
    return (
      <CompanyOnboarding
        onComplete={() => {
          // Refresh outlet data after onboarding
          refreshData();
        }}
        onSkip={() => {
          // For now, just refresh - could redirect to dashboard
          refreshData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 rounded-xl flex items-center justify-center shadow-sm">
              <Calendar className="w-5 h-5 text-white dark:text-gray-900" />
            </div>
            <h1 className="text-3xl font-light text-gray-900 dark:text-white tracking-tight">
              End of Day Report
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-light">
            Create your daily sales and expense report for {currentOutlet.name}
          </p>
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="mb-6 card border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-emerald-800 dark:text-emerald-200 font-medium">
                EOD report created successfully!
              </span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 card border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <span className="text-red-800 dark:text-red-200 font-light">{error}</span>
              </div>
              <button
                onClick={clearError}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Date Selection */}
            <div className="card p-6">
              <h3 className="text-lg font-medium text-foreground mb-6 tracking-tight">
                Report Date
              </h3>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            {/* Sales Section */}
            <div className="card p-6">
              <h3 className="text-lg font-medium text-foreground mb-6 tracking-tight">
                Sales Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Cash Sales */}
                <div className="space-y-3">
                  <label className="flex items-center text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="w-6 h-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center mr-3">
                      <Banknote className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    Cash Sales
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                      {currentCurrency.symbol}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.salesCash}
                      onChange={(e) => handleNumberInput('salesCash', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Mobile Transfer */}
                <div className="space-y-3">
                  <label className="flex items-center text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="w-6 h-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mr-3">
                      <Smartphone className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    </div>
                    Mobile Transfer
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                      {currentCurrency.symbol}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.salesTransfer}
                      onChange={(e) => handleNumberInput('salesTransfer', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </div>

                {/* POS/Card */}
                <div className="space-y-3">
                  <label className="flex items-center text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="w-6 h-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mr-3">
                      <CreditCard className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                    </div>
                    POS/Card
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                      {currentCurrency.symbol}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.salesPOS}
                      onChange={(e) => handleNumberInput('salesPOS', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Expenses Section */}
            <div className="card p-6">
              <h3 className="text-lg font-medium text-foreground mb-6 tracking-tight">
                Expenses
              </h3>
              
              <div className="space-y-3">
                <label className="flex items-center text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  <div className="w-6 h-6 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center mr-3">
                    <Receipt className="w-3 h-3 text-red-600 dark:text-red-400" />
                  </div>
                  Total Expenses
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                    {currentCurrency.symbol}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.expenses}
                    onChange={(e) => handleNumberInput('expenses', e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            {/* Images Section */}
            <div className="card p-6">
              <h3 className="text-lg font-medium text-foreground mb-6 tracking-tight">
                Supporting Images
              </h3>
              
              <div className="space-y-4">
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="inline-flex items-center px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white border-0 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Add Images
                  </label>
                  <p className="text-sm text-muted-foreground mt-2 font-light">
                    Upload receipts, photos, or other supporting documents (Max 5 images)
                  </p>
                </div>

                {/* Image Preview */}
                {formData.images.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {formData.images.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg border"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Notes Section */}
            <div className="card p-6">
              <h3 className="text-lg font-medium text-foreground mb-6 tracking-tight">
                Notes & Comments
              </h3>
              
              <div className="space-y-3">
                <label className="flex items-center text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  <div className="w-6 h-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex items-center justify-center mr-3">
                    <FileText className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                  </div>
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={4}
                  placeholder="Any special notes about today's operations, issues, or observations..."
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-8">
              <h3 className="text-lg font-medium text-foreground mb-6 tracking-tight">
                Summary
              </h3>
              
              <div className="space-y-6">
                {/* Total Sales */}
                <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">
                      Total Sales
                    </span>
                  </div>
                  <span className="text-lg font-light text-emerald-700 dark:text-emerald-300 tracking-tight">
                    {formatCurrency(totalSales)}
                  </span>
                </div>

                {/* Total Expenses */}
                <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                      <Receipt className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-sm font-medium text-red-900 dark:text-red-100 uppercase tracking-wider">
                      Total Expenses
                    </span>
                  </div>
                  <span className="text-lg font-light text-red-700 dark:text-red-300 tracking-tight">
                    {formatCurrency(formData.expenses)}
                  </span>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
                  {/* Net Profit */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Net Profit
                      </span>
                    </div>
                    <span className={`text-xl font-light tracking-tight ${
                      netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(netProfit)}
                    </span>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={loading || !formData.date}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white border-0 px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white dark:border-gray-900"></div>
                        <span>Saving...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <Save className="w-4 h-4" />
                        <span>Create EOD Report</span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EODDashboard;