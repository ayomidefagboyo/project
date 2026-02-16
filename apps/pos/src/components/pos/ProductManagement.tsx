/**
 * Product Management - Excel-like bulk product management
 * Swiss Premium Design with touch optimization
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Plus,
  Save,
  Upload,
  Download,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Edit3,
  Package,
  MoreHorizontal,
  ArrowLeft
} from 'lucide-react';
import { posService, type POSProduct } from '../../lib/posService';
import { clearMissingProductIntent, peekMissingProductIntent } from '../../lib/missingProductIntent';
import { useOutlet } from '../../contexts/OutletContext';
import { useLocation, useNavigate } from 'react-router-dom';

interface ProductManagementProps {
  onShowNewRow?: () => void;
}

export interface ProductManagementHandle {
  handleShowNewRow: () => void;
  refresh: () => void;
}

const ProductManagement = forwardRef<ProductManagementHandle, ProductManagementProps>(({ onShowNewRow }, ref) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentOutlet } = useOutlet();
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [editingRows, setEditingRows] = useState<Set<string>>(new Set());
  const [newProduct, setNewProduct] = useState<Partial<POSProduct>>({});
  const [showNewRow, setShowNewRow] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const loadRequestRef = useRef(0);
  const newBarcodeInputRef = useRef<HTMLInputElement | null>(null);

  const categories = [
    'Beverages',
    'Food & Groceries',
    'Household Items',
    'Personal Care',
    'Electronics',
    'Clothing',
    'Office Supplies',
    'Pharmacy',
    'Other'
  ];

  useEffect(() => {
    loadProducts();
  }, [currentOutlet?.id, searchQuery, selectedCategory]);

  const openNewRowForScannedBarcode = (rawBarcode: string) => {
    const barcode = rawBarcode.trim();
    if (!barcode) return;
    setShowNewRow(true);
    setNewProduct((prev) => ({
      ...prev,
      barcode,
      sku: prev.sku || barcode,
    }));
    requestAnimationFrame(() => newBarcodeInputRef.current?.focus());
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('auto_create') !== '1') return;

    const barcode = (params.get('barcode') || '').trim();
    if (!barcode) return;

    openNewRowForScannedBarcode(barcode);
    clearMissingProductIntent();
    navigate('/products', { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('auto_create') === '1') return;

    const intent = peekMissingProductIntent();
    if (!intent?.barcode) return;

    openNewRowForScannedBarcode(intent.barcode);
    clearMissingProductIntent();
  }, [location.search]);

  const loadProducts = async () => {
    if (!currentOutlet?.id) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    const outletId = currentOutlet.id;
    const requestId = ++loadRequestRef.current;

    try {
      setIsLoading(true);
      const cached = await posService.getCachedProducts(outletId, {
        search: searchQuery || undefined,
        category: selectedCategory || undefined,
        activeOnly: false, // Show all products including inactive
        page: 1,
        size: 20000
      });
      if (requestId !== loadRequestRef.current) return;

      const hasCached = (cached.items || []).length > 0;
      setProducts(cached.items || []);
      setError(null);
      setIsLoading(false);

      const isOnlineNow = typeof navigator === 'undefined' ? true : navigator.onLine;
      const shouldSyncFromBackend = !searchQuery.trim();
      if (!isOnlineNow || !shouldSyncFromBackend) return;

      void (async () => {
        try {
          await posService.syncProductCatalog(outletId, { forceFull: !hasCached });
          const refreshed = await posService.getCachedProducts(outletId, {
            search: searchQuery || undefined,
            category: selectedCategory || undefined,
            activeOnly: false,
            page: 1,
            size: 20000
          });
          if (requestId !== loadRequestRef.current) return;
          setProducts(refreshed.items || []);
        } catch (syncErr) {
          if (requestId !== loadRequestRef.current) return;
          console.error('Background product sync failed:', syncErr);
          if (!hasCached) {
            setError('No products found for this outlet. Add your first product to begin.');
          }
        }
      })();
    } catch (err) {
      if (requestId !== loadRequestRef.current) return;
      console.error('Failed to load products:', err);
      setError('Failed to load products from server/cache. Check connection and try again.');
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const handleCellEdit = (productId: string, field: keyof POSProduct, value: any) => {
    setProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, [field]: value } : p
    ));
  };

  const handleNewProductChange = (field: keyof POSProduct, value: any) => {
    setNewProduct(prev => ({ ...prev, [field]: value }));
  };

  const saveProduct = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    try {
      await posService.updateProduct(productId, product);
      setEditingRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
      setError(null);
    } catch (error) {
      console.error('Failed to save product:', error);
      setError('Failed to save product changes. Please try again.');
    }
  };

  const addNewProduct = async () => {
    if (!currentOutlet?.id || !newProduct.name) return;

    try {
      const productToCreate = {
        outlet_id: currentOutlet.id,
        sku: newProduct.sku || `SKU-${Date.now()}`,
        name: newProduct.name!,
        description: newProduct.description,
        category: newProduct.category || 'Other',
        unit_price: newProduct.unit_price || 0,
        cost_price: newProduct.cost_price || 0,
        quantity_on_hand: newProduct.quantity_on_hand || 0,
        reorder_level: newProduct.reorder_level || 0,
        reorder_quantity: newProduct.reorder_quantity || 0,
        tax_rate: 0.075,
        barcode: newProduct.barcode
      };

      await posService.createProduct(productToCreate);
      setNewProduct({});
      setShowNewRow(false);
      setError(null);
      await loadProducts();
    } catch (error) {
      console.error('Failed to add product:', error);
      setError('Failed to add product. Please check required fields and try again.');
    }
  };

  const toggleSelectProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const selectAllProducts = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  // Handle add product via prop or internal state
  const handleShowNewRow = () => {
    if (onShowNewRow) {
      onShowNewRow();
    }
    setShowNewRow(true);
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleShowNewRow,
    refresh: loadProducts
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Filters */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search products, SKU, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <button
            onClick={loadProducts}
            className="touch-target-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Excel-like Table */}
      <div className="p-8">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        <div className="bg-white rounded-xl shadow-medium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-12 p-4">
                    <input
                      type="checkbox"
                      checked={selectedProducts.size === products.length && products.length > 0}
                      onChange={selectAllProducts}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="text-left p-4 font-semibold text-slate-900">SKU</th>
                  <th className="text-left p-4 font-semibold text-slate-900">Barcode</th>
                  <th className="text-left p-4 font-semibold text-slate-900">Product Name</th>
                  <th className="text-left p-4 font-semibold text-slate-900">Category</th>
                  <th className="text-right p-4 font-semibold text-slate-900">Cost Price</th>
                  <th className="text-right p-4 font-semibold text-slate-900">Selling Price</th>
                  <th className="text-right p-4 font-semibold text-slate-900">Stock</th>
                  <th className="text-right p-4 font-semibold text-slate-900">Reorder Level</th>
                  <th className="text-center p-4 font-semibold text-slate-900">Status</th>
                  <th className="w-16 p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* New Product Row */}
                {showNewRow && (
                  <tr className="bg-blue-50 border-2 border-blue-200">
                    <td className="p-4">
                      <Package className="w-5 h-5 text-blue-600" />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="Auto-generated"
                        value={newProduct.sku || ''}
                        onChange={(e) => handleNewProductChange('sku', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        ref={newBarcodeInputRef}
                        type="text"
                        placeholder="Scan or type barcode"
                        value={newProduct.barcode || ''}
                        onChange={(e) => handleNewProductChange('barcode', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="Product name *"
                        value={newProduct.name || ''}
                        onChange={(e) => handleNewProductChange('name', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm"
                        required
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={newProduct.category || ''}
                        onChange={(e) => handleNewProductChange('category', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm"
                      >
                        <option value="">Select Category</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={newProduct.cost_price || ''}
                        onChange={(e) => handleNewProductChange('cost_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm text-right"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={newProduct.unit_price || ''}
                        onChange={(e) => handleNewProductChange('unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm text-right"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        placeholder="0"
                        value={newProduct.quantity_on_hand || ''}
                        onChange={(e) => handleNewProductChange('quantity_on_hand', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm text-right"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        placeholder="0"
                        value={newProduct.reorder_level || ''}
                        onChange={(e) => handleNewProductChange('reorder_level', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm text-right"
                      />
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        New
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={addNewProduct}
                          className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                          title="Save"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setShowNewRow(false);
                            setNewProduct({});
                          }}
                          className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                          title="Cancel"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Existing Products */}
                {products.map(product => {
                  const isEditing = editingRows.has(product.id);
                  const isSelected = selectedProducts.has(product.id);

                  return (
                    <tr key={product.id} className={`hover:bg-slate-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectProduct(product.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-4 font-mono text-sm text-slate-600">{product.sku}</td>
                      <td className="p-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={product.barcode || ''}
                            onChange={(e) => handleCellEdit(product.id, 'barcode', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono text-sm"
                          />
                        ) : (
                          <span className="font-mono text-sm text-slate-500">{product.barcode || '—'}</span>
                        )}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={product.name}
                            onChange={(e) => handleCellEdit(product.id, 'name', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <div>
                            <div className="font-medium text-slate-900">{product.name}</div>
                            {product.description && (
                              <div className="text-sm text-slate-500">{product.description}</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <select
                            value={product.category || ''}
                            onChange={(e) => handleCellEdit(product.id, 'category', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                          >
                            {categories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                            {product.category}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            value={product.cost_price}
                            onChange={(e) => handleCellEdit(product.id, 'cost_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-right"
                          />
                        ) : (
                          formatCurrency(product.cost_price || 0)
                        )}
                      </td>
                      <td className="p-4 text-right font-mono font-semibold">
                        {isEditing ? (
                          <input
                            type="number"
                            value={product.unit_price}
                            onChange={(e) => handleCellEdit(product.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-right"
                          />
                        ) : (
                          formatCurrency(product.unit_price)
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={product.quantity_on_hand}
                            onChange={(e) => handleCellEdit(product.id, 'quantity_on_hand', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-right"
                          />
                        ) : (
                          <span className={`font-semibold ${product.quantity_on_hand <= product.reorder_level
                              ? 'text-red-600'
                              : 'text-slate-900'
                            }`}>
                            {product.quantity_on_hand}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={product.reorder_level}
                            onChange={(e) => handleCellEdit(product.id, 'reorder_level', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-right"
                          />
                        ) : (
                          product.reorder_level
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${!product.is_active
                            ? 'bg-red-100 text-red-800'
                            : product.quantity_on_hand === 0
                              ? 'bg-red-100 text-red-800'
                              : product.quantity_on_hand <= product.reorder_level
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                          }`}>
                          {!product.is_active ? 'Inactive' :
                            product.quantity_on_hand === 0 ? 'Out of Stock' :
                              product.quantity_on_hand <= product.reorder_level ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveProduct(product.id)}
                                className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                                title="Save"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingRows(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(product.id);
                                    return newSet;
                                  });
                                  loadProducts(); // Revert changes
                                }}
                                className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                title="Cancel"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingRows(prev => new Set([...prev, product.id]));
                              }}
                              className="p-1 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {products.length === 0 && !isLoading && (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No products found</h3>
              <p className="text-slate-600 mb-6">Start by adding your first product to the inventory</p>
              <button
                onClick={() => setShowNewRow(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Add First Product
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-600">Loading products...</p>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedProducts.size > 0 && (
          <div className="mt-6 bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                {selectedProducts.size} product{selectedProducts.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-2">
                <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  Bulk Edit
                </button>
                <button className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors">
                  Delete Selected
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

ProductManagement.displayName = 'ProductManagement';

export default ProductManagement;
