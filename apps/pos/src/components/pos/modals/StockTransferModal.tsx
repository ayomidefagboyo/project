
import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Plus, Minus } from 'lucide-react';
import { posService } from '@/lib/posService';
import type { POSProduct } from '@/lib/posService';
import { useOutlet } from '@/contexts/OutletContext';

interface TransferItem {
  product_id: string;
  product_name: string;
  quantity: number;
  batch_number: string;
  available_stock: number;
}

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const StockTransferModal: React.FC<StockTransferModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { currentOutlet, userOutlets } = useOutlet();
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [transferInfo, setTransferInfo] = useState({
    to_outlet_id: '',
    notes: '',
    transfer_date: new Date().toISOString().split('T')[0]
  });

  // Available outlets (exclude current outlet)
  const availableOutlets = userOutlets.filter(outlet => outlet.id !== currentOutlet?.id);

  // Load products when modal opens
  useEffect(() => {
    if (isOpen && currentOutlet?.id) {
      loadProducts();
    }
  }, [isOpen, currentOutlet?.id]);

  const loadProducts = async () => {
    if (!currentOutlet?.id) return;

    try {
      const response = await posService.getProducts(currentOutlet.id, {
        size: 100,
        activeOnly: true
      });
      if (response?.items) {
        setProducts(response.items);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Failed to load products');
    }
  };

  const addProductToTransfer = () => {
    if (!selectedProduct) return;

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    // Check if product already in transfer list
    if (transferItems.some(item => item.product_id === selectedProduct)) {
      alert('Product already added to transfer');
      return;
    }

    const newItem: TransferItem = {
      product_id: selectedProduct,
      product_name: product.name,
      quantity: 1,
      batch_number: `B${Date.now()}`, // Simplified batch number
      available_stock: product.quantity_on_hand || 0
    };

    setTransferItems(prev => [...prev, newItem]);
    setSelectedProduct('');
  };

  const updateTransferItem = (index: number, field: keyof TransferItem, value: any) => {
    setTransferItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeTransferItem = (index: number) => {
    setTransferItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet?.id || !transferInfo.to_outlet_id || transferItems.length === 0) {
      alert('Please fill in all required fields and add at least one item');
      return;
    }

    // Validate quantities
    const invalidItems = transferItems.filter(item => item.quantity > item.available_stock);
    if (invalidItems.length > 0) {
      alert('Some items have quantities exceeding available stock. Please check and try again.');
      return;
    }

    setIsLoading(true);
    try {
      await posService.createInventoryTransfer({
        from_outlet_id: currentOutlet.id,
        to_outlet_id: transferInfo.to_outlet_id,
        items: transferItems.map(item => ({
          product_id: item.product_id,
          quantity_requested: item.quantity,
          batch_number: item.batch_number
        })),
        notes: transferInfo.notes
      });

      alert(`Stock transfer created successfully! ${transferItems.length} items transferred.`);
      onSuccess();
      onClose();

      // Reset form
      setTransferItems([]);
      setTransferInfo({
        to_outlet_id: '',
        notes: '',
        transfer_date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Error creating transfer:', error);
      alert('Failed to create stock transfer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalItems = transferItems.reduce((sum, item) => sum + item.quantity, 0);
  const selectedOutlet = availableOutlets.find(outlet => outlet.id === transferInfo.to_outlet_id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <RotateCcw className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">Stock Transfer</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Transfer Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Transfer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Outlet
                </label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
                  {currentOutlet?.name}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To Outlet *
                </label>
                <select
                  value={transferInfo.to_outlet_id}
                  onChange={(e) => setTransferInfo(prev => ({ ...prev, to_outlet_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select destination outlet</option>
                  {availableOutlets.map(outlet => (
                    <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transfer Date
                </label>
                <input
                  type="date"
                  value={transferInfo.transfer_date}
                  onChange={(e) => setTransferInfo(prev => ({ ...prev, transfer_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transfer Notes
              </label>
              <textarea
                value={transferInfo.notes}
                onChange={(e) => setTransferInfo(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Reason for transfer, special instructions, etc."
              />
            </div>
          </div>

          {/* Add Products */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Products to Transfer</h3>
            <div className="flex space-x-3">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Select a product to transfer...</option>
                {products
                  .filter(product => (product.quantity_on_hand || 0) > 0)
                  .map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} - Stock: {product.quantity_on_hand}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={addProductToTransfer}
                disabled={!selectedProduct}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </button>
            </div>
          </div>

          {/* Transfer Items */}
          {transferItems.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Transfer Items</h3>
              <div className="space-y-3">
                {transferItems.map((item, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
                        <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                        <div className="text-xs text-gray-500">Available: {item.available_stock}</div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateTransferItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          min="1"
                          max={item.available_stock}
                          className={`w-full px-2 py-1 border rounded text-sm ${item.quantity > item.available_stock
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-300'
                            }`}
                        />
                        {item.quantity > item.available_stock && (
                          <div className="text-xs text-red-600 mt-1">Exceeds available stock</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Batch Number</label>
                        <input
                          type="text"
                          value={item.batch_number}
                          onChange={(e) => updateTransferItem(index, 'batch_number', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => removeTransferItem(index)}
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
                    Total Items to Transfer: <span className="font-semibold">{totalItems}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Destination: <span className="font-semibold">{selectedOutlet?.name || 'Not selected'}</span>
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
              disabled={isLoading || transferItems.length === 0 || !transferInfo.to_outlet_id}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Create Transfer ({transferItems.length} items)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockTransferModal;