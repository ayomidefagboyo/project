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
    return lineSubtotal - lineDiscount;
  };

  if (cart.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <ShoppingCart className="h-6 w-6 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Shopping Cart</h2>
          </div>
        </div>

        {/* Empty Cart */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <ShoppingCart className="h-20 w-20 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Cart is Empty</h3>
            <p className="text-slate-500">Add products to start a transaction</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {cart.map((item) => (
        <div
          key={item.product.id}
          className="flex items-center p-2 border border-slate-200 rounded bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          {/* Product Name */}
          <div className="flex-1 min-w-0 pr-3">
            <span className="font-medium text-slate-900 truncate">
              {item.product.name}
            </span>
          </div>

          {/* Quantity Controls - visually centered between name and price, unified orange styling */}
          <div className="flex items-center justify-center space-x-1 flex-shrink-0 w-28">
            <button
              onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
              disabled={item.quantity <= 1}
              className="w-6 h-6 flex items-center justify-center bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-sm font-bold text-slate-900 min-w-[1.75rem] text-center">
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
              className="w-6 h-6 flex items-center justify-center bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Line Total */}
          <div className="font-bold text-sm text-slate-900 px-3 flex-shrink-0 min-w-[5rem] text-right">
            {formatCurrency(calculateItemTotal(item))}
          </div>

          {/* Remove Button */}
          <button
            onClick={() => onRemoveItem(item.product.id)}
            className="ml-2 w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors flex-shrink-0"
            title="Remove item"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default POSShoppingCart;