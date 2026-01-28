/**
 * POS Shopping Cart - Cart management interface
 * Nigerian Supermarket Focus
 */

import React, { useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,

} from 'lucide-react';
import type { CartItem } from './POSDashboard';

interface CartTotals {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  total: number;
}

interface POSShoppingCartProps {
  cart: CartItem[];
  totals: CartTotals;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdateDiscount: (productId: string, discount: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
}

const POSShoppingCart: React.FC<POSShoppingCartProps> = ({
  cart,
  totals,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemoveItem,
  onClearCart
}) => {
  const [editingDiscount, setEditingDiscount] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState('');

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const handleDiscountEdit = (productId: string, currentDiscount: number) => {
    setEditingDiscount(productId);
    setDiscountInput(currentDiscount.toString());
  };

  const handleDiscountSave = (productId: string) => {
    const discount = parseFloat(discountInput) || 0;
    onUpdateDiscount(productId, Math.max(0, discount));
    setEditingDiscount(null);
    setDiscountInput('');
  };

  const handleDiscountCancel = () => {
    setEditingDiscount(null);
    setDiscountInput('');
  };

  const calculateItemTotal = (item: CartItem) => {
    const lineSubtotal = item.unitPrice * item.quantity;
    const lineDiscount = item.discount * item.quantity;
    const lineTaxableAmount = lineSubtotal - lineDiscount;
    const lineTax = lineTaxableAmount * item.product.tax_rate;
    return lineTaxableAmount + lineTax;
  };

  if (cart.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Shopping Cart</h2>
          </div>
        </div>

        {/* Empty Cart */}
        <div className="p-8 text-center">
          <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Cart is Empty</h3>
          <p className="text-gray-500">Add products to start a transaction</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Cart ({cart.length})
            </h2>
          </div>
          <button
            onClick={onClearCart}
            className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {cart.map((item) => (
            <div
              key={item.product.id}
              className="border border-gray-200 rounded-lg p-3 bg-gray-50"
            >
              {/* Product Info */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-gray-900 truncate">
                    {item.product.name}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    {item.product.sku}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {formatCurrency(item.unitPrice)} each
                  </p>
                </div>
                <button
                  onClick={() => onRemoveItem(item.product.id)}
                  className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                  title="Remove item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center font-medium">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                    className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(calculateItemTotal(item))}
                </span>
              </div>

              {/* Discount */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {editingDiscount === item.product.id ? (
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        placeholder="0.00"
                        className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                        step="0.01"
                        autoFocus
                      />
                      <button
                        onClick={() => handleDiscountSave(item.product.id)}
                        className="text-green-600 hover:text-green-800 text-xs"
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleDiscountCancel}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-600">
                        Discount: {formatCurrency(item.discount)}
                      </span>
                      <button
                        onClick={() => handleDiscountEdit(item.product.id, item.discount)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Edit discount"
                      >
                        {/* Edit icon removed */}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Totals */}
      <div className="border-t border-gray-200 p-4 bg-gray-50 flex-shrink-0">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.totalDiscount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Discount:</span>
              <span>-{formatCurrency(totals.totalDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Tax (7.5%):</span>
            <span className="font-medium">{formatCurrency(totals.totalTax)}</span>
          </div>
          <div className="border-t border-gray-300 pt-2 flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span className="text-blue-600">{formatCurrency(totals.total)}</span>
          </div>
        </div>

        {/* Total Display */}
        <div className="mt-4">
          <div className="text-center p-6 bg-orange-50 rounded-lg border border-orange-200">
            <div className="text-sm text-gray-600 mb-1">Total to Pay</div>
            <div className="text-3xl font-bold text-orange-600">
              {formatCurrency(totals.total)}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {cart.length > 0
                ? `${cart.length} item${cart.length !== 1 ? 's' : ''} ready`
                : 'Add items to cart'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSShoppingCart;