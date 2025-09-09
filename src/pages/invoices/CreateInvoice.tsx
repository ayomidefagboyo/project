import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Upload, FileText, Building2, Calendar, DollarSign, Camera, Scan } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { vendorInvoiceService } from '@/lib/vendorInvoiceService';
import { vendorService } from '@/lib/vendorService';
import { ocrService } from '@/lib/services';
import { Vendor, VendorInvoiceItem, ExpenseCategory } from '@/types';
import { formatCurrency } from '@/lib/utils';
import Toast from '@/components/ui/Toast';

interface InvoiceFormData {
  vendorId: string;
  totalAmount: number;
  dueDate: string;
  description: string;
  notes: string;
  items: Omit<VendorInvoiceItem, 'id'>[];
  attachments: string[];
  invoiceDate: string;
  invoiceNumber?: string;
}

type InputMode = 'manual' | 'scan';

const CreateInvoice: React.FC = () => {
  const navigate = useNavigate();
  const { currentOutlet, currentUser } = useOutlet();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [processingOCR, setProcessingOCR] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('manual');
  
  const [formData, setFormData] = useState<InvoiceFormData>({
    vendorId: '',
    totalAmount: 0,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    invoiceDate: new Date().toISOString().split('T')[0],
    description: '',
    notes: '',
    items: [],
    attachments: [],
    invoiceNumber: ''
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

  // Load available vendors
  useEffect(() => {
    const loadVendors = async () => {
      if (!currentOutlet) return;
      
      try {
        setLoadingVendors(true);
        setError(null); // Clear any previous errors
        const { data, error } = await vendorInvoiceService.getAvailableVendors(currentOutlet.id);
        
        if (error) {
          // Only show error if it's not a "no vendors" case or database schema issue
          if (!error.includes('No vendors found') && 
              !error.includes('not found') && 
              !error.includes('column "scope"') &&
              !error.includes('Failed to get vendors for outlet')) {
            setError(error);
          } else {
            // For schema issues or empty results, just set empty array
            setVendors([]);
          }
        } else if (data) {
          setVendors(data);
        } else {
          // Handle case where data is null but no error (empty result)
          setVendors([]);
        }
      } catch (err) {
        console.error('Error loading vendors:', err);
        // Don't set error for empty vendor case
        setVendors([]);
      } finally {
        setLoadingVendors(false);
      }
    };

    loadVendors();
  }, [currentOutlet]);

  // Calculate total amount from line items (only if in manual mode with items)
  useEffect(() => {
    if (inputMode === 'manual' && formData.items.length > 0) {
      const total = formData.items.reduce((sum, item) => sum + item.total, 0);
      if (total !== formData.totalAmount) {
        setFormData(prev => ({ ...prev, totalAmount: total }));
      }
    }
  }, [formData.items, inputMode]);

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

  const handleVendorChange = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    setSelectedVendor(vendor || null);
    setFormData(prev => ({ ...prev, vendorId }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size must be less than 10MB', 'error');
      return;
    }

    try {
      setProcessingOCR(true);
      showToast('Processing invoice image...', 'info');

      // Use OCR service to extract text
      const { data: ocrResult, error } = await ocrService.uploadAndProcessFile(file, 'invoice', {
        extract_tables: true,
        extract_line_items: true,
        confidence_threshold: 0.7,
        language: 'en'
      });
      
      if (error) {
        showToast(`OCR processing failed: ${error}`, 'error');
        return;
      }

      if (ocrResult && ocrResult.extracted_data) {
        const extractedData = ocrResult.extracted_data;
        
        // Auto-fill form with OCR results
        setFormData(prev => ({
          ...prev,
          totalAmount: extractedData.total_amount || 0,
          invoiceNumber: extractedData.invoice_number || '',
          invoiceDate: extractedData.invoice_date || prev.invoiceDate,
          dueDate: extractedData.due_date || prev.dueDate,
          description: extractedData.vendor_name ? `Invoice from ${extractedData.vendor_name}` : prev.description
        }));
        
        setInputMode('scan');
        showToast(`Invoice details extracted successfully! (Confidence: ${Math.round((ocrResult.confidence_score || 0) * 100)}%)`, 'success');
      } else {
        showToast('Could not extract invoice details from image', 'warning');
      }
    } catch (err) {
      console.error('OCR processing error:', err);
      showToast('Failed to process invoice image', 'error');
    } finally {
      setProcessingOCR(false);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const addLineItem = () => {
    const newItem: Omit<VendorInvoiceItem, 'id'> = {
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      category: 'outlet_operational'
    };
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const updateLineItem = (index: number, field: keyof Omit<VendorInvoiceItem, 'id'>, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Recalculate total for this item
      if (field === 'quantity' || field === 'unitPrice') {
        newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
      }
      
      return { ...prev, items: newItems };
    });
  };

  const removeLineItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.vendorId) {
      showToast('Please select a vendor', 'error');
      return false;
    }
    
    if (!formData.dueDate) {
      showToast('Please set a due date', 'error');
      return false;
    }
    
    if (formData.totalAmount <= 0) {
      showToast('Please enter a valid total amount', 'error');
      return false;
    }
    
    // For manual mode with line items, validate them
    if (inputMode === 'manual' && formData.items.length > 0) {
      const hasInvalidItems = formData.items.some(item => 
        !item.description.trim() || item.quantity <= 0 || item.unitPrice <= 0
      );
      
      if (hasInvalidItems) {
        showToast('Please fill in all line item details with valid values', 'error');
        return false;
      }
    }
    
    // For scan mode or manual without items, just need total amount and description
    if ((inputMode === 'scan' || formData.items.length === 0) && !formData.description.trim()) {
      showToast('Please provide a description for this invoice', 'error');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !currentOutlet || !currentUser) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await vendorInvoiceService.createVendorInvoice(
        {
          vendorId: formData.vendorId,
          amount: formData.totalAmount,
          dueDate: formData.dueDate,
          description: formData.description,
          notes: formData.notes,
          items: formData.items.length > 0 ? formData.items : [{
            description: formData.description || 'Invoice total',
            quantity: 1,
            unitPrice: formData.totalAmount,
            total: formData.totalAmount,
            category: 'outlet_operational' as ExpenseCategory
          }],
          attachments: formData.attachments
        },
        currentOutlet.id,
        currentUser.id
      );
      
      if (error) {
        showToast(`Failed to create invoice: ${error}`, 'error');
      } else if (data) {
        showToast('Vendor invoice created successfully! It has been submitted for approval.', 'success');
        // Navigate back to invoices page after a short delay
        setTimeout(() => {
          navigate('/invoices');
        }, 2000);
      }
    } catch (err) {
      console.error('Error creating vendor invoice:', err);
      showToast('Failed to create vendor invoice. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loadingVendors) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading vendors...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile-First Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/invoices')}
            className="flex items-center gap-1 text-gray-600 dark:text-gray-300 -ml-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Create Invoice
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Scan or enter vendor bill
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Input Mode Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={inputMode === 'scan' ? 'default' : 'outline'}
              onClick={() => setInputMode('scan')}
              className="h-20 flex flex-col items-center justify-center gap-2 text-sm"
            >
              <Camera size={24} />
              <span>Scan Invoice</span>
            </Button>
            <Button
              type="button"
              variant={inputMode === 'manual' ? 'default' : 'outline'}
              onClick={() => setInputMode('manual')}
              className="h-20 flex flex-col items-center justify-center gap-2 text-sm"
            >
              <FileText size={24} />
              <span>Manual Entry</span>
            </Button>
          </div>
        </div>

        {/* File Upload (for scan mode) */}
        {inputMode === 'scan' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
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
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 cursor-pointer hover:border-blue-500 transition-colors"
              >
                {processingOCR ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Processing invoice...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Scan size={48} className="text-blue-500" />
                    <div>
                      <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">Scan Your Invoice</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        Take a photo or upload an image
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        We'll automatically extract the details for you
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vendor Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Building2 size={18} />
              Vendor
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Vendor *
                </label>
                <div className="flex gap-2">
                  <select
                    required
                    value={formData.vendorId}
                    onChange={(e) => handleVendorChange(e.target.value)}
                    className="flex-1 px-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Choose a vendor...</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/vendors?create=true')}
                    className="px-3 flex items-center"
                    title="Create New Vendor"
                  >
                    <Plus size={16} />
                  </Button>
                </div>
                {vendors.length === 0 && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                      No vendors available for this outlet.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => navigate('/vendors?create=true')}
                      className="flex items-center gap-1"
                    >
                      <Plus size={14} />
                      Create Your First Vendor
                    </Button>
                  </div>
                )}
              </div>

              {/* Selected Vendor Details */}
              {selectedVendor && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm space-y-1">
                    {selectedVendor.email && (
                      <p><span className="font-medium">Email:</span> {selectedVendor.email}</p>
                    )}
                    {selectedVendor.phone && (
                      <p><span className="font-medium">Phone:</span> {selectedVendor.phone}</p>
                    )}
                    <p><span className="font-medium">Type:</span> {selectedVendor.vendorType.replace('_', ' ')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Amount & Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <DollarSign size={18} />
              Invoice Details
            </h3>
            
            <div className="space-y-4">
              {/* Total Amount - Large and Prominent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Total Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg">$</span>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={formData.totalAmount || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-4 text-2xl font-semibold text-center border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Invoice Number (if from OCR) */}
              {formData.invoiceNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    className="w-full px-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              {/* Date fields in a grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                    className="w-full px-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full px-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this invoice..."
                  className="w-full px-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes for the approver..."
                  className="w-full px-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Optional: Line Items for Manual Mode */}
          {inputMode === 'manual' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText size={18} />
                  Itemized Breakdown
                </h3>
                <Button
                  type="button"
                  size="sm"
                  onClick={addLineItem}
                  className="flex items-center gap-1 text-sm"
                >
                  <Plus size={14} />
                  Add Item
                </Button>
              </div>

              {formData.items.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
                  <FileText size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Optional: Add line items</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Or just use the total amount above</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                      <div className="space-y-3">
                        <input
                          type="text"
                          required
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          placeholder="Item description"
                          className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="number"
                            required
                            min="0.01"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            placeholder="Qty"
                            className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="number"
                            required
                            min="0.01"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            placeholder="Price"
                            className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            Total: {formatCurrency(item.total)}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {formData.totalAmount > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <div className="text-center">
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Invoice Total</p>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                  {formatCurrency(formData.totalAmount)}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Due: {new Date(formData.dueDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons - Fixed at bottom for mobile */}
          <div className="space-y-3">
            <Button
              type="submit"
              disabled={loading || vendors.length === 0}
              className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating Invoice...
                </div>
              ) : (
                'Submit for Approval'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/invoices')}
              disabled={loading}
              className="w-full h-10 text-sm rounded-xl"
            >
              Cancel
            </Button>
          </div>
        </form>
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

export default CreateInvoice;