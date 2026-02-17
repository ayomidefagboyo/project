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
import { useTerminalId } from '../../hooks/useTerminalId';
import { loadHardwareState, resolveReceiptPrinter } from '../../lib/hardwareProfiles';
import { posService } from '../../lib/posService';
import { printReceiptContent, type ReceiptPrintStyle } from '../../lib/receiptPrinter';
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

const LEGACY_RECEIPT_TEMPLATE_CACHE_KEY = 'pos-receipt-template';

const getReceiptTemplateCacheKey = (outletId: string): string => `pos-receipt-template:${outletId}`;

const mergeReceiptTemplate = (base: ReceiptTemplate, overrides?: Partial<ReceiptTemplate>): ReceiptTemplate => {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    header: {
      ...base.header,
      ...(overrides.header || {})
    },
    body: {
      ...base.body,
      ...(overrides.body || {})
    },
    footer: {
      ...base.footer,
      ...(overrides.footer || {})
    },
    styling: {
      ...base.styling,
      ...(overrides.styling || {})
    }
  };
};

const mapBackendFontSizeToUi = (fontSize?: string): ReceiptTemplate['styling']['fontSize'] => {
  if (fontSize === 'small') return 'small';
  if (fontSize === 'large') return 'large';
  return 'medium';
};

const mapUiFontSizeToBackend = (fontSize: ReceiptTemplate['styling']['fontSize']): string => {
  if (fontSize === 'medium') return 'normal';
  return fontSize;
};

const mapBackendWidthToUi = (width?: number): ReceiptTemplate['styling']['paperWidth'] => {
  if (width === 58) return '58mm';
  if (width === 80) return '80mm';
  return 'A4';
};

const parseCachedTemplate = (raw: string): ReceiptTemplate | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<ReceiptTemplate>;
    return mergeReceiptTemplate(defaultTemplate, parsed);
  } catch {
    return null;
  }
};

const readCachedReceiptTemplate = (outletId: string): ReceiptTemplate | null => {
  const scopedKey = getReceiptTemplateCacheKey(outletId);
  const scopedRaw = localStorage.getItem(scopedKey);
  if (scopedRaw) {
    const parsed = parseCachedTemplate(scopedRaw);
    if (parsed) return parsed;
    localStorage.removeItem(scopedKey);
  }

  const legacyRaw = localStorage.getItem(LEGACY_RECEIPT_TEMPLATE_CACHE_KEY);
  if (!legacyRaw) return null;

  const parsedLegacy = parseCachedTemplate(legacyRaw);
  if (!parsedLegacy) {
    localStorage.removeItem(LEGACY_RECEIPT_TEMPLATE_CACHE_KEY);
    return null;
  }

  localStorage.setItem(scopedKey, JSON.stringify(parsedLegacy));
  return parsedLegacy;
};

const writeCachedReceiptTemplate = (outletId: string, template: ReceiptTemplate): void => {
  localStorage.setItem(getReceiptTemplateCacheKey(outletId), JSON.stringify(template));
};

const ReceiptEditor: React.FC = () => {
  const { currentOutlet } = useOutlet();
  const { terminalId } = useTerminalId();
  const [template, setTemplate] = useState<ReceiptTemplate>(defaultTemplate);
  const [activeSection, setActiveSection] = useState<'header' | 'body' | 'footer' | 'styling'>('header');
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [uiMessage, setUiMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Load saved template from backend on mount
  useEffect(() => {
    const loadSettings = async () => {
      const outletId = currentOutlet?.id;
      if (!outletId) return;

      const cachedTemplate = readCachedReceiptTemplate(outletId);
      if (cachedTemplate) {
        setTemplate(cachedTemplate);
      }

      setIsLoading(true);
      try {
        const [receiptSettings, outletInfo] = await Promise.all([
          posService.getReceiptSettings(outletId),
          posService.getOutletInfo(outletId),
        ]);

        setTemplate((prev) => {
          const source = cachedTemplate ? mergeReceiptTemplate(prev, cachedTemplate) : prev;

          let addressText = source.header.address;
          if (outletInfo.address !== undefined && outletInfo.address !== null) {
            if (typeof outletInfo.address === 'string') {
              addressText = outletInfo.address;
            } else if (typeof outletInfo.address === 'object') {
              const addr = outletInfo.address as Record<string, string | undefined>;
              const parts = [
                addr.street,
                addr.city && addr.state
                  ? `${addr.city}, ${addr.state} ${addr.zip || ''}`.trim()
                  : addr.city || addr.state,
                addr.country
              ].filter(Boolean);
              addressText = parts.join('\n') || source.header.address;
            }
          }

          return {
            ...source,
            header: {
              ...source.header,
              businessName: receiptSettings.header_text ?? outletInfo.name ?? source.header.businessName,
              address: addressText,
              // Respect explicit null/empty values from outlet profile; only fallback when truly undefined.
              phone: outletInfo.phone !== undefined ? (outletInfo.phone ?? '') : source.header.phone,
              email: outletInfo.email !== undefined ? (outletInfo.email ?? '') : source.header.email,
              website: outletInfo.website !== undefined ? (outletInfo.website ?? '') : source.header.website,
              logoUrl: receiptSettings.logo_url ?? source.header.logoUrl,
              showQR: receiptSettings.show_qr_code ?? source.header.showQR
            },
            body: {
              ...source.body,
              showTaxBreakdown: receiptSettings.show_tax_breakdown ?? source.body.showTaxBreakdown
            },
            footer: {
              ...source.footer,
              thankYouMessage: receiptSettings.footer_text ?? source.footer.thankYouMessage,
              showCashierName: receiptSettings.show_customer_points ?? source.footer.showCashierName
            },
            styling: {
              ...source.styling,
              fontSize: mapBackendFontSizeToUi(receiptSettings.font_size),
              paperWidth: mapBackendWidthToUi(receiptSettings.receipt_width)
            }
          };
        });
      } catch (error) {
        logger.error('Failed to load receipt settings from backend:', error);
        setUiMessage({
          type: 'info',
          text: cachedTemplate
            ? 'Could not refresh settings from server. Showing saved local settings.'
            : 'Could not load settings from server. Please try again.'
        });
      } finally {
        setIsLoading(false);
      }
    };

    void loadSettings();
  }, [currentOutlet?.id]);

  // Cache template to localStorage whenever it changes (for offline fallback)
  useEffect(() => {
    if (template && currentOutlet?.id) {
      writeCachedReceiptTemplate(currentOutlet.id, template);
    }
  }, [template, currentOutlet?.id]);

  // Save template changes to backend
  const saveTemplate = async () => {
    if (!currentOutlet?.id) {
      setUiMessage({ type: 'error', text: 'Please select an outlet first.' });
      return;
    }
    
    setIsSaving(true);
    setSaveStatus(null);
    setUiMessage(null);
    
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
        font_size: mapUiFontSizeToBackend(template.styling.fontSize)
      });
      
      // Also save outlet business info if changed
      await posService.updateOutletInfo(currentOutlet.id, {
        name: template.header.businessName,
        phone: template.header.phone,
        email: template.header.email ?? '',
        website: template.header.website ?? '',
        address: template.header.address
      });
      
      // Cache in localStorage for offline support
      writeCachedReceiptTemplate(currentOutlet.id, template);
      
      setSaveStatus('success');
      setUiMessage({ type: 'success', text: 'Settings saved successfully.' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      logger.error('Failed to save receipt settings:', error);
      setSaveStatus('error');
      const msg =
        error instanceof Error
          ? error.message
          : 'Failed to save receipt settings. Please try again.';
      setUiMessage({ type: 'error', text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default
  const resetTemplate = async () => {
    if (!currentOutlet?.id) {
      setTemplate(defaultTemplate);
      localStorage.removeItem(LEGACY_RECEIPT_TEMPLATE_CACHE_KEY);
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
        font_size: mapUiFontSizeToBackend(defaultTemplate.styling.fontSize)
      });
      setTemplate(defaultTemplate);
      writeCachedReceiptTemplate(currentOutlet.id, defaultTemplate);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      logger.error('Failed to reset receipt settings:', error);
      // Still reset locally even if backend fails
      setTemplate(defaultTemplate);
      writeCachedReceiptTemplate(currentOutlet.id, defaultTemplate);
    }
  };

  // Update template section
  const updateTemplate = (section: keyof ReceiptTemplate, updates: any) => {
    setTemplate(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates }
    }));
  };

  const buildTestReceiptContent = (): string => {
    const now = new Date();
    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

    const lines: string[] = [];
    lines.push(template.header.businessName || 'Compazz POS');
    if (template.header.address) lines.push(template.header.address);
    if (template.header.phone) lines.push(template.header.phone);
    if (template.header.email) lines.push(template.header.email);
    if (template.header.website) lines.push(template.header.website);
    lines.push('--------------------------------');
    if (template.footer.showDateTime) lines.push(`Date: ${now.toLocaleString('en-NG')}`);
    lines.push('Receipt: TEST-PRINT-001');
    if (template.footer.showCashierName) lines.push('Cashier: Test User');
    lines.push('--------------------------------');
    lines.push('Sample Item x1  1,500.00');
    lines.push('--------------------------------');
    if (template.body.showTaxBreakdown) lines.push(`VAT: ${formatCurrency(112.5)}`);
    lines.push(`Total: ${formatCurrency(1500)}`);
    lines.push('--------------------------------');
    if (template.footer.thankYouMessage) lines.push(template.footer.thankYouMessage);
    if (template.footer.returnPolicy) lines.push(template.footer.returnPolicy);
    if (template.footer.additionalInfo) lines.push(template.footer.additionalInfo);
    return lines.join('\n');
  };

  const handleTestPrint = async () => {
    if (!currentOutlet?.id) {
      setUiMessage({ type: 'error', text: 'Please select an outlet first.' });
      return;
    }

    setIsTestPrinting(true);
    setUiMessage(null);

    try {
      const runtime = loadHardwareState(currentOutlet.id, terminalId || undefined);
      const printer = resolveReceiptPrinter(runtime);
      const printStyle: ReceiptPrintStyle = {
        fontSize: template.styling.fontSize,
        fontFamily: template.styling.fontFamily,
        lineSpacing: template.styling.lineSpacing,
        paperWidth: template.styling.paperWidth,
      };

      const result = await printReceiptContent(buildTestReceiptContent(), {
        title: 'Receipt Template Test',
        copies: 1,
        printerName: printer?.name,
        style: printStyle,
      });

      if (!result.success) {
        setUiMessage({
          type: 'error',
          text: 'Test print failed. Allow pop-ups or configure native printer bridge (Compazz/QZ) in terminal settings.',
        });
        return;
      }

      setUiMessage({
        type: 'success',
        text: printer?.name ? `Test print sent to "${printer.name}".` : 'Test print sent successfully.',
      });
    } catch (error) {
      logger.error('Test print failed:', error);
      setUiMessage({ type: 'error', text: 'Test print failed. Please verify printer setup.' });
    } finally {
      setIsTestPrinting(false);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file later
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUiMessage({ type: 'error', text: 'Please select an image file (PNG, JPG, SVG, etc.).' });
      return;
    }

    // Keep reasonably small to avoid huge DB rows / slow loads
    const maxBytes = 2 * 1024 * 1024; // 2MB
    if (file.size > maxBytes) {
      setUiMessage({ type: 'error', text: 'Logo is too large. Please use an image under 2MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        setUiMessage({ type: 'error', text: 'Failed to read the image. Please try again.' });
        return;
      }
      updateTemplate('header', { showLogo: true, logoUrl: dataUrl });
      setUiMessage({ type: 'success', text: 'Logo added. Click “Save Settings” to persist it.' });
    };
    reader.onerror = () => setUiMessage({ type: 'error', text: 'Failed to read the image. Please try again.' });
    reader.readAsDataURL(file);
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

              {template.header.showLogo && (
                <div className="pl-6 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Logo URL (optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://... or paste image URL"
                      value={template.header.logoUrl || ''}
                      onChange={(e) => updateTemplate('header', { logoUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Tip: You can also upload a small logo below (stored in your receipt settings).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm">
                      <Upload className="w-4 h-4" />
                      Upload logo
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} />
                    </label>

                    {template.header.logoUrl && (
                      <button
                        type="button"
                        onClick={() => updateTemplate('header', { logoUrl: undefined })}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}

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
      // Approx pixel widths for common receipt paper sizes
      // 58mm ~ 220px, 80mm ~ 300px (varies by printer margins)
      '58mm': 'w-56',
      '80mm': 'w-72',
      'A4': 'w-full max-w-2xl'
    }[template.styling.paperWidth];

    return (
      <div
        className={`bg-white px-4 py-3 border border-gray-300 rounded-lg ${widthClass} ${fontSizeClass} ${fontFamilyClass} ${lineSpacingClass} mx-auto shadow-lg overflow-hidden`}
      >
        {/* Header */}
        <div className="text-center border-b border-gray-300 pb-2 mb-2">
          {template.header.showLogo && (
            <div className="mb-2">
              {template.header.logoUrl ? (
                <img
                  src={template.header.logoUrl}
                  alt="Business logo"
                  className="w-16 h-16 object-contain mx-auto rounded bg-white"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-200 rounded mx-auto flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>
          )}

          <div className="font-bold text-lg leading-tight break-words">{template.header.businessName}</div>
          <div className="whitespace-pre-wrap break-words text-gray-700">{template.header.address}</div>
          <div className="break-words">{template.header.phone}</div>
          {template.header.email && <div className="break-words">{template.header.email}</div>}
          {template.header.website && <div className="break-words">{template.header.website}</div>}
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
            <div key={index} className="flex items-start justify-between gap-3 mb-2">
              <div
                className={`min-w-0 flex-1 break-words ${template.body.itemAlignment === 'center' ? 'text-center' : template.body.itemAlignment === 'right' ? 'text-right' : 'text-left'
                  }`}
              >
                <div className="font-medium leading-snug">{item.name}</div>
                {template.body.showItemCodes && <div className="text-gray-500 break-words">{item.code}</div>}
                <div className="text-gray-600 tabular-nums">{item.quantity} x {formatCurrency(item.price)}</div>
              </div>
              <div
                className={`shrink-0 w-24 tabular-nums ${template.body.priceAlignment === 'center' ? 'text-center' : template.body.priceAlignment === 'left' ? 'text-left' : 'text-right'
                  }`}
              >
                {formatCurrency(item.total)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="space-y-1">
          <div className="flex justify-between gap-3">
            <span className="text-gray-700">Subtotal:</span>
            <span className="shrink-0 tabular-nums text-right">{formatCurrency(sampleTransaction.subtotal)}</span>
          </div>
          {template.body.showTaxBreakdown && (
            <div className="flex justify-between gap-3">
              <span className="text-gray-700">VAT (7.5%):</span>
              <span className="shrink-0 tabular-nums text-right">{formatCurrency(sampleTransaction.tax_amount)}</span>
            </div>
          )}
          {template.body.showDiscounts && sampleTransaction.discount_amount > 0 && (
            <div className="flex justify-between gap-3 text-green-600">
              <span>Discount:</span>
              <span className="shrink-0 tabular-nums text-right">-{formatCurrency(sampleTransaction.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between gap-3 font-bold border-t border-gray-300 pt-1">
            <span>Total:</span>
            <span className="shrink-0 tabular-nums text-right">{formatCurrency(sampleTransaction.total_amount)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Tendered:</span>
            <span className="shrink-0 tabular-nums text-right">{formatCurrency(sampleTransaction.tendered_amount)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Change:</span>
            <span className="shrink-0 tabular-nums text-right">{formatCurrency(sampleTransaction.change_amount)}</span>
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
        {uiMessage && (
          <div
            className={`mb-4 rounded-lg border p-3 text-sm ${
              uiMessage.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200'
                : uiMessage.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'
                : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
            }`}
          >
            {uiMessage.text}
          </div>
        )}

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
          <button
            onClick={resetTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          {!currentOutlet?.id && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Please select an outlet to save settings
            </span>
          )}
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
            <button
              onClick={handleTestPrint}
              disabled={isTestPrinting}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <Printer className="w-4 h-4" />
              {isTestPrinting ? 'Printing...' : 'Test Print'}
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
