import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Building2, Calendar, DollarSign, Camera, Scan, CreditCard, Tag, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { ocrService } from '@/lib/services';
import { ExpenseCategory } from '@/types';
import { formatCurrency } from '@/lib/utils';
import Toast from '@/components/ui/Toast';

interface ExpenseFormData {
  category: ExpenseCategory;
  amount: number;
  description: string;
  notes: string;
  expenseDate: string;
  receiptUrl?: string;
  merchantName: string;
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'check';
}

type InputMode = 'manual' | 'scan';

const expenseCategories: { value: ExpenseCategory; label: string; description: string }[] = [
  { value: 'outlet_operational', label: 'Operational', description: 'Day-to-day business operations' },
  { value: 'outlet_marketing', label: 'Marketing', description: 'Advertising and promotional expenses' },
  { value: 'outlet_utilities', label: 'Utilities', description: 'Electricity, water, internet, etc.' },
  { value: 'outlet_rent', label: 'Rent', description: 'Property lease and rental costs' },
  { value: 'outlet_supplies', label: 'Supplies', description: 'Office and business supplies' },
  { value: 'outlet_maintenance', label: 'Maintenance', description: 'Repairs and upkeep' },
  { value: 'outlet_travel', label: 'Travel', description: 'Business travel expenses' },
  { value: 'outlet_meals', label: 'Meals', description: 'Business meals and entertainment' },
];

const paymentMethods = [
  { value: 'card' as const, label: 'Credit/Debit Card', icon: CreditCard },
  { value: 'cash' as const, label: 'Cash', icon: DollarSign },
  { value: 'bank_transfer' as const, label: 'Bank Transfer', icon: Building2 },
  { value: 'check' as const, label: 'Check', icon: FileText },
];

const CreateExpense: React.FC = () => {
  const navigate = useNavigate();
  const { currentOutlet, currentUser } = useOutlet();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [processingOCR, setProcessingOCR] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('manual');
  
  const [formData, setFormData] = useState<ExpenseFormData>({
    category: 'outlet_operational',
    amount: 0,
    description: '',
    notes: '',
    expenseDate: new Date().toISOString().split('T')[0],
    merchantName: '',
    paymentMethod: 'card'
  });

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({
      message,
      type,
      isVisible: true
    });
  };

  const hideToast = () => {
    setToast(prev => ({
      ...prev,
      isVisible: false
    }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('File size must be less than 10MB', 'error');
      return;
    }

    try {
      setProcessingOCR(true);
      showToast('Processing receipt image...', 'info');

      const { data: ocrResult, error } = await ocrService.uploadAndProcessFile(file, 'receipt', {
        extract_tables: true,
        extract_line_items: false,
        confidence_threshold: 0.7,
        language: 'en'
      });
      
      if (error) {
        showToast(`OCR processing failed: ${error}`, 'error');
        return;
      }

      if (ocrResult && ocrResult.extracted_data) {
        const extractedData = ocrResult.extracted_data;
        
        setFormData(prev => ({
          ...prev,
          amount: extractedData.total_amount || 0,
          merchantName: extractedData.vendor_name || extractedData.merchant_name || '',
          expenseDate: extractedData.transaction_date || extractedData.expense_date || prev.expenseDate,
          description: extractedData.vendor_name ? `Expense at ${extractedData.vendor_name}` : prev.description
        }));
        
        setInputMode('scan');
        showToast(`Receipt details extracted successfully! (Confidence: ${Math.round((ocrResult.confidence_score || 0) * 100)}%)`, 'success');
      } else {
        showToast('Could not extract receipt details from image', 'warning');
      }
    } catch (err) {
      console.error('OCR processing error:', err);
      showToast('Failed to process receipt image', 'error');
    } finally {
      setProcessingOCR(false);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const validateForm = (): boolean => {
    if (formData.amount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return false;
    }
    
    if (!formData.description.trim()) {
      showToast('Please provide a description for this expense', 'error');
      return false;
    }
    
    if (!formData.expenseDate) {
      showToast('Please set an expense date', 'error');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !currentOutlet || !currentUser) return;
    
    try {
      setLoading(true);
      
      // Here you would typically call an expense service to create the expense
      // const { data, error } = await expenseService.createExpense(formData, currentOutlet.id, currentUser.id);
      
      // For now, we'll simulate success
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      
      showToast('Expense created successfully! It has been submitted for approval.', 'success');
      setTimeout(() => {
        navigate('/dashboard/expenses');
      }, 2000);
    } catch (err) {
      console.error('Error creating expense:', err);
      showToast('Failed to create expense. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = expenseCategories.find(cat => cat.value === formData.category);
  const selectedPaymentMethod = paymentMethods.find(method => method.value === formData.paymentMethod);

  return (
    <div className="min-h-screen bg-background">
      <div className="container-width">
        {/* Header */}
        <div className="flex items-center justify-between py-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard/expenses')}
              className="btn-secondary p-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create Expense</h1>
                <p className="text-muted-foreground text-sm">Scan receipt or manually enter expense details</p>
              </div>
            </div>
          </div>
        </div>

        {/* Input Mode Selection */}
        <div className="card p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Input Method</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setInputMode('scan')}
              className={`p-6 rounded-lg border-2 transition-all duration-200 flex flex-col items-center text-center space-y-3 ${
                inputMode === 'scan' 
                  ? 'border-primary bg-primary/5 shadow-sm' 
                  : 'border-border hover:border-border/60 hover:bg-muted/20'
              }`}
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                inputMode === 'scan' 
                  ? 'bg-primary/10' 
                  : 'bg-muted'
              }`}>
                <Camera className={`w-6 h-6 ${
                  inputMode === 'scan' ? 'text-primary' : 'text-muted-foreground'
                }`} />
              </div>
              <div>
                <h3 className={`font-medium ${
                  inputMode === 'scan' ? 'text-foreground' : 'text-muted-foreground'
                }`}>Scan Receipt</h3>
                <p className="text-xs text-muted-foreground mt-1">Upload receipt for auto-extraction</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('manual')}
              className={`p-6 rounded-lg border-2 transition-all duration-200 flex flex-col items-center text-center space-y-3 ${
                inputMode === 'manual' 
                  ? 'border-primary bg-primary/5 shadow-sm' 
                  : 'border-border hover:border-border/60 hover:bg-muted/20'
              }`}
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                inputMode === 'manual' 
                  ? 'bg-primary/10' 
                  : 'bg-muted'
              }`}>
                <FileText className={`w-6 h-6 ${
                  inputMode === 'manual' ? 'text-primary' : 'text-muted-foreground'
                }`} />
              </div>
              <div>
                <h3 className={`font-medium ${
                  inputMode === 'manual' ? 'text-foreground' : 'text-muted-foreground'
                }`}>Manual Entry</h3>
                <p className="text-xs text-muted-foreground mt-1">Type details manually</p>
              </div>
            </button>
          </div>
        </div>

        {/* File Upload (for scan mode) */}
        {inputMode === 'scan' && (
          <div className="card p-8 mb-8">
            <div className="text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div 
                onClick={triggerFileUpload}
                className="border-2 border-dashed border-border rounded-xl p-12 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all duration-200"
              >
                {processingOCR ? (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <div>
                      <p className="font-medium text-foreground">Processing Receipt</p>
                      <p className="text-sm text-muted-foreground mt-1">Extracting details from your image...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl flex items-center justify-center">
                      <Scan className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">Upload Receipt Image</h3>
                      <p className="text-muted-foreground mb-1">
                        Take a photo or select an image file
                      </p>
                      <p className="text-xs text-muted-foreground">
                        We'll automatically extract the details for you
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 pb-32">
          {/* Expense Category */}
          <div className="card p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg flex items-center justify-center">
                <Tag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Expense Category</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-3">
                  Select Category *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {expenseCategories.map((category) => (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, category: category.value }))}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                        formData.category === category.value
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-border/60 hover:bg-muted/20'
                      }`}
                    >
                      <h4 className={`font-medium mb-1 ${
                        formData.category === category.value ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {category.label}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {category.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {selectedCategory && (
                <div className="p-4 bg-muted/30 border border-border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">Selected: {selectedCategory.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{selectedCategory.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Expense Details */}
          <div className="card p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Expense Details</h2>
            </div>
            
            <div className="space-y-6">
              {/* Amount - Prominent */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground text-lg">$</span>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={formData.amount || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="w-full pl-12 pr-4 py-4 text-2xl font-semibold text-center bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  />
                </div>
              </div>

              {/* Merchant Name and Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Merchant Name
                  </label>
                  <input
                    type="text"
                    value={formData.merchantName}
                    onChange={(e) => setFormData(prev => ({ ...prev, merchantName: e.target.value }))}
                    placeholder="Where was this expense incurred?"
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expenseDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, expenseDate: e.target.value }))}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this expense..."
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional details or business purpose..."
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors resize-none"
                />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="card p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Payment Method</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, paymentMethod: method.value }))}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 flex items-center space-x-3 ${
                        formData.paymentMethod === method.value
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-border/60 hover:bg-muted/20'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        formData.paymentMethod === method.value ? 'bg-primary/10' : 'bg-muted'
                      }`}>
                        <Icon className={`w-4 h-4 ${
                          formData.paymentMethod === method.value ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                      </div>
                      <span className={`font-medium ${
                        formData.paymentMethod === method.value ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {method.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedPaymentMethod && (
                <div className="p-4 bg-muted/30 border border-border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <selectedPaymentMethod.icon className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">Payment via {selectedPaymentMethod.label}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          {formData.amount > 0 && (
            <div className="card p-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground mb-2">Expense Total</p>
                <p className="text-4xl font-bold text-foreground mb-2">
                  {formatCurrency(formData.amount)}
                </p>
                <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
                  <span>{selectedCategory?.label}</span>
                  <span>•</span>
                  <span>{new Date(formData.expenseDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Fixed Submit Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border p-4 sm:p-6">
          <div className="container-width">
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard/expenses')}
                disabled={loading}
                className="btn-secondary flex-1 py-4"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary flex-1 py-4 font-semibold"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </div>
                ) : (
                  'Submit Expense'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={4000}
      />
    </div>
  );
};

export default CreateExpense;