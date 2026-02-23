/**
 * POS Shopping Cart - Cart management interface
 * Nigerian Supermarket Focus
 */

import React from 'react';
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
  canApplyDiscount: boolean;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdateDiscount: (productId: string, discount: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
}

const POSShoppingCart: React.FC<POSShoppingCartProps> = ({
  cart,
  canApplyDiscount,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemoveItem,
}) => {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const calculateItemTotal = (item: CartItem) => {
    const lineSubtotal = item.unitPrice * item.quantity;
    const lineDiscount = item.discount * item.quantity;
    return lineSubtotal - lineDiscount;
  };

  const clampDiscount = (discount: number, max: number) =>
    Math.max(0, Math.min(max, Number.isFinite(discount) ? discount : 0));

  const handleDiscountChange = (productId: string, rawValue: string, unitPrice: number) => {
    if (!canApplyDiscount) return;
    const parsed = parseFloat(rawValue);
    const next = Number.isNaN(parsed) ? 0 : clampDiscount(parsed, unitPrice);
    onUpdateDiscount(productId, next);
  };

  const adjustDiscount = (productId: string, current: number, delta: number, unitPrice: number) => {
    if (!canApplyDiscount) return;
    onUpdateDiscount(productId, clampDiscount(current + delta, unitPrice));
  };

  if (cart.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-7 w-7 text-stone-500" />
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Shopping Cart</h2>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <ShoppingCart className="h-14 w-14 text-stone-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Cart is empty</h3>
            <p className="text-stone-500 text-sm">Scan or enter product to start a sale</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!canApplyDiscount && (
        <div className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-[11px] text-amber-800">
          Discounts are restricted to Manager or Pharmacist.
        </div>
      )}
      {cart.map((item) => (
        <div
          key={item.product.id}
          className="flex items-center p-2.5 border border-stone-200 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors"
        >
          <div className="flex-1 min-w-0 pr-3">
            <p className="font-semibold text-slate-900 truncate text-base">{item.product.name}</p>
            <p className="text-xs text-stone-500 truncate">
              {formatCurrency(item.unitPrice)} each
              {item.product.sku ? ` · ${item.product.sku}` : ''}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Disc</span>
              <button
                onClick={() => adjustDiscount(item.product.id, item.discount, -1, item.unitPrice)}
                disabled={!canApplyDiscount || item.discount <= 0}
                className="w-6 h-6 rounded-md border border-stone-300 bg-white text-slate-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                title="Decrease discount"
              >
                -
              </button>
              <input
                type="number"
                min={0}
                max={item.unitPrice}
                step="0.01"
                value={item.discount > 0 ? item.discount : ''}
                placeholder="0.00"
                onChange={(e) => handleDiscountChange(item.product.id, e.target.value, item.unitPrice)}
                disabled={!canApplyDiscount}
                className="w-20 h-7 rounded-md border border-stone-300 bg-white px-2 text-xs font-semibold text-slate-900 disabled:bg-stone-100 disabled:text-stone-500"
              />
              <button
                onClick={() => adjustDiscount(item.product.id, item.discount, 1, item.unitPrice)}
                disabled={!canApplyDiscount || item.discount >= item.unitPrice}
                className="w-6 h-6 rounded-md border border-stone-300 bg-white text-slate-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                title="Increase discount"
              >
                +
              </button>
              <span className="text-[10px] text-stone-500">/unit</span>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-1.5 flex-shrink-0 w-32">
            <button
              onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
              disabled={item.quantity <= 1}
              className="w-9 h-9 flex items-center justify-center bg-white hover:bg-stone-100 text-slate-700 border border-stone-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-lg font-bold text-slate-900 min-w-[2rem] text-center">
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
              className="w-9 h-9 flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-stone-100 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="font-bold text-base text-slate-900 px-2 flex-shrink-0 min-w-[7rem] text-right">
            {formatCurrency(calculateItemTotal(item))}
          </div>

          <button
            onClick={() => onRemoveItem(item.product.id)}
            className="ml-1 w-9 h-9 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
            title="Remove item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default POSShoppingCart;
