/**
 * Receipt Editor/Customizer Component
 * Nigerian Supermarket Focus
 */

import React, { useState, useEffect } from 'react';
import {
  Eye,
  Download,
  Upload,
  RotateCcw,
  Image as ImageIcon,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Save,
  Printer,
  FileText,
  Palette,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useOutlet } from '../../contexts/OutletContext';
import { posService } from '../../lib/posService';
import logger from '../../lib/logger';

export interface ReceiptTemplate {
  id: string;
  name: string;
  header: {
    showLogo: boolean;
    logoUrl?: string;
    businessName: string;
    address: string;
    phone: string;
    email?: string;
    website?: string;
    showQR: boolean;
  };
  body: {
    showItemCodes: boolean;
    showTaxBreakdown: boolean;
    showDiscounts: boolean;
    showRunningTotal: boolean;
    itemAlignment: 'left' | 'center' | 'right';
    priceAlignment: 'left' | 'center' | 'right';
  };
  footer: {
    thankYouMessage: string;
    returnPolicy?: string;
    additionalInfo?: string;
    showCashierName: boolean;
    showTransactionNumber: boolean;
    showDateTime: boolean;
  };
  styling: {
    fontSize: 'small' | 'medium' | 'large';
    fontFamily: 'monospace' | 'serif' | 'sans-serif';
    lineSpacing: 'compact' | 'normal' | 'loose';
    paperWidth: '58mm' | '80mm' | 'A4';
  };
}

const defaultTemplate: ReceiptTemplate = {
  id: 'default',
  name: 'Default Receipt',
  header: {
    showLogo: true,
    businessName: 'Sample Supermarket',
    address: 'Plot 123, Main Street\nIkeja, Lagos State',
    phone: '+234 800 123 4567',
    email: 'info@samplemart.ng',
    website: 'www.samplemart.ng',
    showQR: true
  },
  body: {
    showItemCodes: true,
    showTaxBreakdown: true,
    showDiscounts: true,
    showRunningTotal: false,
    itemAlignment: 'left',
    priceAlignment: 'right'
  },
  footer: {
    thankYouMessage: 'Thank you for shopping with us!',
    returnPolicy: 'Returns accepted within 7 days with receipt',
    additionalInfo: 'Follow us @SampleMart',
    showCashierName: true,
    showTransactionNumber: true,
    showDateTime: true
  },
  styling: {
    fontSize: 'medium',
    fontFamily: 'monospace',
    lineSpacing: 'normal',
    paperWidth: '80mm'
  }
};

const sampleTransaction = {
  transaction_number: 'TXN-2024-001234',
  transaction_date: new Date().toISOString(),
  cashier_name: 'Jane Doe',
  customer_name: 'John Smith',
  items: [
    { name: 'Coca-Cola 35cl', code: 'COKE35', quantity: 2, price: 250, total: 500 },
    { name: 'Indomie Noodles', code: 'INDO01', quantity: 5, price: 120, total: 600 },
    { name: 'Peak Milk 400g', code: 'PEAK400', quantity: 1, price: 850, total: 850 },
  ],
  subtotal: 1950,
  tax_amount: 146.25,
  discount_amount: 50,
  total_amount: 2046.25,
  payment_method: 'cash',
  tendered_amount: 2100,
  change_amount: 53.75
};

