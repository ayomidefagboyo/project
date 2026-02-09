/**
 * Receive Items Page
 * Enter vendor invoice → items auto-add to inventory/products
 * Flow: Select vendor → Add items → Review → Receive into inventory
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck, Plus, Trash2, Search, Check, Package, AlertCircle,
  ChevronDown, FileText, ArrowRight, X, Edit2
} from 'lucide-react';
import { useOutlet } from '../contexts/OutletContext';
import { invoiceService, type InvoiceItem, type Invoice, type ReceiveGoodsResponse } from '../lib/invoiceService';
import { vendorService } from '../lib/vendorService';
import { posService, type POSProduct } from '../lib/posService';

interface Vendor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

type Step = 'entry' | 'review' | 'receiving' | 'done';

const ReceiveItemsPage: React.FC = () => {
  const { currentOutlet } = useOutlet();

  // Step state
  const [step, setStep] = useState<Step>('entry');

  // Vendor & invoice info
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Items
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Product search for linking
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [searchingProduct, setSearchingProduct] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<POSProduct[]>([]);

  // Processing state
  const [isCreating, setIsCreating] = useState(false);
  const [receiveResult, setReceiveResult] = useState<ReceiveGoodsResponse | null>(null);
  const [error, setError] = useState('');

  // Invoice history
  const [invoiceHistory, setInvoiceHistory] = useState<Invoice[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load vendors and products
  useEffect(() => {
    if (!currentOutlet?.id) return;

    const load = async () => {
      try {
        const [vendorRes, productRes] = await Promise.all([
          vendorService.getVendors(currentOutlet.id),
          posService.getProducts(currentOutlet.id, { size: 500 }),
        ]);
        if (vendorRes.data) setVendors(vendorRes.data);
        if (productRes?.items) setProducts(productRes.items);
      } catch (e) {
        console.error('Load error:', e);
      }
    };
    load();
  }, [currentOutlet?.id]);

  // Load invoice history
  const loadHistory = useCallback(async () => {
    if (!currentOutlet?.id) return;
    const res = await invoiceService.getInvoices(currentOutlet.id, { invoiceType: 'vendor', size: 20 });
    setInvoiceHistory(res.items || []);
  }, [currentOutlet?.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Filter products for search dropdown
  useEffect(() => {
    if (!productSearch.trim()) {
      setFilteredProducts([]);
      return;
    }
    const q = productSearch.toLowerCase();
    const matched = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    ).slice(0, 10);
    setFilteredProducts(matched);
  }, [productSearch, products]);

  // Add blank item row
  const addItem = () => {
    setItems(prev => [...prev, {
      description: '',
      quantity: 1,
      unit_price: 0,
      product_id: null,
      category: '',
    }]);
  };

  // Update item field
  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  // Remove item
  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Link item to existing product
  const linkProduct = (index: number, product: POSProduct) => {
    setItems(prev => prev.map((item, i) => i === index ? {
      ...item,
      description: product.name,
      product_id: product.id,
      unit_price: item.unit_price || product.cost_price || 0,
      barcode: product.barcode || undefined,
      category: product.category || '',
    } : item));
    setSearchingProduct(null);
    setProductSearch('');
  };

  // Totals
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Create invoice + receive goods
  const handleReceive = async () => {
    if (!currentOutlet?.id) return;

    const validItems = items.filter(i => i.description.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      setError('Add at least one item with a name and quantity');
      return;
    }

    setError('');
    setIsCreating(true);
    setStep('receiving');

    try {
      // 1. Create the invoice
      const invoice = await invoiceService.createInvoice({
        outlet_id: currentOutlet.id,
        vendor_id: selectedVendorId || undefined,
        invoice_number: invoiceNumber || undefined,
        invoice_type: 'vendor',
        issue_date: invoiceDate,
        notes,
        items: validItems,
      });

      // 2. Receive goods → auto-add to inventory
      const result = await invoiceService.receiveGoods(invoice.id, {
        addToInventory: true,
        updateCostPrices: true,
      });

      setReceiveResult(result);
      setStep('done');
      loadHistory();
    } catch (e: any) {
      console.error('Receive error:', e);
      setError(e.message || 'Failed to receive items');
      setStep('review');
    } finally {
      setIsCreating(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setStep('entry');
    setSelectedVendorId('');
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setItems([]);
    setReceiveResult(null);
    setError('');
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(amount);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Receive Items</h1>
              <p className="text-sm text-gray-500">Enter vendor invoice to add items to inventory</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              History
            </button>
            {step !== 'entry' && step !== 'done' && (
              <button onClick={resetForm} className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ============ STEP: ENTRY ============ */}
        {(step === 'entry' || step === 'review') && (
          <div className="space-y-4">
            {/* Invoice Info Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">Invoice Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Vendor */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Vendor / Supplier</label>
                  <select
                    value={selectedVendorId}
                    onChange={e => setSelectedVendorId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">-- Select Vendor --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                {/* Invoice # */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. SUP-2026-001"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Optional notes..."
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  Invoice Items ({items.length})
                </h2>
                <button
                  onClick={addItem}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>

              {items.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No items yet</p>
                  <p className="text-xs mt-1">Click "Add Item" to start entering invoice items</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <th className="px-3 py-2 text-left w-8">#</th>
                        <th className="px-3 py-2 text-left">Item Name / Description</th>
                        <th className="px-3 py-2 text-left w-32">Link Product</th>
                        <th className="px-3 py-2 text-left w-24">Category</th>
                        <th className="px-3 py-2 text-right w-20">Qty</th>
                        <th className="px-3 py-2 text-right w-28">Cost Price</th>
                        <th className="px-3 py-2 text-right w-28">Total</th>
                        <th className="px-3 py-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={e => updateItem(idx, 'description', e.target.value)}
                              placeholder="Item name..."
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                            />
                          </td>
                          <td className="px-3 py-2 relative">
                            {item.product_id ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                                <Check className="w-3 h-3" /> Linked
                                <button onClick={() => updateItem(idx, 'product_id', null)} className="ml-1 hover:text-red-500">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => { setSearchingProduct(idx); setProductSearch(''); }}
                                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                              >
                                <Search className="w-3 h-3" /> Link
                              </button>
                            )}
                            {/* Product search dropdown */}
                            {searchingProduct === idx && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setSearchingProduct(null)} />
                                <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-40 p-2">
                                  <input
                                    type="text"
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                    placeholder="Search existing product..."
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs mb-1 focus:ring-1 focus:ring-indigo-400"
                                    autoFocus
                                  />
                                  <div className="max-h-40 overflow-y-auto">
                                    {filteredProducts.length === 0 && productSearch && (
                                      <p className="text-xs text-gray-400 p-2">
                                        No match — item will create a <strong>new product</strong>
                                      </p>
                                    )}
                                    {filteredProducts.map(p => (
                                      <button
                                        key={p.id}
                                        onClick={() => linkProduct(idx, p)}
                                        className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 rounded text-xs flex justify-between"
                                      >
                                        <span className="font-medium truncate">{p.name}</span>
                                        <span className="text-gray-400 ml-2 flex-shrink-0">Qty: {p.quantity}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.category || ''}
                              onChange={e => updateItem(idx, 'category', e.target.value)}
                              placeholder="Category"
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-400"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={e => updateItem(idx, 'quantity', Math.max(0, Number(e.target.value)))}
                              min="0"
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right focus:ring-1 focus:ring-indigo-400"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.unit_price}
                              onChange={e => updateItem(idx, 'unit_price', Math.max(0, Number(e.target.value)))}
                              min="0"
                              step="0.01"
                              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right focus:ring-1 focus:ring-indigo-400"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-700">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500 p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary bar */}
              {items.length > 0 && (
                <div className="px-5 py-3 bg-gray-50 border-t flex items-center justify-between">
                  <div className="flex gap-6 text-sm">
                    <span className="text-gray-500">{items.length} line items</span>
                    <span className="text-gray-500">{itemCount} total units</span>
                    <span className="text-gray-500">
                      {items.filter(i => i.product_id).length} linked / {items.filter(i => !i.product_id).length} new
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-gray-500">Total: </span>
                    <span className="text-lg font-bold text-gray-900">{formatCurrency(subtotal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {items.length > 0 && (
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-400">
                  Items linked to existing products update stock. Unlinked items create new products.
                </p>
                <button
                  onClick={handleReceive}
                  disabled={isCreating}
                  className="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Truck className="w-5 h-5" />
                  Receive into Inventory
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============ STEP: RECEIVING ============ */}
        {step === 'receiving' && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold text-gray-900">Receiving items into inventory...</h2>
            <p className="text-sm text-gray-500 mt-1">Creating invoice and updating product stock</p>
          </div>
        )}

        {/* ============ STEP: DONE ============ */}
        {step === 'done' && receiveResult && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Items Received Successfully</h2>
              <p className="text-sm text-gray-500 mt-1">Invoice {receiveResult.invoice_number}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{receiveResult.products_updated.length}</p>
                <p className="text-xs text-blue-600">Products Updated</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{receiveResult.products_created.length}</p>
                <p className="text-xs text-green-600">New Products Created</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-purple-700">{receiveResult.stock_movements_count}</p>
                <p className="text-xs text-purple-600">Stock Movements</p>
              </div>
            </div>

            {/* Details */}
            {receiveResult.products_updated.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Updated Products</h3>
                <div className="space-y-1">
                  {receiveResult.products_updated.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 px-3 bg-gray-50 rounded">
                      <span>{p.name}</span>
                      <span className="text-green-600 font-medium">+{p.quantity_added} → {p.new_total} total</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {receiveResult.products_created.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">New Products Created</h3>
                <div className="space-y-1">
                  {receiveResult.products_created.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 px-3 bg-gray-50 rounded">
                      <span>{p.name}</span>
                      <span className="text-gray-500">
                        Qty: {p.quantity} | Cost: {formatCurrency(p.cost_price)} | Sell: {formatCurrency(p.selling_price)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mt-2">
                  New products have a default 30% markup. You can edit selling prices in Items.
                </p>
              </div>
            )}

            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={resetForm}
                className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 active:scale-95 transition-all"
              >
                Receive More Items
              </button>
            </div>
          </div>
        )}

        {/* ============ HISTORY PANEL ============ */}
        {showHistory && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Recent Invoices ({invoiceHistory.length})
              </h2>
              <button onClick={() => setShowHistory(false)}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            {invoiceHistory.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">No invoices yet</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {invoiceHistory.map(inv => (
                  <div key={inv.id} className="px-5 py-3 flex items-center justify-between text-sm hover:bg-gray-50">
                    <div>
                      <span className="font-medium text-gray-900">{inv.invoice_number}</span>
                      <span className="text-gray-400 ml-3">{inv.issue_date}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                        inv.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                        inv.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {inv.status === 'paid' ? 'Received' : inv.status}
                      </span>
                      <span className="font-medium text-gray-700">{formatCurrency(inv.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiveItemsPage;
