import React, { useState, useEffect } from 'react';
import { X, Truck, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { posService } from '@/lib/posService';
import type { POSProduct } from '@/lib/posService';
import { useOutlet } from '@/contexts/OutletContext';
import { useToast } from '../../ui/Toast';

interface StockItem {
  product_id: string;
  product_name: string;
  quantity: number;
  batch_number: string;
  expiry_date: string;
  cost_price: number;
}

interface ReceiveStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ReceiveStockModal: React.FC<ReceiveStockModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { currentOutlet } = useOutlet();
  const { success, error } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [showDeliveryNotes, setShowDeliveryNotes] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState({
    supplier_reference: '',
    delivery_notes: '',
    delivery_date: new Date().toISOString().split('T')[0]
  });

  // Load products when modal opens
  useEffect(() => {
    if (isOpen && currentOutlet?.id) {
      loadProducts();
    }
  }, [isOpen, currentOutlet?.id]);

  const loadProducts = async () => {
    if (!currentOutlet?.id) return;

    try {
      const response = await posService.getProducts(currentOutlet.id, { size: 100 });
      setProducts(response?.items || []);
    } catch (error) {
      console.error('Error loading products:', error);
      error('Failed to load products');
    }
  };

  const generateBatchNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `B${year}${month}${day}${random}`;
  };

  const addProductToStock = () => {
    if (!selectedProduct) return;

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const newItem: StockItem = {
      product_id: selectedProduct,
      product_name: product.name,
      quantity: 1,
      batch_number: generateBatchNumber(),
      expiry_date: product.min_shelf_life_days
        ? new Date(Date.now() + (product.min_shelf_life_days || 365) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : '',
      cost_price: product.cost_price || 0
    };

    setStockItems(prev => [...prev, newItem]);
    setSelectedProduct('');
  };

  const updateStockItem = (index: number, field: keyof StockItem, value: any) => {
    setStockItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeStockItem = (index: number) => {
    setStockItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet?.id || stockItems.length === 0) return;

    setIsLoading(true);
    try {
      // Create stock receipts for all items
      await posService.receiveStock(stockItems.map(item => ({
        product_id: item.product_id,
        quantity_received: item.quantity,
        cost_price: item.cost_price,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date || undefined,
        supplier_invoice: deliveryInfo.supplier_reference,
        received_by: 'current_user', // TODO: Get actual user ID
        notes: deliveryInfo.delivery_notes
      })));

      success(`Stock delivery received successfully! ${stockItems.length} items processed.`);
      onSuccess();
      onClose();

      // Reset form
      setStockItems([]);
      setDeliveryInfo({
        supplier_reference: '',
        delivery_notes: '',
        delivery_date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Error receiving stock:', error);
      error('Failed to process stock delivery. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalItems = stockItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = stockItems.reduce((sum, item) => sum + (item.quantity * item.cost_price), 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Receive Stock Delivery</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Compact Delivery Info Bar */}
          <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-5 py-2.5 shrink-0">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                  Invoice / PO #
                </label>
                <input
                  type="text"
                  value={deliveryInfo.supplier_reference}
                  onChange={(e) => setDeliveryInfo(prev => ({ ...prev, supplier_reference: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g. INV-001"
                />
              </div>

              <div className="w-[150px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                  Date
                </label>
                <input
                  type="date"
                  value={deliveryInfo.delivery_date}
                  onChange={(e) => setDeliveryInfo(prev => ({ ...prev, delivery_date: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowDeliveryNotes(!showDeliveryNotes)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                {showDeliveryNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Notes
              </button>
            </div>

            {showDeliveryNotes && (
              <div className="mt-2">
                <input
                  type="text"
                  value={deliveryInfo.delivery_notes}
                  onChange={(e) => setDeliveryInfo(prev => ({ ...prev, delivery_notes: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Delivery notes..."
                />
              </div>
            )}
          </div>

          {/* Combined: Add Product + Line Items */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {/* Add product row */}
            <div className="flex items-center gap-2 mb-3">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="flex-1 px-2.5 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select a product to add...</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} {product.barcode ? `- ${product.barcode}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addProductToStock}
                disabled={!selectedProduct}
                className="flex items-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-40 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {/* Line items table */}
            {stockItems.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                No items added yet. Select a product above to begin.
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_80px_120px_120px_100px_40px] gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <span>Product</span>
                  <span>Qty</span>
                  <span>Batch #</span>
                  <span>Expiry</span>
                  <span>Cost (₦)</span>
                  <span></span>
                </div>

                {/* Table rows */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {stockItems.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[1fr_80px_120px_120px_100px_40px] gap-2 px-3 py-2 items-center hover:bg-gray-50 dark:hover:bg-gray-750"
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={item.product_name}>
                        {item.product_name}
                      </div>

                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateStockItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        min="1"
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />

                      <input
                        type="text"
                        value={item.batch_number}
                        onChange={(e) => updateStockItem(index, 'batch_number', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />

                      <input
                        type="date"
                        value={item.expiry_date}
                        onChange={(e) => updateStockItem(index, 'expiry_date', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />

                      <input
                        type="number"
                        value={item.cost_price}
                        onChange={(e) => updateStockItem(index, 'cost_price', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />

                      <button
                        type="button"
                        onClick={() => removeStockItem(index)}
                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer: Summary + Buttons */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3 bg-white dark:bg-gray-800 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                {stockItems.length > 0 && (
                  <>
                    <span>Items: <span className="font-semibold text-gray-900 dark:text-white">{totalItems}</span></span>
                    <span>Total: <span className="font-semibold text-gray-900 dark:text-white">₦{totalValue.toLocaleString()}</span></span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || stockItems.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Truck className="w-4 h-4" />
                  )}
                  Receive Stock {stockItems.length > 0 && `(${stockItems.length})`}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceiveStockModal;
