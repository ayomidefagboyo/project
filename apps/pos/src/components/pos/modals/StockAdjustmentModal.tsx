import React, { useState, useEffect } from 'react';
import { X, Package2, Plus, Minus } from 'lucide-react';
import { posService } from '@/lib/posService';
import type { POSProduct } from '@/lib/posService';
import { useOutlet } from '@/contexts/OutletContext';

interface AdjustmentItem {
  product_id: string;
  product_name: string;
  current_stock: number;
  adjustment_quantity: number;
  adjustment_type: 'increase' | 'decrease';
  reason: string;
  notes: string;
}

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { currentOutlet } = useOutlet();
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [adjustmentItems, setAdjustmentItems] = useState<AdjustmentItem[]>([]);

  const adjustmentReasons = [
    'Damaged goods',
    'Expired products',
    'Theft/Loss',
    'Counting error',
    'Return to supplier',
    'Promotional giveaway',
    'Staff consumption',
    'Sample/Demo',
    'Other'
  ];

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
      setProducts(response?.items || []);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Failed to load products');
    }
  };

  const addProductToAdjustment = () => {
    if (!selectedProduct) return;

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    // Check if product already in adjustment list
    if (adjustmentItems.some(item => item.product_id === selectedProduct)) {
      alert('Product already added to adjustment');
      return;
    }

    const newItem: AdjustmentItem = {
      product_id: selectedProduct,
      product_name: product.name,
      current_stock: product.quantity_on_hand || 0,
      adjustment_quantity: 0,
      adjustment_type: 'decrease',
      reason: '',
      notes: ''
    };

    setAdjustmentItems(prev => [...prev, newItem]);
    setSelectedProduct('');
  };

  const updateAdjustmentItem = (index: number, field: keyof AdjustmentItem, value: any) => {
    setAdjustmentItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeAdjustmentItem = (index: number) => {
    setAdjustmentItems(prev => prev.filter((_, i) => i !== index));
  };

  const calculateNewStock = (item: AdjustmentItem) => {
    if (item.adjustment_type === 'increase') {
      return item.current_stock + item.adjustment_quantity;
    } else {
      return Math.max(0, item.current_stock - item.adjustment_quantity);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet?.id || adjustmentItems.length === 0) {
      alert('Please add at least one adjustment item');
      return;
    }

    // Validate adjustments
    const invalidItems = adjustmentItems.filter(item =>
      item.adjustment_quantity <= 0 ||
      !item.reason ||
      (item.adjustment_type === 'decrease' && item.adjustment_quantity > item.current_stock)
    );

    if (invalidItems.length > 0) {
      alert('Please fill in all required fields and ensure adjustment quantities are valid');
      return;
    }

    setIsLoading(true);
    try {
      // Create stock adjustment
      await posService.adjustStock(adjustmentItems.map(item => ({
        product_id: item.product_id,
        quantity: item.adjustment_type === 'increase' ? item.adjustment_quantity : -item.adjustment_quantity,
        type: item.adjustment_type === 'increase' ? 'adjustment_in' : 'adjustment_out',
        reason: item.reason,
        notes: item.notes,
        batch_number: `ADJ${Date.now()}`
      })));

      alert(`Stock adjustments processed successfully! ${adjustmentItems.length} items adjusted.`);
      onSuccess();
      onClose();

      // Reset form
      setAdjustmentItems([]);
    } catch (error) {
      console.error('Error processing adjustments:', error);
      alert('Failed to process stock adjustments. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalAdjustments = adjustmentItems.length;
  const totalIncrease = adjustmentItems
    .filter(item => item.adjustment_type === 'increase')
    .reduce((sum, item) => sum + item.adjustment_quantity, 0);
  const totalDecrease = adjustmentItems
    .filter(item => item.adjustment_type === 'decrease')
    .reduce((sum, item) => sum + item.adjustment_quantity, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Package2 className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-bold text-gray-900">Stock Adjustment</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Information */}
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Stock Adjustment</h3>
            <p className="text-sm text-gray-600">
              Use this form to adjust stock levels for damaged goods, expired products, counting errors, or other inventory discrepancies.
              All adjustments will be tracked in your audit trail.
            </p>
          </div>

          {/* Add Products */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Products to Adjust</h3>
            <div className="flex space-x-3">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">Select a product to adjust...</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} - Current Stock: {product.quantity_on_hand || 0}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addProductToAdjustment}
                disabled={!selectedProduct}
                className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </button>
            </div>
          </div>

          {/* Adjustment Items */}
          {adjustmentItems.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Adjustments</h3>
              <div className="space-y-4">
                {adjustmentItems.map((item, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 items-start">
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
                        <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                        <div className="text-xs text-gray-500">Current: {item.current_stock}</div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                        <select
                          value={item.adjustment_type}
                          onChange={(e) => updateAdjustmentItem(index, 'adjustment_type', e.target.value as 'increase' | 'decrease')}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="decrease">Decrease (-)</option>
                          <option value="increase">Increase (+)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                        <input
                          type="number"
                          value={item.adjustment_quantity}
                          onChange={(e) => updateAdjustmentItem(index, 'adjustment_quantity', parseInt(e.target.value) || 0)}
                          min="1"
                          max={item.adjustment_type === 'decrease' ? item.current_stock : undefined}
                          className={`w-full px-2 py-1 border rounded text-sm ${item.adjustment_type === 'decrease' && item.adjustment_quantity > item.current_stock
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-300'
                            }`}
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          New: {calculateNewStock(item)}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Reason *</label>
                        <select
                          value={item.reason}
                          onChange={(e) => updateAdjustmentItem(index, 'reason', e.target.value)}
                          required
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="">Select reason</option>
                          {adjustmentReasons.map(reason => (
                            <option key={reason} value={reason}>{reason}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => updateAdjustmentItem(index, 'notes', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Additional details"
                        />
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => removeAdjustmentItem(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-5"
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
                <h4 className="font-semibold text-gray-900 mb-3">Adjustment Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Adjustments:</span>
                    <div className="font-semibold text-gray-900">{totalAdjustments} items</div>
                  </div>
                  <div>
                    <span className="text-green-600">Total Increases:</span>
                    <div className="font-semibold text-green-900">+{totalIncrease}</div>
                  </div>
                  <div>
                    <span className="text-red-600">Total Decreases:</span>
                    <div className="font-semibold text-red-900">-{totalDecrease}</div>
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
              disabled={isLoading || adjustmentItems.length === 0}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Package2 className="w-4 h-4 mr-2" />
              )}
              Process Adjustments ({adjustmentItems.length})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockAdjustmentModal;