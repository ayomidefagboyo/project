/**
 * Import Products Modal
 * Supports QuickBooks, Square, Shopify, CSV, Excel
 */

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  Download,
  ChevronDown,
  Info,
} from 'lucide-react';
import {
  parseImportFile,
  downloadTemplate,
  type ImportProduct,
  type ImportResult,
  type ImportSource,
} from '../../lib/inventoryImportExport';
import { posService } from '../../lib/posService';
import { useOutlet } from '../../contexts/OutletContext';

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

const ImportProductsModal: React.FC<ImportProductsModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const { currentOutlet } = useOutlet();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [source, setSource] = useState<ImportSource>('auto');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep('upload');
    setResult(null);
    setSelectedProducts(new Set());
    setImporting(false);
    setImportProgress({ done: 0, total: 0, errors: 0 });
    setError(null);
    setSource('auto');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ─── File handling ───
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/csv',
    ];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setError('Please upload a CSV or Excel (.xlsx) file');
      return;
    }

    setError(null);
    try {
      const parsed = await parseImportFile(file, source);
      setResult(parsed);

      // Pre-select all valid products
      const validIndices = new Set<number>();
      parsed.products.forEach((p, i) => {
        if (!p._errors?.length) validIndices.add(i);
      });
      setSelectedProducts(validIndices);
      setStep('preview');
    } catch (err: any) {
      setError(`Failed to parse file: ${err.message}`);
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Import ───
  const handleImport = async () => {
    if (!result || !currentOutlet?.id) return;

    const toImport = result.products.filter((_, i) => selectedProducts.has(i));
    if (toImport.length === 0) return;

    setStep('importing');
    setImporting(true);
    setImportProgress({ done: 0, total: toImport.length, errors: 0 });

    let errors = 0;

    for (let i = 0; i < toImport.length; i++) {
      const p = toImport[i];
      try {
        await posService.createProduct({
          outlet_id: currentOutlet.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          description: p.description,
          category: p.category || 'Other',
          unit_price: p.unit_price,
          cost_price: p.cost_price,
          quantity_on_hand: p.quantity_on_hand,
          reorder_level: p.reorder_level,
          reorder_quantity: p.reorder_quantity,
          tax_rate: p.tax_rate,
        });
      } catch (err) {
        errors++;
        console.error(`Failed to import "${p.name}":`, err);
      }
      setImportProgress({ done: i + 1, total: toImport.length, errors });
    }

    setImporting(false);
    setStep('done');
  };

  const handleDone = () => {
    handleClose();
    onImportComplete();
  };

  if (!isOpen) return null;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);

  // Toggle selection
  const toggleProduct = (index: number) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };
  const toggleAll = () => {
    if (!result) return;
    if (selectedProducts.size === result.products.filter(p => !p._errors?.length).length) {
      setSelectedProducts(new Set());
    } else {
      const all = new Set<number>();
      result.products.forEach((p, i) => { if (!p._errors?.length) all.add(i); });
      setSelectedProducts(all);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col mx-4">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Import Products</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 'upload' && 'Upload a CSV or Excel file'}
              {step === 'preview' && `${result?.totalRows} rows found · ${result?.source} format detected`}
              {step === 'importing' && `Importing ${importProgress.done} of ${importProgress.total}...`}
              {step === 'done' && 'Import complete!'}
            </p>
          </div>
          <button onClick={handleClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* ─── Step: Upload ─── */}
        {step === 'upload' && (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Source selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Import From</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {([
                  { value: 'auto', label: 'Auto Detect' },
                  { value: 'quickbooks', label: 'QuickBooks' },
                  { value: 'square', label: 'Square' },
                  { value: 'shopify', label: 'Shopify' },
                  { value: 'generic', label: 'Other POS' },
                  { value: 'compazz', label: 'Compazz' },
                ] as { value: ImportSource; label: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSource(opt.value)}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                      source === opt.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-500', 'bg-blue-50'); }}
              onDragLeave={e => { e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50'); }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                const file = e.dataTransfer.files[0];
                if (file) {
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  if (fileInputRef.current) {
                    fileInputRef.current.files = dt.files;
                    fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }
              }}
            >
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-base font-semibold text-gray-700">
                Drop your file here, or <span className="text-blue-600">browse</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">Supports CSV, Excel (.xlsx)</p>
              <p className="text-xs text-gray-400 mt-1">
                Works with QuickBooks, Square, Shopify, or any POS export
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Supported formats info */}
            <div className="mt-6 bg-gray-50 rounded-xl p-4">
              <div className="flex items-start gap-2 mb-3">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium text-gray-700">Supported Formats</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                <div><span className="font-semibold">QuickBooks POS:</span> Item List export (CSV/Excel)</div>
                <div><span className="font-semibold">Square POS:</span> Item Library export (CSV)</div>
                <div><span className="font-semibold">Shopify:</span> Products export (CSV)</div>
                <div><span className="font-semibold">Generic:</span> Any CSV/Excel with product data</div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => downloadTemplate('xlsx')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Template (.xlsx)
                </button>
                <button
                  onClick={() => downloadTemplate('csv')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Template (.csv)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step: Preview ─── */}
        {step === 'preview' && result && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Stats */}
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-4 text-sm flex-wrap">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="font-medium">{result.validCount} valid</span>
              </span>
              {result.errorCount > 0 && (
                <span className="flex items-center gap-1.5 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">{result.errorCount} errors</span>
                </span>
              )}
              {result.warningCount > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">{result.warningCount} warnings</span>
                </span>
              )}
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">
                Detected: <span className="font-semibold capitalize">{result.source}</span> format
              </span>
              {result.unmappedColumns.length > 0 && (
                <span className="text-gray-400 text-xs" title={result.unmappedColumns.join(', ')}>
                  {result.unmappedColumns.length} column(s) skipped
                </span>
              )}
            </div>

            {/* Select all */}
            <div className="px-6 py-2 border-b border-gray-50 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={selectedProducts.size === result.products.filter(p => !p._errors?.length).length && selectedProducts.size > 0}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="font-medium text-gray-700">
                  Select All ({selectedProducts.size} of {result.validCount})
                </span>
              </label>
            </div>

            {/* Product table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2 w-10"></th>
                    <th className="px-4 py-2">Row</th>
                    <th className="px-4 py-2">Product Name</th>
                    <th className="px-4 py-2">SKU</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2 text-right">Cost</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Stock</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.products.map((p, i) => {
                    const hasErrors = !!p._errors?.length;
                    const hasWarnings = !!p._warnings?.length;
                    return (
                      <tr
                        key={i}
                        className={`${hasErrors ? 'bg-red-50/50' : hasWarnings ? 'bg-amber-50/30' : 'hover:bg-gray-50'} transition-colors`}
                      >
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(i)}
                            onChange={() => toggleProduct(i)}
                            disabled={hasErrors}
                            className="rounded border-gray-300 text-blue-600 disabled:opacity-40"
                          />
                        </td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{p._row}</td>
                        <td className="px-4 py-2 font-medium text-gray-900 max-w-[200px] truncate">{p.name}</td>
                        <td className="px-4 py-2 text-gray-600 font-mono text-xs">{p.sku}</td>
                        <td className="px-4 py-2 text-gray-600">{p.category}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(p.cost_price)}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(p.unit_price)}</td>
                        <td className="px-4 py-2 text-right">{p.quantity_on_hand}</td>
                        <td className="px-4 py-2">
                          {hasErrors && (
                            <span className="text-xs text-red-600" title={p._errors?.join('; ')}>{p._errors?.[0]}</span>
                          )}
                          {!hasErrors && hasWarnings && (
                            <span className="text-xs text-amber-600" title={p._warnings?.join('; ')}>{p._warnings?.[0]}</span>
                          )}
                          {!hasErrors && !hasWarnings && (
                            <span className="text-xs text-green-600">Ready</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Step: Importing ─── */}
        {step === 'importing' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-lg font-semibold text-gray-900">
              Importing Products...
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {importProgress.done} of {importProgress.total} products
            </p>
            <div className="w-64 bg-gray-200 rounded-full h-2 mt-4">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${importProgress.total > 0 ? (importProgress.done / importProgress.total) * 100 : 0}%` }}
              />
            </div>
            {importProgress.errors > 0 && (
              <p className="text-xs text-red-600 mt-2">{importProgress.errors} failed</p>
            )}
          </div>
        )}

        {/* ─── Step: Done ─── */}
        {step === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-lg font-bold text-gray-900">Import Complete!</p>
            <p className="text-sm text-gray-600 mt-1">
              {importProgress.done - importProgress.errors} of {importProgress.total} products imported successfully
            </p>
            {importProgress.errors > 0 && (
              <p className="text-sm text-red-600 mt-1">{importProgress.errors} products failed to import</p>
            )}
          </div>
        )}

        {/* ─── Footer ─── */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div>
            {step === 'preview' && (
              <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                ← Back to upload
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {step === 'done' ? 'Close' : 'Cancel'}
            </button>
            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={selectedProducts.size === 0}
                className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Import {selectedProducts.size} Product{selectedProducts.size !== 1 ? 's' : ''}
              </button>
            )}
            {step === 'done' && (
              <button
                onClick={handleDone}
                className="px-6 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportProductsModal;
