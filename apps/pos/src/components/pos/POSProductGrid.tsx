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
      {/* Combined Header with Search */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-2 mb-3">
          <Package className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Products ({products.length})
          </h2>
        </div>
      </div>

      {/* Product Grid */}
      <div className="flex-1 p-4 overflow-y-auto bg-white">
        {products.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No products found</p>
              <p className="text-gray-400 text-sm mt-1">Search for products or add inventory</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {products.map((product) => {
              const stockInfo = getStockStatus(product.quantity_on_hand, product.reorder_level);

              return (
                <button
                  key={product.id}
                  onClick={() => onProductSelect(product)}
                  disabled={!product.is_active || product.quantity_on_hand === 0}
                  className={`
                  group relative p-3 rounded-lg border-2 transition-all duration-150 text-left
                  ${product.is_active && product.quantity_on_hand > 0
                      ? 'border-gray-200 hover:border-blue-300 hover:shadow-md active:scale-95 cursor-pointer bg-white'
                      : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                    }
                `}
                >
                  {/* Product Image Placeholder */}
                  <div className="aspect-square w-full mb-2 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
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
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="space-y-1">
                    <h3 className="font-medium text-sm text-gray-900 leading-tight line-clamp-2 group-hover:text-blue-600">
                      {product.name}
                    </h3>

                    <p className="text-xs text-gray-500 font-mono">
                      {product.sku}
                    </p>

                    {product.category && (
                      <p className="text-xs text-gray-500 capitalize">
                        {product.category}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(product.unit_price)}
                      </span>
                    </div>

                    {/* Stock Status */}
                    <div className="flex items-center justify-between">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${stockInfo.color}`}>
                        {stockInfo.text}
                      </span>
                      <span className="text-xs text-gray-500">
                        {product.quantity_on_hand}
                      </span>
                    </div>
                  </div>

                  {/* Hover Effect */}
                  <div className="absolute inset-0 rounded-lg bg-blue-500 opacity-0 group-hover:opacity-5 transition-opacity"></div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {products.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600 text-center">
            Tap any product to add to cart
          </p>
        </div>
      )}
    </div>
  );
};

export default POSProductGrid;