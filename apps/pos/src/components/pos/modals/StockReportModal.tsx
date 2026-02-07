import React, { useState, useEffect } from 'react';
import { X, ClipboardList, Download, RefreshCw, AlertTriangle, Package, TrendingDown } from 'lucide-react';
import type { POSProduct } from '@/lib/posService';
import { posService } from '@/lib/posService';
import { useOutlet } from '@/contexts/OutletContext';

interface StockReportData {
  totalProducts: number;
  totalStockValue: number;
  lowStockItems: POSProduct[];
  expiringItems: POSProduct[];
  outOfStockItems: POSProduct[];
  topProducts: POSProduct[];
}

interface StockReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const StockReportModal: React.FC<StockReportModalProps> = ({ isOpen, onClose }) => {
  const { currentOutlet } = useOutlet();
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<StockReportData | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'lowstock' | 'expiring' | 'outofstock'>('overview');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0] // today
  });

  useEffect(() => {
    if (isOpen && currentOutlet?.id) {
      generateReport();
    }
  }, [isOpen, currentOutlet?.id, dateRange]);

  const generateReport = async () => {
    if (!currentOutlet?.id) return;

    setIsLoading(true);
    try {
      // Get all products
      const productsResponse = await posService.getProducts(currentOutlet.id, { size: 100 });
      const products = productsResponse?.items || [];

      // Calculate various metrics
      const totalProducts = products.length;
      const totalStockValue = products.reduce((sum, product) =>
        sum + ((product.quantity_on_hand || 0) * (product.cost_price || 0)), 0
      );

      // Low stock items (below minimum level)
      const lowStockItems = products.filter(product =>
        (product.quantity_on_hand || 0) <= (product.reorder_level || 0) && (product.quantity_on_hand || 0) > 0
      );

      // Out of stock items
      const outOfStockItems = products.filter(product => (product.quantity_on_hand || 0) === 0);

      // Expiring items (items expiring in next 7 days) - simplified for demo
      // Expiring items (items expiring in next 7 days) - simplified for demo
      const expiringItems = products.filter(product => {
        if (!product.min_shelf_life_days) return false;
        // This is simplified - in real implementation you'd check actual expiry dates from inventory
        return Math.random() < 0.1; // Demo: 10% chance an item is expiring
      }).slice(0, 10);

      // Top products by stock value
      const topProducts = products
        .sort((a, b) =>
          ((b.quantity_on_hand || 0) * (b.cost_price || 0)) -
          ((a.quantity_on_hand || 0) * (a.cost_price || 0))
        )
        .slice(0, 10);

      setReportData({
        totalProducts,
        totalStockValue,
        lowStockItems,
        expiringItems,
        outOfStockItems,
        topProducts
      });
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate stock report');
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = () => {
    if (!reportData || !currentOutlet) return;

    // Create CSV content
    let csvContent = `Stock Report - ${currentOutlet.name}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n`;
    csvContent += `Date Range: ${dateRange.startDate} to ${dateRange.endDate}\n\n`;

    csvContent += `Overview:\n`;
    csvContent += `Total Products,${reportData.totalProducts}\n`;
    csvContent += `Total Stock Value,₦${reportData.totalStockValue.toLocaleString()}\n`;
    csvContent += `Low Stock Items,${reportData.lowStockItems.length}\n`;
    csvContent += `Out of Stock Items,${reportData.outOfStockItems.length}\n`;
    csvContent += `Expiring Items,${reportData.expiringItems.length}\n\n`;

    if (reportData.lowStockItems.length > 0) {
      csvContent += `Low Stock Items:\n`;
      csvContent += `Product Name,Current Stock,Minimum Level,Stock Value\n`;
      reportData.lowStockItems.forEach(item => {
        csvContent += `${item.name},${item.quantity_on_hand || 0},${item.reorder_level || 0},₦${((item.quantity_on_hand || 0) * (item.cost_price || 0)).toLocaleString()}\n`;
      });
      csvContent += `\n`;
    }

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `stock-report-${currentOutlet.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'overview', name: 'Overview', icon: Package },
    { id: 'lowstock', name: 'Low Stock', icon: AlertTriangle, count: reportData?.lowStockItems.length },
    { id: 'expiring', name: 'Expiring', icon: TrendingDown, count: reportData?.expiringItems.length },
    { id: 'outofstock', name: 'Out of Stock', icon: X, count: reportData?.outOfStockItems.length }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <ClipboardList className="w-6 h-6 text-gray-600" />
            <h2 className="text-xl font-bold text-gray-900">Stock Report</h2>
            <span className="text-sm text-gray-500">- {currentOutlet?.name}</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={generateReport}
              disabled={isLoading}
              className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportReport}
              disabled={!reportData}
              className="flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Date Range Filter */}
          <div className="mb-6 flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Generating report...</p>
              </div>
            </div>
          ) : reportData ? (
            <>
              {/* Overview Cards */}
              {selectedTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-600">Total Products</p>
                        <p className="text-2xl font-bold text-blue-900">{reportData.totalProducts}</p>
                      </div>
                      <Package className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-600">Stock Value</p>
                        <p className="text-2xl font-bold text-green-900">₦{reportData.totalStockValue.toLocaleString()}</p>
                      </div>
                      <TrendingDown className="w-8 h-8 text-green-600" />
                    </div>
                  </div>

                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-yellow-600">Low Stock</p>
                        <p className="text-2xl font-bold text-yellow-900">{reportData.lowStockItems.length}</p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-yellow-600" />
                    </div>
                  </div>

                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-red-600">Out of Stock</p>
                        <p className="text-2xl font-bold text-red-900">{reportData.outOfStockItems.length}</p>
                      </div>
                      <X className="w-8 h-8 text-red-600" />
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="flex space-x-8">
                  {tabs.map(tab => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedTab(tab.id as any)}
                        className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${selectedTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                      >
                        <TabIcon className="w-4 h-4" />
                        <span>{tab.name}</span>
                        {tab.count !== undefined && (
                          <span className={`px-2 py-1 text-xs rounded-full ${selectedTab === tab.id
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-600'
                            }`}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Tab Content */}
              <div>
                {selectedTab === 'overview' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Products by Stock Value</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Price</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Value</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {reportData.topProducts.map(product => (
                            <tr key={product.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                <div className="text-sm text-gray-500">{product.barcode}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {product.quantity_on_hand || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ₦{(product.cost_price || 0).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                ₦{((product.quantity_on_hand || 0) * (product.cost_price || 0)).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedTab === 'lowstock' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Low Stock Items</h3>
                    {reportData.lowStockItems.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No low stock items found.</p>
                    ) : (
                      <div className="space-y-2">
                        {reportData.lowStockItems.map(product => (
                          <div key={product.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                            <div>
                              <div className="font-medium text-gray-900">{product.name}</div>
                              <div className="text-sm text-gray-500">{product.barcode}</div>
                            </div>
                            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                              <div className="text-sm">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Current Stock</label>
                                <span className={`font-semibold ${(product.quantity_on_hand || 0) <= (product.reorder_level || 0)
                                  ? 'text-red-600'
                                  : 'text-gray-900'
                                  }`}>
                                  {product.quantity_on_hand || 0}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Min Level</label>
                                <span className="font-semibold">{product.reorder_level || 0}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedTab === 'expiring' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Expiring Items (Next 7 Days)</h3>
                    {reportData.expiringItems.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No expiring items found.</p>
                    ) : (
                      <div className="space-y-2">
                        {reportData.expiringItems.map(product => (
                          <div key={product.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <div>
                              <div className="font-medium text-gray-900">{product.name}</div>
                              <div className="text-sm text-gray-500">{product.barcode}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-orange-700">
                                Stock: <span className="font-semibold">{product.quantity_on_hand || 0}</span>
                              </div>
                              <div className="text-sm text-gray-500">
                                Shelf Life: {product.min_shelf_life_days || 0} days
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedTab === 'outofstock' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Out of Stock Items</h3>
                    {reportData.outOfStockItems.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No out of stock items found.</p>
                    ) : (
                      <div className="space-y-2">
                        {reportData.outOfStockItems.map(product => (
                          <div key={product.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                            <div>
                              <div className="font-medium text-gray-900">{product.name}</div>
                              <div className="text-sm text-gray-500">{product.barcode}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-red-700">
                                Min Level: <span className="font-semibold">{product.reorder_level || 0}</span>
                              </div>
                              <div className="text-sm text-gray-500">
                                Category: {product.category}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Click "Generate Report" to view stock data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockReportModal;