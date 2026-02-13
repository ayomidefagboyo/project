import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Filter, Download, Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { posService, type POSTransaction } from '@/lib/posService';

const formatNaira = (amount: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2
  }).format(amount);
};

const Sales: React.FC = () => {
  const { currentOutlet, hasPermission } = useOutlet();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [transactions, setTransactions] = useState<POSTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    if (!currentOutlet?.id) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await posService.getTransactions(currentOutlet.id, { page: 1, size: 100 });
      setTransactions(response.items || []);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load sales transactions';
      setError(message);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentOutlet?.id]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const filteredSales = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return transactions.filter((sale) => {
      const items = sale.items || [];
      const matchesSearch = !normalizedSearch
        || sale.transaction_number.toLowerCase().includes(normalizedSearch)
        || (sale.customer_name || '').toLowerCase().includes(normalizedSearch)
        || items.some((item) => (item.product_name || '').toLowerCase().includes(normalizedSearch));

      const matchesStatus = filterStatus === 'all' || sale.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchTerm, filterStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'refunded': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'voided': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Cash';
      case 'pos': return 'Card';
      case 'transfer': return 'Transfer';
      case 'credit': return 'Credit';
      case 'mobile': return 'Mobile';
      default: return method;
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
        <div className="flex items-center gap-2">
          <Button variant="outline" className="flex items-center gap-2" onClick={() => void loadTransactions()}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          {hasPermission('create_sales') && (
            <Button className="flex items-center gap-2">
              <Eye size={16} />
              View POS
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by transaction number, customer, or product..."
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
            <option value="voided">Voided</option>
          </select>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter size={16} />
            Filters
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Download size={16} />
            Export
          </Button>
        </div>
      </div>

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
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400" colSpan={6}>
                    Loading transactions...
                  </td>
                </tr>
              ) : filteredSales.map((sale) => {
                const items = sale.items || [];
                return (
                  <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {sale.transaction_number}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {sale.customer_name ? sale.customer_name : 'Walk-in Customer'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {items.length} item{items.length !== 1 ? 's' : ''}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {items[0]?.product_name || 'No line items'}
                        {items.length > 1 ? ` +${items.length - 1} more` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatNaira(sale.total_amount || 0)}
                      </div>
                      {(sale.discount_amount || 0) > 0 && (
                        <div className="text-xs text-green-600">
                          -{formatNaira(sale.discount_amount || 0)} discount
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {getPaymentMethodLabel(sale.payment_method)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(sale.status)}`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(sale.transaction_date).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!isLoading && filteredSales.length === 0 && (
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
