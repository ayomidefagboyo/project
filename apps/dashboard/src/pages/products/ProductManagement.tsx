/**
 * Product Management Page - Excel-like interface for bulk product management
 * Nigerian Supermarket Focus
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  Edit3,
  Trash2,
  Save,
  X,
  Package,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileSpreadsheet,
  DollarSign,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { posService, POSProduct } from '@/lib/posService';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { offlineDatabase } from '@/lib/offlineDatabase';

interface ProductRow extends POSProduct {
  isEditing?: boolean;
  isNew?: boolean;
  hasErrors?: boolean;
  errors?: string[];
}

interface BulkProductData {
  name: string;
  barcode: string;
  category: string;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  min_stock_level: number;
  supplier_name: string;
  has_expiry: boolean;
  shelf_life_days?: number;
  description: string;
}

const ProductManagement: React.FC = () => {
  const { currentOutlet } = useOutlet();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkProducts, setBulkProducts] = useState<BulkProductData[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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

  // Comprehensive real-time sync for products and inventory
  const { isConnected, syncStats } = useRealtimeSync({
    outletId: currentOutlet?.id || '',
    enabled: !!currentOutlet?.id,
    onProductChange: async (action, data) => {
      console.log(`📦 Real-time: Product ${action}`, data);
      if (action === 'INSERT') {
        setProducts(prev => [data as ProductRow, ...prev]);
        if (currentOutlet?.id) await offlineDatabase.storeProducts([data]);
      } else if (action === 'UPDATE') {
        setProducts(prev => prev.map(p => p.id === data.id ? data as ProductRow : p));
        if (currentOutlet?.id) await offlineDatabase.storeProducts([data]);
      } else if (action === 'DELETE') {
        setProducts(prev => prev.filter(p => p.id !== data.id));
      }
    },
    onInventoryChange: (action, data) => {
      console.log(`📊 Real-time: Inventory ${action}`, data);
      // Refresh product list to reflect inventory changes
      if (action === 'INSERT' || action === 'UPDATE') {
        loadProducts();
      }
    }
  });

  // Load products
  useEffect(() => {
    if (currentOutlet?.id) {
      loadProducts();
    }
  }, [currentOutlet?.id]);

  const loadProducts = async () => {
    if (!currentOutlet?.id) {
      console.error('No outlet selected');
      setIsLoading(false);
      return;
    }

    console.log('📦 Loading products for outlet:', currentOutlet.name, '(ID:', currentOutlet.id + ')');
    setIsLoading(true);
    try {
      const response = await posService.getProducts(currentOutlet.id, {
        size: 1000,
        search: searchQuery || undefined,
        category: selectedCategory || undefined
      });
      
      if (response?.offline) {
        console.log('✅ Loaded', response.items.length, 'products from offline cache (shared with POS)');
      } else {
        console.log('✅ Loaded', response?.items?.length || 0, 'products from backend API');
      }
      
      setProducts(response?.items || []);
    } catch (error: any) {
      console.error('❌ Error loading products:', error.message);
      // Don't alert on offline fallback - let the service handle it gracefully
    } finally {
      setIsLoading(false);
    }
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    const matchesSupplier = !selectedSupplier || product.supplier_name === selectedSupplier;

    return matchesSearch && matchesCategory && matchesSupplier;
  });

  // Get unique suppliers
  const suppliers = Array.from(new Set(products.map(p => p.supplier_name).filter(Boolean)));

  // Add new product row
  const addNewProduct = () => {
    const newProduct: ProductRow = {
      id: `temp_${Date.now()}`,
      name: '',
      barcode: '',
      category: '',
      unit_price: 0,
      cost_price: 0,
      stock_quantity: 0,
      min_stock_level: 0,
      supplier_name: '',
      has_expiry: false,
      shelf_life_days: 0,
      description: '',
      tax_rate: 0.075, // 7.5% Nigerian VAT
      outlet_id: currentOutlet?.id || '',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isNew: true,
      isEditing: true
    };
    setProducts(prev => [newProduct, ...prev]);
  };

  // Update product field
  const updateProduct = (id: string, field: keyof ProductRow, value: any) => {
    setProducts(prev => prev.map(product =>
      product.id === id
        ? { ...product, [field]: value }
        : product
    ));
  };

  // Save product
  const saveProduct = async (product: ProductRow) => {
    if (!currentOutlet?.id) return;

    try {
      setIsSaving(true);

      if (product.isNew) {
        // Create new product
        const productData = {
          name: product.name,
          barcode: product.barcode,
          category: product.category,
          unit_price: product.unit_price,
          cost_price: product.cost_price,
          stock_quantity: product.stock_quantity,
          min_stock_level: product.min_stock_level,
          supplier_name: product.supplier_name,
          has_expiry: product.has_expiry,
          shelf_life_days: product.shelf_life_days,
          description: product.description,
          outlet_id: currentOutlet.id
        };

        await posService.createProduct(productData);
      } else {
        // Update existing product
        await posService.updateProduct(product.id, {
          name: product.name,
          unit_price: product.unit_price,
          cost_price: product.cost_price,
          min_stock_level: product.min_stock_level,
          supplier_name: product.supplier_name,
          description: product.description
        });
      }

      // Reload products
      await loadProducts();
      alert(product.isNew ? 'Product created successfully!' : 'Product updated successfully!');
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete product
  const deleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await posService.deleteProduct(id);
      await loadProducts();
      alert('Product deleted successfully!');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Name', 'Barcode', 'Category', 'Unit Price (₦)', 'Cost Price (₦)',
      'Stock Quantity', 'Min Stock Level', 'Supplier', 'Has Expiry',
      'Shelf Life (Days)', 'Description'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredProducts.map(product => [
        `"${product.name}"`,
        product.barcode,
        product.category,
        product.unit_price,
        product.cost_price,
        product.stock_quantity,
        product.min_stock_level,
        `"${product.supplier_name}"`,
        product.has_expiry ? 'Yes' : 'No',
        product.shelf_life_days || '',
        `"${product.description}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `products-${currentOutlet?.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate totals
  const totals = {
    totalProducts: filteredProducts.length,
    totalStockValue: filteredProducts.reduce((sum, p) => sum + ((p.stock_quantity || 0) * (p.cost_price || 0)), 0),
    totalSellingValue: filteredProducts.reduce((sum, p) => sum + ((p.stock_quantity || 0) * (p.unit_price || 0)), 0),
    lowStockItems: filteredProducts.filter(p => (p.stock_quantity || 0) <= (p.min_stock_level || 0)).length,
    outOfStockItems: filteredProducts.filter(p => (p.stock_quantity || 0) === 0).length
  };

  const potentialProfit = totals.totalSellingValue - totals.totalStockValue;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Product Management</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-gray-600">{currentOutlet?.name} • {totals.totalProducts} products</p>
              {/* Real-time sync status */}
              {isConnected ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full text-xs font-medium text-green-700">
                  <Wifi className="w-3 h-3" />
                  Live Sync
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-full text-xs font-medium text-gray-600">
                  <WifiOff className="w-3 h-3" />
                  Offline
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={addNewProduct}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </button>

            <button
              onClick={exportToCSV}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>

            <button
              onClick={loadProducts}
              disabled={isLoading}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>


        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-blue-600">{totals.totalProducts}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Low Stock</p>
                <p className="text-2xl font-bold text-red-600">{totals.lowStockItems}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search products or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Suppliers</option>
                {suppliers.map(supplier => (
                  <option key={supplier} value={supplier}>{supplier}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={loadProducts}
                className="w-full flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Filter className="w-4 h-4 mr-2" />
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barcode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Price (₦)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Selling Price (₦)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Value (₦)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-3" />
                      <span className="text-gray-500">Loading products...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                    No products found. Click "Add Product" to get started.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product, index) => {
                  const stockValue = (product.stock_quantity || 0) * (product.cost_price || 0);
                  const isLowStock = (product.stock_quantity || 0) <= (product.min_stock_level || 0);
                  const isOutOfStock = (product.stock_quantity || 0) === 0;

                  return (
                    <tr
                      key={product.id}
                      className={`${
                        product.isNew ? 'bg-blue-50' :
                        isOutOfStock ? 'bg-red-50' :
                        isLowStock ? 'bg-yellow-50' :
                        'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {product.isEditing ? (
                          <input
                            type="text"
                            value={product.name}
                            onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Product name"
                          />
                        ) : (
                          <div>
                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500">{product.description}</div>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.isEditing ? (
                          <input
                            type="text"
                            value={product.barcode}
                            onChange={(e) => updateProduct(product.id, 'barcode', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Barcode"
                          />
                        ) : (
                          product.barcode
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.isEditing ? (
                          <select
                            value={product.category}
                            onChange={(e) => updateProduct(product.id, 'category', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="">Select</option>
                            {categories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        ) : (
                          product.category
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.isEditing ? (
                          <input
                            type="number"
                            value={product.cost_price || 0}
                            onChange={(e) => updateProduct(product.id, 'cost_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="0.00"
                            step="0.01"
                          />
                        ) : (
                          `₦${(product.cost_price || 0).toLocaleString()}`
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.isEditing ? (
                          <input
                            type="number"
                            value={product.unit_price || 0}
                            onChange={(e) => updateProduct(product.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="0.00"
                            step="0.01"
                          />
                        ) : (
                          `₦${(product.unit_price || 0).toLocaleString()}`
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${
                            isOutOfStock ? 'text-red-600' : isLowStock ? 'text-yellow-600' : 'text-gray-900'
                          }`}>
                            {product.stock_quantity || 0}
                          </span>
                          {isOutOfStock && <AlertTriangle className="w-4 h-4 text-red-500 ml-1" />}
                          {isLowStock && !isOutOfStock && <AlertTriangle className="w-4 h-4 text-yellow-500 ml-1" />}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.isEditing ? (
                          <input
                            type="number"
                            value={product.min_stock_level || 0}
                            onChange={(e) => updateProduct(product.id, 'min_stock_level', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="0"
                          />
                        ) : (
                          product.min_stock_level || 0
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.isEditing ? (
                          <input
                            type="text"
                            value={product.supplier_name || ''}
                            onChange={(e) => updateProduct(product.id, 'supplier_name', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Supplier name"
                          />
                        ) : (
                          product.supplier_name
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ₦{stockValue.toLocaleString()}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {product.isEditing ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => saveProduct(product)}
                              disabled={isSaving}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (product.isNew) {
                                  setProducts(prev => prev.filter(p => p.id !== product.id));
                                } else {
                                  updateProduct(product.id, 'isEditing', false);
                                }
                              }}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => updateProduct(product.id, 'isEditing', true)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteProduct(product.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductManagement;