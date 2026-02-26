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
  Tag,
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
  discountApprovalActive?: boolean;
  onUpdateQuantity: (lineId: string, quantity: number) => void;
  onUpdateSaleUnit: (lineId: string, saleUnit: 'unit' | 'pack') => void;
  onUpdateDiscount: (lineId: string, discount: number) => void;
  onRequestDiscountApproval: () => void;
  onRemoveItem: (lineId: string) => void;
  onClearCart: () => void;
}

const POSShoppingCart: React.FC<POSShoppingCartProps> = ({
  cart,
  canApplyDiscount,
  discountApprovalActive = false,
  onUpdateQuantity,
  onUpdateSaleUnit,
  onUpdateDiscount,
  onRequestDiscountApproval,
  onRemoveItem,
}) => {
  const [editingDiscountLineId, setEditingDiscountLineId] = React.useState<string | null>(null);

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

  const handleDiscountChange = (lineId: string, rawValue: string, unitPrice: number) => {
    if (!canApplyDiscount) return;
    const parsed = parseFloat(rawValue);
    const next = Number.isNaN(parsed) ? 0 : clampDiscount(parsed, unitPrice);
    onUpdateDiscount(lineId, next);
  };

  const adjustDiscount = (lineId: string, current: number, delta: number, unitPrice: number) => {
    if (!canApplyDiscount) return;
    onUpdateDiscount(lineId, clampDiscount(current + delta, unitPrice));
  };

  const openDiscountEditor = (lineId: string) => {
    if (!canApplyDiscount) {
      onRequestDiscountApproval();
      return;
    }
    setEditingDiscountLineId((prev) => (prev === lineId ? null : lineId));
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
      {cart.map((item) => {
        const isReturnLine = Boolean(item.isReturnLine);
        const maxReturnQuantity = Math.max(1, Math.round(Number(item.maxQuantity || item.quantity || 1)));
        const canIncreaseQuantity = !isReturnLine || item.quantity < maxReturnQuantity;
        const itemTotal = calculateItemTotal(item);

        return (
          <div
            key={item.lineId}
            className={`flex items-center p-2.5 border rounded-xl transition-colors ${
              isReturnLine
                ? 'border-rose-200 bg-rose-50 hover:bg-rose-100'
                : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
            }`}
          >
            <div className="flex-1 min-w-0 pr-3">
              <p className="font-semibold text-slate-900 truncate text-base">{item.product.name}</p>
              <p className="text-xs text-stone-500 truncate">
                {formatCurrency(item.unitPrice)} per {String(item.saleUnit === 'pack' ? (item.product.pack_name || 'Pack') : (item.product.base_unit_name || 'Unit')).toLowerCase()}
                {item.product.sku ? ` · ${item.product.sku}` : ''}
              </p>
              {isReturnLine && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                  RETURN LINE
                </div>
              )}
              {!isReturnLine &&
                Boolean(item.product.pack_enabled && Number(item.product.pack_price || 0) > 0 && Number(item.product.units_per_pack || 0) >= 2) && (
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => onUpdateSaleUnit(item.lineId, 'unit')}
                      className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                        item.saleUnit === 'unit'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-stone-100'
                      }`}
                    >
                      {item.product.base_unit_name || 'Unit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSaleUnit(item.lineId, 'pack')}
                      className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                        item.saleUnit === 'pack'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-stone-100'
                      }`}
                    >
                      {item.product.pack_name || 'Pack'}
                    </button>
                  </div>
                )}
              {!isReturnLine && item.discount > 0 && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <Tag className="h-3 w-3" />
                  -{formatCurrency(item.discount)} /{String(item.saleUnit === 'pack' ? (item.product.pack_name || 'Pack') : (item.product.base_unit_name || 'Unit')).toLowerCase()}
                </div>
              )}
              {!isReturnLine && editingDiscountLineId === item.lineId && canApplyDiscount && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2 py-1">
                  <button
                    onClick={() => adjustDiscount(item.lineId, item.discount, -1, item.unitPrice)}
                    disabled={item.discount <= 0}
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
                    onChange={(e) => handleDiscountChange(item.lineId, e.target.value, item.unitPrice)}
                    className="w-20 h-7 rounded-md border border-stone-300 bg-white px-2 text-xs font-semibold text-slate-900"
                  />
                  <button
                    onClick={() => adjustDiscount(item.lineId, item.discount, 1, item.unitPrice)}
                    disabled={item.discount >= item.unitPrice}
                    className="w-6 h-6 rounded-md border border-stone-300 bg-white text-slate-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Increase discount"
                  >
                    +
                  </button>
                  <span className="text-[10px] text-stone-500">
                    /{String(item.saleUnit === 'pack' ? (item.product.pack_name || 'Pack') : (item.product.base_unit_name || 'Unit')).toLowerCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center space-x-1.5 flex-shrink-0 w-40">
              <button
                onClick={() => onUpdateQuantity(item.lineId, item.quantity - 1)}
                disabled={item.quantity <= 1}
                className="w-9 h-9 flex items-center justify-center bg-white hover:bg-stone-100 text-slate-700 border border-stone-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-lg font-bold text-slate-900 min-w-[2rem] text-center">
                {item.quantity}
              </span>
              <button
                onClick={() => onUpdateQuantity(item.lineId, item.quantity + 1)}
                disabled={!canIncreaseQuantity}
                className="w-9 h-9 flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-stone-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
              </button>
              {!isReturnLine && (
                <button
                  onClick={() => openDiscountEditor(item.lineId)}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${
                    canApplyDiscount || discountApprovalActive
                      ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                  title={canApplyDiscount ? 'Apply discount' : 'Discount approval required'}
                >
                  <Tag className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className={`font-bold text-base px-2 flex-shrink-0 min-w-[7rem] text-right ${itemTotal < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
              {formatCurrency(itemTotal)}
            </div>

            <button
              onClick={() => onRemoveItem(item.lineId)}
              className="ml-1 w-9 h-9 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
              title={isReturnLine ? 'Exclude from return' : 'Remove item'}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default POSShoppingCart;
