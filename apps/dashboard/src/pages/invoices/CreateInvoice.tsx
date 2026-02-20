import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Upload, FileText, Building2, Calendar, DollarSign, Camera, Scan, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { vendorInvoiceService } from '@/lib/vendorInvoiceService';
import { ocrService } from '@/lib/services';
import { apiClient } from '@/lib/apiClient';
import { Vendor, VendorInvoiceItem } from '@/types';
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
        setError(null);
        const { data, error } = await vendorInvoiceService.getAvailableVendors(currentOutlet.id);
        
        if (error) {
          if (!error.includes('No vendors found') && 
              !error.includes('not found') && 
              !error.includes('column "scope"') &&
              !error.includes('Failed to get vendors for outlet')) {
            setError(error);
          } else {
            setVendors([]);
          }
        } else if (data) {
          setVendors(data);
        } else {
          setVendors([]);
        }
      } catch (err) {
        console.error('Error loading vendors:', err);
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
      showToast('Processing invoice image...', 'info');

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
    
    if (inputMode === 'manual' && formData.items.length > 0) {
      const hasInvalidItems = formData.items.some(item => 
        !item.description.trim() || item.quantity <= 0 || item.unitPrice <= 0
      );
      
      if (hasInvalidItems) {
        showToast('Please fill in all line item details with valid values', 'error');
        return false;
      }
    }
    
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

      const lineItems =
        formData.items.length > 0
          ? formData.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              category: item.category
            }))
          : [
              {
                description: formData.description || 'Invoice total',
                quantity: 1,
                unit_price: formData.totalAmount,
                category: 'outlet_operational'
              }
            ];

      const notes = [formData.description.trim(), formData.notes.trim()]
        .filter(Boolean)
        .join('\n');

      const response = await apiClient.post<any>('/invoices/', {
        outlet_id: currentOutlet.id,
        vendor_id: formData.vendorId,
        invoice_type: 'vendor',
        invoice_number: formData.invoiceNumber?.trim() || undefined,
        issue_date: formData.invoiceDate,
        due_date: formData.dueDate,
        notes: notes || undefined,
        tax_rate: 0,
        items: lineItems,
        attachments: formData.attachments
      });

      if (response.error || !response.data) {
        showToast(`Failed to create invoice: ${response.error || 'Unknown error'}`, 'error');
      } else {
        showToast('Vendor invoice created successfully.', 'success');
        setTimeout(() => {
          navigate('/dashboard/invoices');
        }, 1200);
      }
    } catch (err) {
      console.error('Error creating invoice:', err);
      showToast('Failed to create invoice. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loadingVendors) {
    return (
      <div className="container-width section-padding">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading vendors...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-width">
        {/* Header */}
        <div className="flex items-center justify-between py-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard/invoices')}
              className="btn-secondary p-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg flex items-center justify-center">
                <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create Invoice</h1>
                <p className="text-muted-foreground text-sm">Scan or manually enter vendor bill details</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

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
                }`}>Scan Invoice</h3>
                <p className="text-xs text-muted-foreground mt-1">Upload image for auto-extraction</p>
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
                      <p className="font-medium text-foreground">Processing Invoice</p>
                      <p className="text-sm text-muted-foreground mt-1">Extracting details from your image...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl flex items-center justify-center">
                      <Scan className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">Upload Invoice Image</h3>
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
          {/* Vendor Selection */}
          <div className="card p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Vendor Information</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Select Vendor *
                </label>
                <div className="flex space-x-3">
                  <select
                    required
                    value={formData.vendorId}
                    onChange={(e) => handleVendorChange(e.target.value)}
                    className="flex-1 px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  >
                    <option value="">Choose a vendor...</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/vendors?create=true')}
                    className="btn-secondary px-4 py-3"
                    title="Create New Vendor"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                {vendors.length === 0 && (
                  <div className="mt-4 p-4 bg-muted/50 border border-border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-3">
                      No vendors available for this outlet.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard/vendors?create=true')}
                      className="btn-primary text-sm px-4 py-2"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Vendor
                    </button>
                  </div>
                )}
              </div>

              {/* Selected Vendor Details */}
              {selectedVendor && (
                <div className="p-4 bg-muted/30 border border-border rounded-lg">
                  <div className="space-y-2">
                    {selectedVendor.email && (
                      <div className="flex items-center text-sm">
                        <span className="font-medium text-foreground w-16">Email:</span>
                        <span className="text-muted-foreground">{selectedVendor.email}</span>
                      </div>
                    )}
                    {selectedVendor.phone && (
                      <div className="flex items-center text-sm">
                        <span className="font-medium text-foreground w-16">Phone:</span>
                        <span className="text-muted-foreground">{selectedVendor.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-foreground w-16">Type:</span>
                      <span className="text-muted-foreground capitalize">{selectedVendor.vendorType.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Details */}
          <div className="card p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Invoice Details</h2>
            </div>
            
            <div className="space-y-6">
              {/* Total Amount - Prominent */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Total Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground text-lg">$</span>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={formData.totalAmount || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="w-full pl-12 pr-4 py-4 text-2xl font-semibold text-center bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  />
                </div>
              </div>

              {/* Invoice Number (if from OCR) */}
              {formData.invoiceNumber && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  />
                </div>
              )}

              {/* Date fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
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
                  placeholder="Brief description of this invoice..."
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
                  placeholder="Additional notes for the approver..."
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors resize-none"
                />
              </div>
            </div>
          </div>

          {/* Line Items for Manual Mode */}
          {inputMode === 'manual' && (
            <div className="card p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">Itemized Breakdown</h2>
                </div>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </button>
              </div>

              {formData.items.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-lg">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">Optional: Add line items for detailed breakdown</p>
                  <p className="text-sm text-muted-foreground">Or just use the total amount above</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <div key={index} className="p-4 border border-border rounded-lg bg-muted/20">
                      <div className="space-y-4">
                        <input
                          type="text"
                          required
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          placeholder="Item description"
                          className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring"
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <input
                            type="number"
                            required
                            min="0.01"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            placeholder="Quantity"
                            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring"
                          />
                          <input
                            type="number"
                            required
                            min="0.01"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            placeholder="Unit Price"
                            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-lg font-semibold text-foreground">
                            Total: {formatCurrency(item.total)}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLineItem(index)}
                            className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
            <div className="card p-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground mb-2">Invoice Total</p>
                <p className="text-4xl font-bold text-foreground mb-2">
                  {formatCurrency(formData.totalAmount)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Due: {new Date(formData.dueDate).toLocaleDateString()}
                </p>
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
                onClick={() => navigate('/dashboard/invoices')}
                disabled={loading}
                className="btn-secondary flex-1 py-4"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || vendors.length === 0}
                className="btn-primary flex-1 py-4 font-semibold"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </div>
                ) : (
                  'Submit for Approval'
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

export default CreateInvoice;
