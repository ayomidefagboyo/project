/**
 * POS Product Grid - Touch-optimized product selection
 * Nigerian Supermarket Focus
 */

import React from 'react';
import { Package, Search, AlertTriangle } from 'lucide-react';
import type { POSProduct } from '@/lib/posService';

interface POSProductGridProps {
  products: POSProduct[];
  onProductSelect: (product: POSProduct) => void;
  isLoading: boolean;
  error: string | null;
}

const POSProductGrid: React.FC<POSProductGridProps> = ({
  products,
  onProductSelect,
  isLoading,
  error
}) => {
  if (isLoading) {
    return (
      <div className="h-full rounded-2xl border border-stone-200 bg-white shadow-sm p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto mb-4"></div>
            <p className="text-stone-500 text-base">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full rounded-2xl border border-stone-200 bg-white shadow-sm p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 font-medium text-base">Error loading products</p>
            <p className="text-stone-500 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }


  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStockStatus = (quantity: number, reorderLevel: number) => {
    if (quantity === 0) return { status: 'out', dot: 'bg-red-500', text: 'Out' };
    if (quantity <= reorderLevel) return { status: 'low', dot: 'bg-amber-500', text: 'Low' };
    return { status: 'good', dot: 'bg-emerald-500', text: 'In' };
  };

  return (
    <div className="h-full rounded-2xl border border-stone-200 bg-white shadow-sm flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-200 bg-white">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-stone-500 inline-flex items-center gap-2">
            <Package className="h-4 w-4 text-stone-500" />
            Product Catalog
          </h2>
          <p className="text-sm font-semibold text-slate-700">{products.length} items</p>
        </div>
      </div>

      <div className="flex-1 p-4 bg-white scroll-area">
        {products.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Search className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium text-lg">No products found</p>
              <p className="text-stone-500 text-sm mt-2">Search for products or add inventory</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3">
            {products.map((product) => {
              const stockInfo = getStockStatus(product.quantity_on_hand, product.reorder_level);
              const isUnavailable = !product.is_active || product.quantity_on_hand === 0;

              return (
                <button
                  key={product.id}
                  onClick={() => onProductSelect(product)}
                  disabled={isUnavailable}
                  className={`
                  group relative rounded-xl border p-3 text-left transition-all
                  ${isUnavailable
                      ? 'opacity-50 cursor-not-allowed border-stone-200 bg-stone-50'
                      : 'border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 active:scale-[0.99]'
                    }
                `}
                >
                  <div className="h-24 w-full mb-3 bg-stone-100 rounded-lg flex items-center justify-center overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '';
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`${product.image_url ? 'hidden' : 'flex'} items-center justify-center h-full`}>
                      <Package className="h-8 w-8 text-stone-400" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-base text-slate-900 leading-tight line-clamp-2">
                      {product.name}
                    </h3>

                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-slate-900">
                        {formatCurrency(product.unit_price)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500">
                        <span className={`w-2 h-2 rounded-full ${stockInfo.dot}`} />
                        {stockInfo.text}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-stone-500">
                      <span>Stock: {product.quantity_on_hand}</span>
                      {product.category && (
                        <span className="capitalize">{product.category}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {products.length > 0 && (
        <div className="p-3 border-t border-stone-200 bg-stone-50">
          <p className="text-sm text-stone-600 text-center font-medium">
            Tap any product to add to cart
          </p>
        </div>
      )}
    </div>
  );
};

export default POSProductGrid;
