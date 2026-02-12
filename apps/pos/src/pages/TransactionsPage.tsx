/**
 * Transactions Page – Full-page sales history
 * Modeled after Square POS Transactions view
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Search, RotateCcw, Receipt, X } from 'lucide-react';
import { posService, type POSTransaction, PaymentMethod } from '../lib/posService';
import { useOutlet } from '../contexts/OutletContext';
import { useToast } from '../components/ui/Toast';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

// Extend base transaction type with UI-specific fields returned by API
interface ExtendedTransaction extends POSTransaction {
  cashier_name?: string;
  receipt_type?: string;
  voided_by_name?: string;
  void_reason?: string;
  voided_at?: string;
}

const TRANSACTIONS_PAGE_SIZE = 100;

const TransactionsPage: React.FC = () => {
  const { currentOutlet } = useOutlet();
  const { success, error: showError } = useToast();

  const [transactions, setTransactions] = useState<ExtendedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<ExtendedTransaction | null>(null);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const filterLocalTransactions = useCallback(
    (data: POSTransaction[]): ExtendedTransaction[] => {
      const needle = searchQuery.trim().toLowerCase();
      return data.filter((tx) => {
        if (selectedDate) {
          const txDate = tx.transaction_date ? tx.transaction_date.split('T')[0] : '';
          if (txDate !== selectedDate) return false;
        }
        if (paymentFilter !== 'all' && tx.payment_method !== paymentFilter) return false;
        if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
        if (needle) {
          const txn = tx.transaction_number?.toLowerCase() || '';
          const customer = tx.customer_name?.toLowerCase() || '';
          const payment = tx.payment_method?.toLowerCase() || '';
          if (!txn.includes(needle) && !customer.includes(needle) && !payment.includes(needle)) {
            return false;
          }
        }
        return true;
      }) as ExtendedTransaction[];
    },
    [selectedDate, paymentFilter, statusFilter, searchQuery]
  );

  const loadTransactions = useCallback(async () => {
    if (!currentOutlet?.id) return;

    try {
      setIsLoading(true);
      const result = await posService.getTransactions(currentOutlet.id, {
        page: currentPage,
        size: TRANSACTIONS_PAGE_SIZE,
        date_from: selectedDate || undefined,
        date_to: selectedDate || undefined,
        payment_method:
          paymentFilter !== 'all' ? (paymentFilter as PaymentMethod) : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
      });

      setTransactions((result.items || []) as ExtendedTransaction[]);
      setTotalCount(result.total || 0);
    } catch (err) {
      console.error('Error loading transactions:', err);
      try {
        const localData = await posService.getLocalTransactions(currentOutlet.id, 1000);
        const filtered = filterLocalTransactions(localData);
        const start = (currentPage - 1) * TRANSACTIONS_PAGE_SIZE;
        const pageData = filtered.slice(start, start + TRANSACTIONS_PAGE_SIZE);
        setTransactions(pageData);
        setTotalCount(filtered.length);
      } catch (localErr) {
        console.error('Local cache also failed:', localErr);
        setTransactions([]);
        setTotalCount(0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    currentOutlet?.id,
    currentPage,
    selectedDate,
    paymentFilter,
    statusFilter,
    searchQuery,
    filterLocalTransactions,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCurrentPage(1);
      setSearchQuery(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [currentOutlet?.id]);

  // Real-time sync
  useRealtimeSync({
    outletId: currentOutlet?.id || '',
    enabled: !!currentOutlet?.id,
    onTransactionChange: (action, data) => {
      if (action === 'INSERT' && selectedDate === new Date().toISOString().split('T')[0]) {
        loadTransactions();
      } else if (action === 'UPDATE') {
        setTransactions(prev => prev.map(t => t.id === data.id ? { ...t, ...data } : t));
      }
    }
  });

  useEffect(() => {
    if (!currentOutlet?.id) return;
    loadTransactions();
  }, [currentOutlet?.id, loadTransactions]);

  const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(amount);

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  };

  const formatFullDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getPaymentBadge = (method: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      cash: { label: 'Cash', cls: 'bg-green-100 text-green-800' },
      transfer: { label: 'Transfer', cls: 'bg-blue-100 text-blue-800' },
      pos: { label: 'POS', cls: 'bg-purple-100 text-purple-800' },
      credit: { label: 'Credit', cls: 'bg-amber-100 text-amber-800' },
      mobile: { label: 'Mobile', cls: 'bg-pink-100 text-pink-800' },
    };
    const info = map[method] || { label: method, cls: 'bg-gray-100 text-gray-800' };
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${info.cls}`}>{info.label}</span>;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'voided') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">Voided</span>;
    if (status === 'refunded') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Refunded</span>;
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">Completed</span>;
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / TRANSACTIONS_PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * TRANSACTIONS_PAGE_SIZE + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(currentPage * TRANSACTIONS_PAGE_SIZE, totalCount);

  // Void handler
  const handleVoid = async () => {
    if (!selectedTransaction || !voidReason.trim()) {
      showError('Please provide a reason for voiding');
      return;
    }
    try {
      await posService.voidTransaction(selectedTransaction.id, voidReason);
      success('Transaction voided. Stock quantities restored.');
      setShowVoidConfirm(false);
      setVoidReason('');
      setSelectedTransaction(null);
      loadTransactions();
    } catch (err: any) {
      showError(`Failed to void: ${err.message}`);
    }
  };

  if (!currentOutlet) {
    return <div className="flex items-center justify-center h-full text-gray-500">Select an outlet to view transactions.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ─── Toolbar ─── */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          {/* Left: date picker + search */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              type="date"
              value={selectedDate}
              onChange={e => {
                setCurrentPage(1);
                setSelectedDate(e.target.value);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search receipt #, customer..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Right: filters + refresh */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={paymentFilter}
              onChange={e => {
                setCurrentPage(1);
                setPaymentFilter(e.target.value);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="all">All Payments</option>
              <option value="cash">Cash</option>
              <option value="pos">Card</option>
              <option value="transfer">Transfer</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => {
                setCurrentPage(1);
                setStatusFilter(e.target.value);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
              <option value="refunded">Refunded</option>
            </select>
            <button
              onClick={loadTransactions}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RotateCcw className={`w-4 h-4 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Transaction List ─── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Receipt className="w-12 h-12 mb-3" />
            <p className="text-lg font-medium">No transactions found</p>
            <p className="text-sm mt-1">Try a different date or search term</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map(tx => (
              <button
                key={tx.id}
                onClick={() => setSelectedTransaction(tx)}
                className={`w-full text-left bg-white border rounded-lg px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all ${tx.status === 'voided' ? 'opacity-60 border-red-200' : 'border-gray-200'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-mono font-semibold text-gray-800">{tx.transaction_number}</span>
                    {getPaymentBadge(tx.payment_method)}
                    {getStatusBadge(tx.status)}
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-sm text-gray-500">{formatTime(tx.transaction_date)}</span>
                    <span className={`text-base font-bold ${tx.status === 'voided' ? 'text-red-500 line-through' : 'text-gray-900'}`}>
                      {formatCurrency(tx.total_amount)}
                    </span>
                  </div>
                </div>
                {tx.customer_name && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{tx.customer_name}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 bg-white px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-sm text-gray-600">
          Showing {rangeStart}-{rangeEnd} of {totalCount}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1 || isLoading}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages || isLoading}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      {/* ─── Transaction Detail Drawer ─── */}
      {selectedTransaction && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelectedTransaction(null)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Transaction Details</h3>
              <button onClick={() => setSelectedTransaction(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Drawer content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Receipt # & Status */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Receipt Number</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-mono font-bold text-gray-900">{selectedTransaction.transaction_number}</span>
                  {getStatusBadge(selectedTransaction.status)}
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Date</p>
                  <p className="text-sm font-medium text-gray-900">{formatFullDate(selectedTransaction.transaction_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Time</p>
                  <p className="text-sm font-medium text-gray-900">{formatTime(selectedTransaction.transaction_date)}</p>
                </div>
              </div>

              {/* Payment & Receipt Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Payment</p>
                  <div>{getPaymentBadge(selectedTransaction.payment_method)}</div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Receipt Type</p>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                    {selectedTransaction.receipt_type || 'sale'}
                  </span>
                </div>
              </div>

              {/* Customer & Cashier */}
              {(selectedTransaction.customer_name || selectedTransaction.cashier_name) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedTransaction.customer_name && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Customer</p>
                      <p className="text-sm font-medium text-gray-900">{selectedTransaction.customer_name}</p>
                    </div>
                  )}
                  {selectedTransaction.cashier_name && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cashier</p>
                      <p className="text-sm font-medium text-gray-900">{selectedTransaction.cashier_name}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Amounts */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(selectedTransaction.subtotal || selectedTransaction.total_amount)}</span>
                </div>
                {selectedTransaction.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">{formatCurrency(selectedTransaction.tax_amount)}</span>
                  </div>
                )}
                {selectedTransaction.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount</span>
                    <span className="font-medium text-green-700">-{formatCurrency(selectedTransaction.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>{formatCurrency(selectedTransaction.total_amount)}</span>
                </div>
                {selectedTransaction.tendered_amount != null && selectedTransaction.tendered_amount > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Tendered</span>
                      <span>{formatCurrency(selectedTransaction.tendered_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Change</span>
                      <span>{formatCurrency(selectedTransaction.change_amount || 0)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Void Information */}
              {selectedTransaction.status === 'voided' && (
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-xs text-red-500 uppercase tracking-wide mb-2">Void Information</p>
                  {selectedTransaction.voided_by_name && (
                    <div className="mb-2">
                      <span className="text-sm font-medium text-red-900">Voided by: </span>
                      <span className="text-sm text-red-800">{selectedTransaction.voided_by_name}</span>
                    </div>
                  )}
                  {selectedTransaction.voided_at && (
                    <div className="mb-2">
                      <span className="text-sm font-medium text-red-900">Voided at: </span>
                      <span className="text-sm text-red-800">{formatFullDate(selectedTransaction.voided_at)} {formatTime(selectedTransaction.voided_at)}</span>
                    </div>
                  )}
                  {selectedTransaction.void_reason && (
                    <div>
                      <span className="text-sm font-medium text-red-900">Reason: </span>
                      <span className="text-sm text-red-800">{selectedTransaction.void_reason}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Reference / Notes */}
              {selectedTransaction.payment_reference && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Payment Reference</p>
                  <p className="text-sm font-mono text-gray-900">{selectedTransaction.payment_reference}</p>
                </div>
              )}
              {selectedTransaction.notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{selectedTransaction.notes}</p>
                </div>
              )}
            </div>

            {/* Drawer footer */}
            {selectedTransaction.status !== 'voided' && (
              <div className="px-5 py-4 border-t border-gray-100">
                {!showVoidConfirm ? (
                  <button
                    onClick={() => setShowVoidConfirm(true)}
                    className="w-full py-2.5 border-2 border-red-200 text-red-700 font-semibold rounded-xl hover:bg-red-50 transition-colors text-sm"
                  >
                    Void Transaction
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-red-800">Are you sure? This will restore stock.</p>
                    <textarea
                      value={voidReason}
                      onChange={e => setVoidReason(e.target.value)}
                      placeholder="Reason for voiding..."
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button onClick={handleVoid} className="flex-1 py-2 bg-red-600 text-white font-semibold rounded-lg text-sm hover:bg-red-700">
                        Confirm Void
                      </button>
                      <button onClick={() => { setShowVoidConfirm(false); setVoidReason(''); }} className="flex-1 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg text-sm hover:bg-gray-300">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TransactionsPage;
