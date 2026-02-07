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
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 font-medium">Error loading products</p>
            <p className="text-gray-500 text-sm mt-1">{error}</p>
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
    if (quantity === 0) return { status: 'out', color: 'bg-red-100 text-red-800', text: 'Out of Stock' };
    if (quantity <= reorderLevel) return { status: 'low', color: 'bg-yellow-100 text-yellow-800', text: 'Low Stock' };
    return { status: 'good', color: 'bg-green-100 text-green-800', text: 'In Stock' };
  };

  return (
    <div className="h-full flex flex-col">
      {/* Premium Header */}
      <div className="p-6 border-b border-slate-200 bg-white">
        <div className="flex items-center space-x-3">
          <Package className="h-6 w-6 text-slate-600" />
          <h2 className="text-xl font-semibold text-slate-900">
            Products ({products.length})
          </h2>
        </div>
      </div>

      {/* Fixed Product Grid */}
      <div className="flex-1 p-6 bg-white scroll-area">
        {products.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Search className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium text-lg">No products found</p>
              <p className="text-slate-500 text-sm mt-2">Search for products or add inventory</p>
            </div>
          </div>
        ) : (
          <div className="product-grid">
            {products.map((product) => {
              const stockInfo = getStockStatus(product.quantity_on_hand, product.reorder_level);

              return (
                <button
                  key={product.id}
                  onClick={() => onProductSelect(product)}
                  disabled={!product.is_active || product.quantity_on_hand === 0}
                  className={`
                  product-card group relative p-4 text-left
                  ${product.is_active && product.quantity_on_hand > 0
                      ? 'disabled:opacity-50 disabled:cursor-not-allowed'
                      : 'opacity-50 cursor-not-allowed'
                    }
                `}
                >
                  {/* Product Image */}
                  <div className="h-24 w-full mb-3 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
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
                      <Package className="h-8 w-8 text-slate-400" />
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm text-slate-900 leading-tight line-clamp-2 group-hover:text-indigo-600 transition-colors">
                      {product.name}
                    </h3>

                    <div className="flex items-center justify-between">
                      <span className="text-price">
                        {formatCurrency(product.unit_price)}
                      </span>
                      <div className={`w-2 h-2 rounded-full ${
                        stockInfo.status === 'good' ? 'bg-emerald-400' :
                        stockInfo.status === 'low' ? 'bg-amber-400' : 'bg-red-400'
                      }`} />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
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

      {/* Premium Footer */}
      {products.length > 0 && (
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-600 text-center font-medium">
            Tap any product to add to cart
          </p>
        </div>
      )}
    </div>
  );
};

export default POSProductGrid;