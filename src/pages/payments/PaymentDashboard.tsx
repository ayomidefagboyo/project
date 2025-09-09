import React, { useState, useEffect } from 'react';
import { Search, Filter, Clock, AlertCircle, CheckCircle, DollarSign, Calendar, User } from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { paymentService } from '@/lib/paymentService';
import { Payment, PaymentStatus, EnhancedInvoice, EnhancedVendor } from '@/types';
import Button from '@/components/ui/Button';

interface PaymentQueueItem {
  payment: Payment;
  invoice: EnhancedInvoice;
  vendor: EnhancedVendor;
  urgency: 'overdue' | 'due_soon' | 'normal';
  daysUntilDue: number;
}

interface GroupedPayments {
  vendor: EnhancedVendor;
  payments: PaymentQueueItem[];
  totalAmount: number;
  overdueAmount: number;
  dueSoonAmount: number;
}

const PaymentDashboard: React.FC = () => {
  const { currentOutlet, currentUser, hasPermission } = useOutlet();
  const [paymentQueue, setPaymentQueue] = useState<Record<string, GroupedPayments>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'overdue' | 'due_soon' | 'normal'>('all');
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());
  const [showGrouped, setShowGrouped] = useState(true);

  useEffect(() => {
    if (currentOutlet) {
      loadPaymentQueue();
    }
  }, [currentOutlet]);

  const loadPaymentQueue = async () => {
    if (!currentOutlet) return;
    
    try {
      setLoading(true);
      setError(null);

      if (showGrouped) {
        const { data, error } = await paymentService.getPaymentQueueGroupedByVendor(currentOutlet.id);
        if (error) throw new Error(error);
        setPaymentQueue(data || {});
      } else {
        const { data, error } = await paymentService.getPaymentQueue(currentOutlet.id);
        if (error) throw new Error(error);
        
        // Convert to grouped format for consistency
        const grouped: Record<string, GroupedPayments> = {};
        data?.forEach(item => {
          const vendorId = item.vendor.id;
          if (!grouped[vendorId]) {
            grouped[vendorId] = {
              vendor: item.vendor,
              payments: [],
              totalAmount: 0,
              overdueAmount: 0,
              dueSoonAmount: 0
            };
          }
          grouped[vendorId].payments.push(item);
          grouped[vendorId].totalAmount += item.payment.amount;
          if (item.urgency === 'overdue') {
            grouped[vendorId].overdueAmount += item.payment.amount;
          } else if (item.urgency === 'due_soon') {
            grouped[vendorId].dueSoonAmount += item.payment.amount;
          }
        });
        setPaymentQueue(grouped);
      }
    } catch (err) {
      console.error('Error loading payment queue:', err);
      setError(err instanceof Error ? err.message : 'Failed to load payment queue');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (paymentIds: string[]) => {
    if (!currentUser || !hasPermission('manage_expenses')) return;

    try {
      const { error } = await paymentService.markMultiplePaymentsAsPaid(paymentIds, {
        paidBy: currentUser.id,
        paymentMethod: 'bank_transfer',
        notes: 'Marked as paid from dashboard'
      });

      if (error) throw new Error(error);
      
      setSelectedPayments(new Set());
      await loadPaymentQueue();
    } catch (err) {
      console.error('Error marking payments as paid:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark payments as paid');
    }
  };

  const handlePaymentStatusChange = async (paymentId: string, status: PaymentStatus) => {
    if (!currentUser || !hasPermission('manage_expenses')) return;

    try {
      const { error } = await paymentService.updatePaymentStatus(paymentId, status, {
        paidBy: currentUser.id
      });

      if (error) throw new Error(error);
      await loadPaymentQueue();
    } catch (err) {
      console.error('Error updating payment status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update payment status');
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'overdue': return 'text-red-600 bg-red-50 border-red-200';
      case 'due_soon': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'overdue': return 'text-red-600 bg-red-50';
      case 'needs_clarification': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const filteredPaymentQueue = Object.entries(paymentQueue).filter(([vendorId, group]) => {
    const matchesSearch = group.vendor.name.toLowerCase().includes(searchTerm.toLowerCase());
    const hasMatchingPayments = group.payments.some(item => {
      const matchesStatus = statusFilter === 'all' || item.payment.status === statusFilter;
      const matchesUrgency = urgencyFilter === 'all' || item.urgency === urgencyFilter;
      return matchesStatus && matchesUrgency;
    });
    return matchesSearch && hasMatchingPayments;
  });

  const totalStats = Object.values(paymentQueue).reduce((acc, group) => ({
    totalAmount: acc.totalAmount + group.totalAmount,
    overdueAmount: acc.overdueAmount + group.overdueAmount,
    dueSoonAmount: acc.dueSoonAmount + group.dueSoonAmount,
    vendorCount: acc.vendorCount + 1
  }), { totalAmount: 0, overdueAmount: 0, dueSoonAmount: 0, vendorCount: 0 });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Payment Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage supplier payments and track payment status
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Pending</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${totalStats.totalAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Overdue</p>
                <p className="text-2xl font-bold text-red-600">
                  ${totalStats.overdueAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Due Soon</p>
                <p className="text-2xl font-bold text-orange-600">
                  ${totalStats.dueSoonAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <User className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Vendors</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalStats.vendorCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Filters and Actions */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative">
                <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search vendors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'all')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="needs_clarification">Needs Clarification</option>
                <option value="overdue">Overdue</option>
              </select>

              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value as 'all' | 'overdue' | 'due_soon' | 'normal')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Urgency</option>
                <option value="overdue">Overdue</option>
                <option value="due_soon">Due Soon</option>
                <option value="normal">Normal</option>
              </select>
            </div>

            <div className="flex gap-2">
              {selectedPayments.size > 0 && hasPermission('manage_expenses') && (
                <Button
                  onClick={() => handleMarkAsPaid(Array.from(selectedPayments))}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Mark {selectedPayments.size} as Paid
                </Button>
              )}
              
              <Button
                onClick={loadPaymentQueue}
                variant="outline"
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Payment Queue */}
        <div className="space-y-6">
          {filteredPaymentQueue.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 p-12 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                All Caught Up!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                No pending payments match your current filters.
              </p>
            </div>
          ) : (
            filteredPaymentQueue.map(([vendorId, group]) => (
              <div
                key={vendorId}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Vendor Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {group.vendor.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {group.vendor.email} • {group.vendor.phone}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${group.totalAmount.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {group.payments.length} payment{group.payments.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  
                  {(group.overdueAmount > 0 || group.dueSoonAmount > 0) && (
                    <div className="mt-4 flex gap-4">
                      {group.overdueAmount > 0 && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          ${group.overdueAmount.toLocaleString()} Overdue
                        </span>
                      )}
                      {group.dueSoonAmount > 0 && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          ${group.dueSoonAmount.toLocaleString()} Due Soon
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Payment Items */}
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {group.payments
                    .filter(item => {
                      const matchesStatus = statusFilter === 'all' || item.payment.status === statusFilter;
                      const matchesUrgency = urgencyFilter === 'all' || item.urgency === urgencyFilter;
                      return matchesStatus && matchesUrgency;
                    })
                    .map((item) => (
                      <div key={item.payment.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-750">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <input
                              type="checkbox"
                              checked={selectedPayments.has(item.payment.id)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedPayments);
                                if (e.target.checked) {
                                  newSelected.add(item.payment.id);
                                } else {
                                  newSelected.delete(item.payment.id);
                                }
                                setSelectedPayments(newSelected);
                              }}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                Invoice #{item.invoice.invoiceNumber}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Due: {new Date(item.invoice.dueDate).toLocaleDateString()}
                                {item.daysUntilDue !== null && (
                                  <span className="ml-2">
                                    ({item.daysUntilDue < 0 ? Math.abs(item.daysUntilDue) + ' days overdue' : 
                                      item.daysUntilDue === 0 ? 'Due today' : 
                                      item.daysUntilDue + ' days left'})
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                ${item.payment.amount.toLocaleString()}
                              </p>
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(item.urgency)}`}>
                                  {item.urgency.replace('_', ' ')}
                                </span>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.payment.status)}`}>
                                  {item.payment.status.replace('_', ' ')}
                                </span>
                              </div>
                            </div>

                            {hasPermission('manage_expenses') && (
                              <div className="flex space-x-2">
                                <select
                                  value={item.payment.status}
                                  onChange={(e) => handlePaymentStatusChange(item.payment.id, e.target.value as PaymentStatus)}
                                  className="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="partially_paid">Partially Paid</option>
                                  <option value="paid">Paid</option>
                                  <option value="needs_clarification">Needs Clarification</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentDashboard;