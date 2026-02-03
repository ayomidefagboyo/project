/**
 * Product Management - Excel-like bulk product management
 * Swiss Premium Design with touch optimization
 */

import React, { useState, useEffect } from 'react';
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
import { useOutlet } from '../../contexts/OutletContext';
import { Link } from 'react-router-dom';

const ProductManagement: React.FC = () => {
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
  }, [currentOutlet, searchQuery, selectedCategory]);

  const loadProducts = async () => {
    if (!currentOutlet?.id) return;

    try {
      setIsLoading(true);
      const response = await posService.getProducts(currentOutlet.id, {
        search: searchQuery || undefined,
        category: selectedCategory || undefined,
        activeOnly: false, // Show all products including inactive
        size: 100 // API max limit
      });

      setProducts(response?.items || []);
      setError(null);
    } catch (err) {
      // Fallback to mock data when API is not available
      console.warn('API not available, using mock data:', err);
      const mockProducts = [
        {
          id: '1', outlet_id: currentOutlet.id, sku: 'COCA-001', barcode: '123456789012',
          name: 'Coca Cola 350ml', description: 'Classic Coca Cola soft drink', category: 'Beverages',
          unit_price: 250.00, cost_price: 180.00, tax_rate: 0.075, quantity_on_hand: 48,
          reorder_level: 10, reorder_quantity: 50, is_active: true, vendor_id: 'vendor-1',
          image_url: '', display_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        },
        {
          id: '2', outlet_id: currentOutlet.id, sku: 'RICE-001', barcode: '234567890123',
          name: 'Uncle Bens Rice 5kg', description: 'Premium long grain rice', category: 'Food & Groceries',
          unit_price: 4500.00, cost_price: 3200.00, tax_rate: 0.075, quantity_on_hand: 25,
          reorder_level: 5, reorder_quantity: 20, is_active: true, vendor_id: 'vendor-2',
          image_url: '', display_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        },
        {
          id: '3', outlet_id: currentOutlet.id, sku: 'BREAD-001', barcode: '345678901234',
          name: 'Fresh Bread Loaf', description: 'Daily fresh white bread', category: 'Food & Groceries',
          unit_price: 450.00, cost_price: 280.00, tax_rate: 0.075, quantity_on_hand: 35,
          reorder_level: 10, reorder_quantity: 40, is_active: true, vendor_id: 'vendor-3',
          image_url: '', display_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        },
        {
          id: '4', outlet_id: currentOutlet.id, sku: 'MILK-001', barcode: '456789012345',
          name: 'Peak Milk 400g', description: 'Peak full cream milk powder', category: 'Food & Groceries',
          unit_price: 1200.00, cost_price: 950.00, tax_rate: 0.075, quantity_on_hand: 22,
          reorder_level: 8, reorder_quantity: 30, is_active: true, vendor_id: 'vendor-4',
          image_url: '', display_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        },
        {
          id: '5', outlet_id: currentOutlet.id, sku: 'SOAP-001', barcode: '567890123456',
          name: 'OMO Detergent 500g', description: 'OMO washing powder', category: 'Household Items',
          unit_price: 850.00, cost_price: 620.00, tax_rate: 0.075, quantity_on_hand: 18,
          reorder_level: 6, reorder_quantity: 25, is_active: true, vendor_id: 'vendor-5',
          image_url: '', display_order: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        }
      ];

      // Add any localStorage products
      const localStorageProducts = JSON.parse(localStorage.getItem('mockProducts') || '[]');
      const allProducts = [...mockProducts, ...localStorageProducts];

      // Apply filters
      let filteredProducts = allProducts;
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        filteredProducts = filteredProducts.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.sku.toLowerCase().includes(searchLower) ||
          p.barcode?.toLowerCase().includes(searchLower)
        );
      }
      if (selectedCategory) {
        filteredProducts = filteredProducts.filter(p => p.category === selectedCategory);
      }

      setProducts(filteredProducts);
      setError(null);
    } finally {
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
    } catch (error) {
      console.warn('API not available, saving to localStorage');
      // Save to localStorage for mock functionality
      const localProducts = JSON.parse(localStorage.getItem('mockProducts') || '[]');
      const updatedProducts = localProducts.map((p: any) => p.id === productId ? product : p);
      localStorage.setItem('mockProducts', JSON.stringify(updatedProducts));

      setEditingRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
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
      await loadProducts();
    } catch (error) {
      console.warn('API not available, adding to localStorage');
      // Add to localStorage for mock functionality
      const newProd = {
        id: `mock-${Date.now()}`,
        outlet_id: currentOutlet.id,
        ...newProduct,
        sku: newProduct.sku || `SKU-${Date.now()}`,
        name: newProduct.name!,
        category: newProduct.category || 'Other',
        unit_price: newProduct.unit_price || 0,
        cost_price: newProduct.cost_price || 0,
        quantity_on_hand: newProduct.quantity_on_hand || 0,
        reorder_level: newProduct.reorder_level || 0,
        reorder_quantity: newProduct.reorder_quantity || 0,
        tax_rate: 0.075,
        is_active: true,
        image_url: '',
        display_order: Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const localProducts = JSON.parse(localStorage.getItem('mockProducts') || '[]');
      localProducts.push(newProd);
      localStorage.setItem('mockProducts', JSON.stringify(localProducts));

      setNewProduct({});
      setShowNewRow(false);
      await loadProducts();
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="touch-target-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Product Management</h1>
              <p className="text-slate-600 mt-1">Manage your inventory with Excel-like efficiency</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button className="btn-action">
              <Upload className="w-5 h-5" />
              <span>Import</span>
            </button>
            <button className="btn-action">
              <Download className="w-5 h-5" />
              <span>Export</span>
            </button>
            <button
              onClick={() => setShowNewRow(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4 mt-6">
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
};

export default ProductManagement;