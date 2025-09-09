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
  const { currentOutlet } = useOutlet();
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Outlet Selected
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Please select an outlet to create an EOD report.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            End of Day Report
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Create your daily sales and expense report for {currentOutlet.name}
          </p>
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center">
              <Check className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-green-800 dark:text-green-200 font-medium">
                EOD report created successfully!
              </span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                <span className="text-red-800 dark:text-red-200">{error}</span>
              </div>
              <button
                onClick={clearError}
                className="text-red-600 hover:text-red-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Date Selection */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Report Date
              </h3>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Sales Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Sales Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Cash Sales */}
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Banknote className="w-4 h-4 text-green-600 mr-2" />
                    Cash Sales
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      {currentCurrency.symbol}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.salesCash}
                      onChange={(e) => handleNumberInput('salesCash', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Mobile Transfer */}
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Smartphone className="w-4 h-4 text-blue-600 mr-2" />
                    Mobile Transfer
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      {currentCurrency.symbol}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.salesTransfer}
                      onChange={(e) => handleNumberInput('salesTransfer', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* POS/Card */}
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                    <CreditCard className="w-4 h-4 text-purple-600 mr-2" />
                    POS/Card
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      {currentCurrency.symbol}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.salesPOS}
                      onChange={(e) => handleNumberInput('salesPOS', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Expenses Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Expenses
              </h3>
              
              <div className="space-y-2">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Receipt className="w-4 h-4 text-red-600 mr-2" />
                  Total Expenses
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    {currentCurrency.symbol}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.expenses}
                    onChange={(e) => handleNumberInput('expenses', e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Images Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
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
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Add Images
                  </label>
                  <p className="text-sm text-gray-500 mt-1">
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Notes & Comments
              </h3>
              
              <div className="space-y-2">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <FileText className="w-4 h-4 text-gray-600 mr-2" />
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={4}
                  placeholder="Any special notes about today's operations, issues, or observations..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
              </div>
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Summary
              </h3>
              
              <div className="space-y-4">
                {/* Total Sales */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <TrendingUp className="w-4 h-4 text-green-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Total Sales
                    </span>
                  </div>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(totalSales)}
                  </span>
                </div>

                {/* Total Expenses */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Receipt className="w-4 h-4 text-red-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Total Expenses
                    </span>
                  </div>
                  <span className="text-lg font-bold text-red-600">
                    {formatCurrency(formData.expenses)}
                  </span>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                  {/* Net Profit */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <DollarSign className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Net Profit
                      </span>
                    </div>
                    <span className={`text-xl font-bold ${
                      netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(netProfit)}
                    </span>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-6">
                  <Button
                    onClick={handleSubmit}
                    disabled={loading || !formData.date}
                    className="w-full"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Save className="w-4 h-4 mr-2" />
                        Create EOD Report
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