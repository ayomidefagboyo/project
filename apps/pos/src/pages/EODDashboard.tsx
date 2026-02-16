import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Check,
  Save,
  LogOut,
  Banknote,
  Smartphone,
  CreditCard,
  Receipt,
  X,
  Camera,
  Users,
  Eye,
  BarChart3,
  ChevronDown
} from 'lucide-react';
import { useOutlet } from '../contexts/OutletContext';
import { posEodService, type POSEODCreateData } from '../lib/eodService';
import { posService } from '../lib/posService';
import logger from '../lib/logger';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { SalesBreakdownModal } from '../components/SalesBreakdownModal';

const POSEODDashboard: React.FC = () => {
  const { currentOutlet } = useOutlet();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    salesCash: '',
    salesTransfer: '',
    salesPOS: '',
    salesCredit: '',
    openingBalance: '',
    closingBalance: '',
    bankDeposit: '',
    inventoryCost: '',
    notes: '',
    images: [] as File[],
  });

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real sales data from POS
  const [salesBreakdown, setSalesBreakdown] = useState<any>(null);
  const [loadingSalesData, setLoadingSalesData] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState<string>('');
  const [availableCashiers, setAvailableCashiers] = useState<any[]>([]);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [eodCompleted, setEodCompleted] = useState(false);
  const [completedSummary, setCompletedSummary] = useState<{ totalSales: number; date: string } | null>(null);

  const toNumber = (value: string): number => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    // Basic validation for numbers
    if (field !== 'date' && field !== 'notes') {
      if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
        setFormData(prev => ({ ...prev, [field]: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = Array.from(e.target.files);
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...newImages]
      }));
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const formatCurrency = (value: string | number): string => {
    const num = typeof value === 'string' ? toNumber(value) : value;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(num);
  };

  // Auto-fetch sales data when date or outlet changes
  useEffect(() => {
    const fetchSalesData = async () => {
      if (!currentOutlet?.id || !formData.date) return;

      try {
        setLoadingSalesData(true);

        // Get detailed sales breakdown for the selected date
        const breakdown = await posService.getSalesBreakdown(
          currentOutlet.id,
          formData.date,
          formData.date,
          selectedCashier || undefined
        );

        setSalesBreakdown(breakdown);

        // Update form data with real sales data (read-only)
        if (breakdown?.breakdown?.summary) {
          const summary = breakdown.breakdown.summary;
          setFormData(prev => ({
            ...prev,
            salesCash: summary.cash_total?.toString() || '0',
            salesTransfer: summary.transfer_total?.toString() || '0',
            salesPOS: summary.pos_total?.toString() || '0',
            salesCredit: summary.mobile_total?.toString() || '0', // Mobile money as credit for now
          }));
        }

        // Get available cashiers for the date
        const cashiers = await posService.getCashiersForDate(currentOutlet.id, formData.date);
        setAvailableCashiers(cashiers);

      } catch (error) {
        logger.error('Failed to fetch sales breakdown:', error);
        setErrorMessage('Failed to load sales data. Please try again.');
      } finally {
        setLoadingSalesData(false);
      }
    };

    fetchSalesData();
  }, [currentOutlet?.id, formData.date, selectedCashier || '']);

  // Real-time sync for transactions (sales updates)
  const { isConnected: isRealtimeConnected } = useRealtimeSync({
    outletId: currentOutlet?.id || '',
    enabled: !!currentOutlet?.id,
    onTransactionChange: (action, data) => {
      logger.log(`💰 Real-time: Transaction ${action}`, data);
      // Refresh sales data when new transaction comes in
      if (action === 'INSERT' && formData.date === new Date().toISOString().split('T')[0]) {
        // Only refresh if viewing today's date
        const fetchSalesData = async () => {
          try {
            const breakdown = await posService.getSalesBreakdown(
              currentOutlet!.id,
              formData.date,
              formData.date,
              selectedCashier || undefined
            );
            setSalesBreakdown(breakdown);
            if (breakdown?.breakdown?.summary) {
              const summary = breakdown.breakdown.summary;
              setFormData(prev => ({
                ...prev,
                salesCash: summary.cash_total?.toString() || '0',
                salesTransfer: summary.transfer_total?.toString() || '0',
                salesPOS: summary.pos_total?.toString() || '0',
                salesCredit: summary.mobile_total?.toString() || '0',
              }));
            }
          } catch (error) {
            logger.error('Failed to refresh sales breakdown:', error);
          }
        };
        fetchSalesData();
      }
    }
  });

  // Calculate totals
  const totalSales = toNumber(formData.salesCash) +
    toNumber(formData.salesTransfer) +
    toNumber(formData.salesPOS);

  // In POS context, we might not calculate "Net Profit" exactly the same, 
  // but we can show Total Sales and Inventory Cost/Expenses
  const totalExpenses = toNumber(formData.inventoryCost);
  const netPosition = totalSales - totalExpenses;



  const handleSubmit = async () => {
    if (!currentOutlet?.id) {
      setErrorMessage('Please select an outlet before submitting EOD.');
      return;
    }

    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payload: POSEODCreateData = {
      date: formData.date,
      sales_cash: toNumber(formData.salesCash),
      sales_transfer: toNumber(formData.salesTransfer),
      sales_pos: toNumber(formData.salesPOS),
      sales_credit: toNumber(formData.salesCredit),
      opening_balance: toNumber(formData.openingBalance),
      closing_balance: toNumber(formData.closingBalance),
      bank_deposit: toNumber(formData.bankDeposit),
      inventory_cost: toNumber(formData.inventoryCost),
      notes: formData.notes || undefined,
    };

    const { error } = await posEodService.createEODReport(payload, currentOutlet.id);

    if (error) {
      setErrorMessage(error);
    } else {
      setSuccessMessage('End of Day report saved successfully.');
      setEodCompleted(true);
      setCompletedSummary({
        totalSales: toNumber(formData.salesCash) + toNumber(formData.salesTransfer) + toNumber(formData.salesPOS),
        date: formData.date,
      });
      // Reset form fields
      setFormData(prev => ({
        ...prev,
        salesCash: '',
        salesTransfer: '',
        salesPOS: '',
        salesCredit: '',
        openingBalance: '',
        closingBalance: '',
        bankDeposit: '',
        inventoryCost: '',
        notes: '',
        images: [] as File[],
      }));
    }

    setLoading(false);
  };

  if (!currentOutlet) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-500">Please select an outlet to continue.</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 py-2">
        {/* Header */}
        <div className="mb-2">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-xl flex items-center justify-center shadow-sm">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-light text-gray-900 dark:text-white tracking-tight">
              End of Day Report
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-light">
            Capture daily sales, cash balances, and expenses for {currentOutlet.name}
          </p>
        </div>

        {/* Success Modal */}
        {successMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSuccessMessage(null)}>
            <div
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Success Icon */}
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
                <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>

              {/* Title */}
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                EOD Report Saved!
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Your End of Day report has been submitted successfully.
              </p>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setSuccessMessage(null);
                    localStorage.removeItem('pos_staff_session');
                    window.dispatchEvent(new CustomEvent('pos-staff-logout'));
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <LogOut className="w-5 h-5" />
                  Clock Out
                </button>
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-6 py-2.5 rounded-xl font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Stay Logged In
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 card border-red-200 bg-red-50/50 p-4 rounded-xl border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <span className="text-red-800 font-light">{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* EOD Completed State */}
        {eodCompleted && !successMessage ? (
          <div className="max-w-lg mx-auto mt-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Day Closed
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-1">
                EOD report for <span className="font-medium text-gray-700 dark:text-gray-300">{completedSummary?.date}</span> has been submitted.
              </p>
              {completedSummary && (
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
                  Total Sales: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(completedSummary.totalSales)}</span>
                </p>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/')}
                  className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <BarChart3 className="w-5 h-5" />
                  Go to Register
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('pos_staff_session');
                    window.dispatchEvent(new CustomEvent('pos-staff-logout'));
                  }}
                  className="w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-700 dark:text-red-400 px-6 py-2.5 rounded-xl font-medium transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="w-4 h-4" />
                  Clock Out
                </button>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500 mt-6">
                Any new sales will automatically roll into the next business day.
              </p>
            </div>
          </div>
        ) : (

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-4">

              {/* Sales Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white tracking-tight">
                    Sales Information
                  </h3>
                  <div className="flex items-center gap-3">
                    {loadingSalesData && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                    )}
                    {/* Cashier Filter */}
                    {availableCashiers.length > 0 && (
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <Users className="w-4 h-4 text-gray-500 group-hover:text-gray-700 dark:text-gray-400" />
                        </div>
                        <select
                          value={selectedCashier}
                          onChange={(e) => setSelectedCashier(e.target.value)}
                          className="appearance-none pl-9 pr-8 py-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="">Filter: All Cashiers</option>
                          {availableCashiers.map((cashier) => (
                            <option key={cashier.id} value={cashier.id}>
                              Filter: {cashier.name}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => setShowBreakdownModal(true)}
                      disabled={!salesBreakdown}
                      className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Cash Sales */}
                  <div className="space-y-3">
                    <label className="flex items-center text-sm font-medium text-gray-500 uppercase tracking-wider">
                      <div className="w-6 h-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center mr-3">
                        <Banknote className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      Cash Sales
                    </label>
                    <div className="relative">
                      <div className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-lg font-semibold text-right tabular-nums tracking-tight">
                        {formatCurrency(toNumber(formData.salesCash))}
                      </div>
                      {salesBreakdown?.breakdown?.by_payment_method?.cash && (
                        <div className="mt-1 text-xs text-gray-500">
                          {salesBreakdown.breakdown.by_payment_method.cash.count} txns
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile Transfer */}
                  <div className="space-y-3">
                    <label className="flex items-center text-sm font-medium text-gray-500 uppercase tracking-wider">
                      <div className="w-6 h-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mr-3">
                        <Smartphone className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      </div>
                      Mobile Transfer
                    </label>
                    <div className="relative">
                      <div className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-lg font-semibold text-right tabular-nums tracking-tight">
                        {formatCurrency(toNumber(formData.salesTransfer))}
                      </div>
                      {salesBreakdown?.breakdown?.by_payment_method?.transfer && (
                        <div className="mt-1 text-xs text-gray-500">
                          {salesBreakdown.breakdown.by_payment_method.transfer.count} txns
                        </div>
                      )}
                    </div>
                  </div>

                  {/* POS/Card */}
                  <div className="space-y-3">
                    <label className="flex items-center text-sm font-medium text-gray-500 uppercase tracking-wider">
                      <div className="w-6 h-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mr-3">
                        <CreditCard className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                      </div>
                      POS / Card
                    </label>
                    <div className="relative">
                      <div className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-lg font-semibold text-right tabular-nums tracking-tight">
                        {formatCurrency(toNumber(formData.salesPOS))}
                      </div>
                      {salesBreakdown?.breakdown?.by_payment_method?.pos && (
                        <div className="mt-1 text-xs text-gray-500">
                          {salesBreakdown.breakdown.by_payment_method.pos.count} txns
                        </div>
                      )}
                    </div>
                  </div>
                </div>


              </div>

              {/* Expenses & Notes Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 tracking-tight">
                  Expenses & Notes
                </h3>

                <div className="space-y-3">
                  {/* Expenses Amount + Add Photo Row */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="flex items-center text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        <Receipt className="w-3 h-3 text-red-500 mr-2" />
                        Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">₦</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formData.inventoryCost}
                          onChange={(e) => handleChange('inventoryCost', e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-gray-500 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors px-3 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-orange-200 dark:hover:border-orange-800 shrink-0">
                      <Camera className="w-4 h-4" />
                      <span className="text-sm font-medium">Add Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Image Previews */}
                  {formData.images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.images.map((file, index) => (
                        <div key={index} className="relative group w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Receipt ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => removeImage(index)}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    rows={3}
                    placeholder="Notes about today's expenses or operations... (optional)"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Summary Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sticky top-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 tracking-tight">
                  Summary
                </h3>

                <div className="space-y-4">
                  {/* Date Selection - Moved and Compact */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Report Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleChange('date', e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                      />
                    </div>
                  </div>

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
                        Expenses
                      </span>
                    </div>
                    <span className="text-lg font-light text-red-700 dark:text-red-300 tracking-tight">
                      {formatCurrency(totalExpenses)}
                    </span>
                  </div>

                  {/* Net Position */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Net Position
                        </span>
                      </div>
                      <span className={`text-xl font-light tracking-tight ${netPosition >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                        {formatCurrency(netPosition)}
                      </span>
                    </div>
                  </div>



                  {/* Submit Button */}
                  <div className="pt-4">
                    <button
                      onClick={handleSubmit}
                      disabled={loading || !formData.date}
                      className="w-full bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white border-0 px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Create EOD Report</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showBreakdownModal && salesBreakdown && (
            <SalesBreakdownModal
              isOpen={showBreakdownModal}
              onClose={() => setShowBreakdownModal(false)}
              salesBreakdown={salesBreakdown}
              formData={formData}
              selectedCashier={selectedCashier}
              availableCashiers={availableCashiers}
              formatCurrency={formatCurrency}
            />
          )}
      </div>
    </div>
  );
};

export default POSEODDashboard;
