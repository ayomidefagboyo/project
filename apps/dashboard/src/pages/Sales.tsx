import React, { useState } from 'react';
import { Plus, Search, Filter, Download, Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { SalesTransaction, Permission } from '@/types';

const Sales: React.FC = () => {
  const { currentOutlet, hasPermission } = useOutlet();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Mock sales data - replace with actual API calls
  const mockSales: SalesTransaction[] = [
    {
      id: '1',
      outletId: '1',
      transactionNumber: 'SALE-001',
      customerId: '1',
      items: [
        { id: '1', productId: '1', productName: 'Organic Bananas', quantity: 2, unitPrice: 1.99, total: 3.98 },
        { id: '2', productId: '2', productName: 'Whole Milk', quantity: 1, unitPrice: 3.49, total: 3.49 }
      ],
      subtotal: 7.47,
      taxAmount: 0.66,
      discountAmount: 0.50,
      total: 7.63,
      paymentMethod: 'credit_card',
      cashierId: '1',
      status: 'completed',
      notes: 'Customer requested paper bag',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      outletId: '1',
      transactionNumber: 'SALE-002',
      customerId: undefined,
      items: [
        { id: '3', productId: '3', productName: 'Bread', quantity: 1, unitPrice: 2.99, total: 2.99 }
      ],
      subtotal: 2.99,
      taxAmount: 0.26,
      discountAmount: 0,
      total: 3.25,
      paymentMethod: 'cash',
      cashierId: '1',
      status: 'completed',
      notes: '',
      createdAt: '2024-01-15T11:15:00Z',
      updatedAt: '2024-01-15T11:15:00Z'
    }
  ];

  const filteredSales = mockSales.filter(sale => {
    const matchesSearch = sale.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sale.items.some(item => item.productName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || sale.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'refunded': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'credit_card': return '💳';
      case 'cash': return '💵';
      case 'debit_card': return '🏦';
      case 'mobile_payment': return '📱';
      default: return '💰';
    }
  };

  if (!currentOutlet) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">Please select an outlet to view sales.</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage sales transactions for {currentOutlet.name}
          </p>
        </div>
        {hasPermission('create_sales') && (
          <Button className="flex items-center gap-2">
            <Plus size={16} />
            New Sale
          </Button>
        )}
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by transaction number or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter size={16} />
            More Filters
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Download size={16} />
            Export
          </Button>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Transaction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {sale.transactionNumber}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {sale.customerId ? 'Customer Sale' : 'Walk-in Customer'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {sale.items[0]?.productName}
                      {sale.items.length > 1 && ` +${sale.items.length - 1} more`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      ${sale.total.toFixed(2)}
                    </div>
                    {sale.discountAmount > 0 && (
                      <div className="text-xs text-green-600">
                        -${sale.discountAmount.toFixed(2)} discount
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getPaymentMethodIcon(sale.paymentMethod)}</span>
                      <span className="text-sm text-gray-900 dark:text-white capitalize">
                        {sale.paymentMethod.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(sale.status)}`}>
                      {sale.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(sale.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      {hasPermission('view_sales') && (
                        <Button variant="ghost" size="sm" className="p-1">
                          <Eye size={16} />
                        </Button>
                      )}
                      {hasPermission('edit_sales') && (
                        <Button variant="ghost" size="sm" className="p-1">
                          <Edit size={16} />
                        </Button>
                      )}
                      {hasPermission('delete_sales') && (
                        <Button variant="ghost" size="sm" className="p-1 text-red-600 hover:text-red-700">
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredSales.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">
            {searchTerm || filterStatus !== 'all' ? 'No sales found matching your criteria.' : 'No sales transactions yet.'}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;