const ReceiptEditor: React.FC = () => {
  const { currentOutlet } = useOutlet();
  const [template, setTemplate] = useState<ReceiptTemplate>(defaultTemplate);
  const [activeSection, setActiveSection] = useState<'header' | 'body' | 'footer' | 'styling'>('header');
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);

  // Load saved template from backend on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!currentOutlet?.id) return;
      
      setIsLoading(true);
      try {
        // Load receipt settings from backend
        const receiptSettings = await posService.getReceiptSettings(currentOutlet.id);
        
        // Load outlet business info for header
        const outletInfo = await posService.getOutletInfo(currentOutlet.id);
        
        // Merge backend settings with template
        setTemplate(prev => {
          // Parse address - handle both string and object formats
          let addressText = prev.header.address;
          if (outletInfo.address) {
            if (typeof outletInfo.address === 'string') {
              addressText = outletInfo.address;
            } else if (typeof outletInfo.address === 'object') {
              const addr = outletInfo.address as any;
              const parts = [
                addr.street,
                addr.city && addr.state ? `${addr.city}, ${addr.state} ${addr.zip || ''}`.trim() : addr.city || addr.state,
                addr.country
              ].filter(Boolean);
              addressText = parts.join('\n') || prev.header.address;
            }
          }
          
          return {
            ...prev,
            header: {
              ...prev.header,
              businessName: outletInfo.name || prev.header.businessName,
              address: addressText,
              phone: outletInfo.phone || prev.header.phone,
              email: outletInfo.email || prev.header.email,
              website: outletInfo.website || prev.header.website,
              logoUrl: receiptSettings.logo_url,
              showQR: receiptSettings.show_qr_code ?? prev.header.showQR
            },
          body: {
            ...prev.body,
            showTaxBreakdown: receiptSettings.show_tax_breakdown ?? prev.body.showTaxBreakdown
          },
          footer: {
            ...prev.footer,
            thankYouMessage: receiptSettings.footer_text || prev.footer.thankYouMessage
          },
          styling: {
            ...prev.styling,
            fontSize: (receiptSettings.font_size || 'medium') as 'small' | 'medium' | 'large',
            paperWidth: receiptSettings.receipt_width === 58 ? '58mm' : receiptSettings.receipt_width === 80 ? '80mm' : 'A4' as '58mm' | '80mm' | 'A4'
          }
          };
        });
        
        // Note: localStorage caching happens after state update via useEffect on template change
      } catch (error) {
        logger.error('Failed to load receipt settings from backend:', error);
        // Fallback to localStorage if backend fails
        const saved = localStorage.getItem('pos-receipt-template');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setTemplate(parsed);
          } catch (e) {
            console.warn('Failed to load saved receipt template from localStorage');
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, [currentOutlet?.id]);

  // Cache template to localStorage whenever it changes (for offline fallback)
  useEffect(() => {
    if (template && currentOutlet?.id) {
      localStorage.setItem('pos-receipt-template', JSON.stringify(template));
    }
  }, [template, currentOutlet?.id]);

  // Save template changes to backend
  const saveTemplate = async () => {
    if (!currentOutlet?.id) {
      alert('Please select an outlet first');
      return;
    }
    
    setIsSaving(true);
    setSaveStatus(null);
    
    try {
      // Save receipt settings to backend
      await posService.updateReceiptSettings(currentOutlet.id, {
        header_text: template.header.businessName,
        footer_text: template.footer.thankYouMessage,
        logo_url: template.header.logoUrl,
        show_qr_code: template.header.showQR,
        show_customer_points: template.footer.showCashierName, // Map appropriately
        show_tax_breakdown: template.body.showTaxBreakdown,
        receipt_width: template.styling.paperWidth === '58mm' ? 58 : template.styling.paperWidth === '80mm' ? 80 : 80,
        font_size: template.styling.fontSize
      });
      
      // Also save outlet business info if changed
      const addressParts = template.header.address.split('\n');
      await posService.updateOutletInfo(currentOutlet.id, {
        name: template.header.businessName,
        phone: template.header.phone,
        email: template.header.email || undefined,
        website: template.header.website || undefined,
        address: template.header.address
      });
      
      // Cache in localStorage for offline support
      localStorage.setItem('pos-receipt-template', JSON.stringify(template));
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      logger.error('Failed to save receipt settings:', error);
      setSaveStatus('error');
      alert('Failed to save receipt settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default
  const resetTemplate = async () => {
    if (!currentOutlet?.id) {
      setTemplate(defaultTemplate);
      localStorage.removeItem('pos-receipt-template');
      return;
    }
    
    // Reset backend settings to defaults
    try {
      await posService.updateReceiptSettings(currentOutlet.id, {
        header_text: defaultTemplate.header.businessName,
        footer_text: defaultTemplate.footer.thankYouMessage,
        show_qr_code: defaultTemplate.header.showQR,
        show_customer_points: defaultTemplate.footer.showCashierName,
        show_tax_breakdown: defaultTemplate.body.showTaxBreakdown,
        receipt_width: 80,
        font_size: 'medium'
      });
      setTemplate(defaultTemplate);
      localStorage.removeItem('pos-receipt-template');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      logger.error('Failed to reset receipt settings:', error);
      // Still reset locally even if backend fails
      setTemplate(defaultTemplate);
      localStorage.removeItem('pos-receipt-template');
    }
  };

  // Update template section
  const updateTemplate = (section: keyof ReceiptTemplate, updates: any) => {
    setTemplate(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates }
    }));
  };

  const renderEditor = () => {
    switch (activeSection) {
      case 'header':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Header Configuration</h3>

            {/* Business Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Business Name
              </label>
              <input
                type="text"
                value={template.header.businessName}
                onChange={(e) => updateTemplate('header', { businessName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Address
              </label>
              <textarea
                value={template.header.address}
                onChange={(e) => updateTemplate('header', { address: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={template.header.phone}
                  onChange={(e) => updateTemplate('header', { phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={template.header.email || ''}
                  onChange={(e) => updateTemplate('header', { email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={template.header.showLogo}
                  onChange={(e) => updateTemplate('header', { showLogo: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show business logo</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={template.header.showQR}
                  onChange={(e) => updateTemplate('header', { showQR: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show QR code for digital receipt</span>
              </label>
            </div>
          </div>
        );

      case 'body':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Receipt Body Configuration</h3>

            {/* Content Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={template.body.showItemCodes}
                  onChange={(e) => updateTemplate('body', { showItemCodes: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show item codes/SKUs</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={template.body.showTaxBreakdown}
                  onChange={(e) => updateTemplate('body', { showTaxBreakdown: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show tax breakdown (VAT)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={template.body.showDiscounts}
                  onChange={(e) => updateTemplate('body', { showDiscounts: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show discounts applied</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={template.body.showRunningTotal}
                  onChange={(e) => updateTemplate('body', { showRunningTotal: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show running total</span>
              </label>
            </div>

            {/* Alignment */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Item Name Alignment
                </label>
                <select
                  value={template.body.itemAlignment}
                  onChange={(e) => updateTemplate('body', { itemAlignment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Price Alignment
                </label>
                <select
                  value={template.body.priceAlignment}
                  onChange={(e) => updateTemplate('body', { priceAlignment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'footer':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Footer Configuration</h3>

            {/* Thank You Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Thank You Message
              </label>
              <input
                type="text"
                value={template.footer.thankYouMessage}
                onChange={(e) => updateTemplate('footer', { thankYouMessage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Return Policy */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Return Policy (Optional)
              </label>
              <textarea
                value={template.footer.returnPolicy || ''}
                onChange={(e) => updateTemplate('footer', { returnPolicy: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Additional Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Information (Optional)
              </label>
              <textarea
                value={template.footer.additionalInfo || ''}
                onChange={(e) => updateTemplate('footer', { additionalInfo: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Social media, promotions, etc."
              />
            </div>

            {/* Footer Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={template.footer.showCashierName}
                  onChange={(e) => updateTemplate('footer', { showCashierName: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show cashier name</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={template.footer.showTransactionNumber}
                  onChange={(e) => updateTemplate('footer', { showTransactionNumber: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show transaction number</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={template.footer.showDateTime}
                  onChange={(e) => updateTemplate('footer', { showDateTime: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show date and time</span>
              </label>
            </div>
          </div>
        );

      case 'styling':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Styling & Format</h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Font Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Font Size
                </label>
                <select
                  value={template.styling.fontSize}
                  onChange={(e) => updateTemplate('styling', { fontSize: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              {/* Font Family */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Font Family
                </label>
                <select
                  value={template.styling.fontFamily}
                  onChange={(e) => updateTemplate('styling', { fontFamily: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="monospace">Monospace (Fixed-width)</option>
                  <option value="sans-serif">Sans-serif (Clean)</option>
                  <option value="serif">Serif (Traditional)</option>
                </select>
              </div>

              {/* Line Spacing */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Line Spacing
                </label>
                <select
                  value={template.styling.lineSpacing}
                  onChange={(e) => updateTemplate('styling', { lineSpacing: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="compact">Compact</option>
                  <option value="normal">Normal</option>
                  <option value="loose">Loose</option>
                </select>
              </div>

              {/* Paper Width */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Paper Width
                </label>
                <select
                  value={template.styling.paperWidth}
                  onChange={(e) => updateTemplate('styling', { paperWidth: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="58mm">58mm (Small)</option>
                  <option value="80mm">80mm (Standard)</option>
                  <option value="A4">A4 (Full page)</option>
                </select>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderPreview = () => {
    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

    const formatDate = (date: string) =>
      new Date(date).toLocaleString('en-NG');

    const fontSizeClass = {
      small: 'text-xs',
      medium: 'text-sm',
      large: 'text-base'
    }[template.styling.fontSize];

    const fontFamilyClass = {
      monospace: 'font-mono',
      serif: 'font-serif',
      'sans-serif': 'font-sans'
    }[template.styling.fontFamily];

    const lineSpacingClass = {
      compact: 'leading-tight',
      normal: 'leading-normal',
      loose: 'leading-relaxed'
    }[template.styling.lineSpacing];

    const widthClass = {
      '58mm': 'w-48',
      '80mm': 'w-64',
      'A4': 'w-full max-w-2xl'
    }[template.styling.paperWidth];

    return (
      <div className={`bg-white p-4 border border-gray-300 rounded-lg ${widthClass} ${fontSizeClass} ${fontFamilyClass} ${lineSpacingClass} mx-auto shadow-lg`}>
        {/* Header */}
        <div className="text-center border-b border-gray-300 pb-2 mb-2">
          {template.header.showLogo && (
            <div className="mb-2">
              <div className="w-16 h-16 bg-gray-200 rounded mx-auto flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-gray-400" />
              </div>
            </div>
          )}

          <div className="font-bold text-lg">{template.header.businessName}</div>
          <div className="whitespace-pre-line">{template.header.address}</div>
          <div>{template.header.phone}</div>
          {template.header.email && <div>{template.header.email}</div>}
          {template.header.website && <div>{template.header.website}</div>}
        </div>

        {/* Transaction Info */}
        <div className="mb-2">
          {template.footer.showDateTime && <div>Date: {formatDate(sampleTransaction.transaction_date)}</div>}
          {template.footer.showTransactionNumber && <div>Receipt: {sampleTransaction.transaction_number}</div>}
          {template.footer.showCashierName && <div>Cashier: {sampleTransaction.cashier_name}</div>}
          {sampleTransaction.customer_name && <div>Customer: {sampleTransaction.customer_name}</div>}
        </div>

        {/* Items */}
        <div className="border-y border-gray-300 py-2 my-2">
          {sampleTransaction.items.map((item, index) => (
            <div key={index} className="flex justify-between mb-1">
              <div className={`flex-1 ${template.body.itemAlignment === 'center' ? 'text-center' : template.body.itemAlignment === 'right' ? 'text-right' : 'text-left'}`}>
                <div>{item.name}</div>
                {template.body.showItemCodes && <div className="text-gray-500">{item.code}</div>}
                <div className="text-gray-600">{item.quantity} x {formatCurrency(item.price)}</div>
              </div>
              <div className={`${template.body.priceAlignment === 'center' ? 'text-center' : template.body.priceAlignment === 'left' ? 'text-left' : 'text-right'}`}>
                {formatCurrency(item.total)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(sampleTransaction.subtotal)}</span>
          </div>
          {template.body.showTaxBreakdown && (
            <div className="flex justify-between">
              <span>VAT (7.5%):</span>
              <span>{formatCurrency(sampleTransaction.tax_amount)}</span>
            </div>
          )}
          {template.body.showDiscounts && sampleTransaction.discount_amount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount:</span>
              <span>-{formatCurrency(sampleTransaction.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t border-gray-300 pt-1">
            <span>Total:</span>
            <span>{formatCurrency(sampleTransaction.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tendered:</span>
            <span>{formatCurrency(sampleTransaction.tendered_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Change:</span>
            <span>{formatCurrency(sampleTransaction.change_amount)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center border-t border-gray-300 pt-2 mt-2 space-y-1">
          <div className="font-semibold">{template.footer.thankYouMessage}</div>
          {template.footer.returnPolicy && <div className="text-gray-600">{template.footer.returnPolicy}</div>}
          {template.footer.additionalInfo && <div className="text-gray-600">{template.footer.additionalInfo}</div>}

          {template.header.showQR && (
            <div className="mt-2">
              <div className="w-16 h-16 bg-gray-200 rounded mx-auto flex items-center justify-center">
                <div className="text-xs text-gray-500">QR</div>
              </div>
              <div className="text-xs text-gray-500">Scan for digital receipt</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading receipt settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Editor Panel */}
      <div className={`${previewMode === 'edit' ? 'flex-1' : 'w-80'} bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 overflow-y-auto`}>
        {/* Section Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: 'header', label: 'Header', icon: FileText },
            { key: 'body', label: 'Body', icon: Type },
            { key: 'footer', label: 'Footer', icon: AlignCenter },
            { key: 'styling', label: 'Style', icon: Palette }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                activeSection === key
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Editor Content */}
        {renderEditor()}

        {/* Action Buttons */}
        <div className="flex gap-3 items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={saveTemplate}
            disabled={isSaving || !currentOutlet?.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isSaving
                ? 'bg-gray-400 cursor-not-allowed'
                : saveStatus === 'success'
                ? 'bg-green-600 hover:bg-green-700'
                : saveStatus === 'error'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white`}
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : saveStatus === 'success' ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Saved!</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <AlertCircle className="w-4 h-4" />
                <span>Error</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Settings</span>
              </>
            )}
          </button>
          {!currentOutlet?.id && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Please select an outlet to save settings
            </span>
          )}
        </div>
          <button
            onClick={resetTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Preview Panel */}
      <div className={`${previewMode === 'preview' ? 'flex-1' : 'w-96'} bg-gray-100 dark:bg-gray-800 rounded-xl p-6 overflow-y-auto`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Preview</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setPreviewMode(previewMode === 'edit' ? 'preview' : 'edit')}
              className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              <Eye className="w-4 h-4" />
              {previewMode === 'edit' ? 'Full Preview' : 'Split View'}
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
              <Printer className="w-4 h-4" />
              Test Print
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          {renderPreview()}
        </div>
      </div>
    </div>
  );
};

export default ReceiptEditor;