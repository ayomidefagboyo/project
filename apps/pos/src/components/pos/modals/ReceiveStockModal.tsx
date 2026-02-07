import React, { useState, useEffect } from 'react';
import { X, Truck, Plus, Minus } from 'lucide-react';
import { posService } from '@/lib/posService';
import type { POSProduct } from '@/lib/posService';
import { useOutlet } from '@/contexts/OutletContext';

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
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
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
      alert('Failed to load products');
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
      // Create stock movements for each item
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

      alert(`Stock delivery received successfully! ${stockItems.length} items processed.`);
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
      alert('Failed to process stock delivery. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalItems = stockItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = stockItems.reduce((sum, item) => sum + (item.quantity * item.cost_price), 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Truck className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900">Receive Stock Delivery</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Delivery Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Reference
                </label>
                <input
                  type="text"
                  value={deliveryInfo.supplier_reference}
                  onChange={(e) => setDeliveryInfo(prev => ({ ...prev, supplier_reference: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Invoice/PO number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Date
                </label>
                <input
                  type="date"
                  value={deliveryInfo.delivery_date}
                  onChange={(e) => setDeliveryInfo(prev => ({ ...prev, delivery_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Notes
                </label>
                <input
                  type="text"
                  value={deliveryInfo.delivery_notes}
                  onChange={(e) => setDeliveryInfo(prev => ({ ...prev, delivery_notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Additional notes"
                />
              </div>
            </div>
          </div>

          {/* Add Products */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Products to Delivery</h3>
            <div className="flex space-x-3">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select a product to add...</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {product.barcode}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addProductToStock}
                disabled={!selectedProduct}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </button>
            </div>
          </div>

          {/* Stock Items */}
          {stockItems.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Items</h3>
              <div className="space-y-3">
                {stockItems.map((item, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
                        <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateStockItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          min="1"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Batch Number</label>
                        <input
                          type="text"
                          value={item.batch_number}
                          onChange={(e) => updateStockItem(index, 'batch_number', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Expiry Date</label>
                        <input
                          type="date"
                          value={item.expiry_date}
                          onChange={(e) => updateStockItem(index, 'expiry_date', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Cost Price</label>
                        <input
                          type="number"
                          value={item.cost_price}
                          onChange={(e) => updateStockItem(index, 'cost_price', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => removeStockItem(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="bg-gray-50 p-4 rounded-lg mt-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Total Items: <span className="font-semibold">{totalItems}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Total Value: <span className="font-semibold">₦{totalValue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || stockItems.length === 0}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Truck className="w-4 h-4 mr-2" />
              )}
              Receive Stock ({stockItems.length} items)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceiveStockModal;