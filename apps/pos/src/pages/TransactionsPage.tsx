/**
 * Transactions Page – Full-page sales history
 * Modeled after Square POS Transactions view
 */

import React, { useState, useEffect } from 'react';
import { Search, Eye, RotateCcw, Filter, ChevronDown, Receipt, X } from 'lucide-react';
import { posService } from '../lib/posService';
import { useOutlet } from '../contexts/OutletContext';
import { useToast } from '../components/ui/Toast';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

interface Transaction {
  id: string;
  transaction_number: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  payment_method: string;
  transaction_date: string;
  cashier_id: string;
  customer_name?: string;
  status: string;
  receipt_printed: boolean;
  tendered_amount?: number;
  change_amount?: number;
  payment_reference?: string;
  notes?: string;
}

const TransactionsPage: React.FC = () => {
  const { currentOutlet } = useOutlet();
  const { success, error: showError } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidReason, setVoidReason] = useState('');

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
    if (currentOutlet?.id) {
      loadTransactions();
    }
  }, [currentOutlet?.id, selectedDate]);

  const loadTransactions = async () => {
    if (!currentOutlet?.id) return;
    setIsLoading(true);
    try {
      const result = await posService.getTransactions(currentOutlet.id, {
        date_from: selectedDate,
        date_to: selectedDate,
        size: 200
      });
      setTransactions(result.items || []);
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
      cash:     { label: 'Cash',     cls: 'bg-green-100 text-green-800' },
      transfer: { label: 'Transfer', cls: 'bg-blue-100 text-blue-800' },
      pos:      { label: 'POS',      cls: 'bg-purple-100 text-purple-800' },
      credit:   { label: 'Credit',   cls: 'bg-amber-100 text-amber-800' },
      mobile:   { label: 'Mobile',   cls: 'bg-pink-100 text-pink-800' },
    };
    const info = map[method] || { label: method, cls: 'bg-gray-100 text-gray-800' };
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${info.cls}`}>{info.label}</span>;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'voided') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">Voided</span>;
    if (status === 'refunded') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Refunded</span>;
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">Completed</span>;
  };

  // Apply filters
  const filteredTransactions = transactions.filter(tx => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !tx.transaction_number.toLowerCase().includes(q) &&
        !tx.customer_name?.toLowerCase().includes(q) &&
        !tx.payment_method.toLowerCase().includes(q)
      ) return false;
    }
    if (paymentFilter !== 'all' && tx.payment_method !== paymentFilter) return false;
    if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
    return true;
  });

  // Summary
  const totalSales = filteredTransactions.filter(t => t.status !== 'voided').reduce((s, t) => s + t.total_amount, 0);
  const totalCount = filteredTransactions.filter(t => t.status !== 'voided').length;
  const voidedCount = filteredTransactions.filter(t => t.status === 'voided').length;

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
              onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search receipt #, customer..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Right: filters + refresh */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="all">All Payments</option>
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
              <option value="pos">POS</option>
              <option value="credit">Credit</option>
              <option value="mobile">Mobile</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
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

        {/* Summary bar */}
        <div className="flex items-center gap-6 mt-3 text-sm">
          <span className="text-gray-500">{formatFullDate(selectedDate)}</span>
          <span className="font-semibold text-gray-900">{totalCount} sale{totalCount !== 1 ? 's' : ''}</span>
          <span className="font-bold text-green-700">{formatCurrency(totalSales)}</span>
          {voidedCount > 0 && <span className="text-red-600">{voidedCount} voided</span>}
        </div>
      </div>

      {/* ─── Transaction List ─── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Receipt className="w-12 h-12 mb-3" />
            <p className="text-lg font-medium">No transactions found</p>
            <p className="text-sm mt-1">Try a different date or search term</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTransactions.map(tx => (
              <button
                key={tx.id}
                onClick={() => setSelectedTransaction(tx)}
                className={`w-full text-left bg-white border rounded-lg px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all ${
                  tx.status === 'voided' ? 'opacity-60 border-red-200' : 'border-gray-200'
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

              {/* Payment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Payment</p>
                  <div>{getPaymentBadge(selectedTransaction.payment_method)}</div>
                </div>
                {selectedTransaction.customer_name && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Customer</p>
                    <p className="text-sm font-medium text-gray-900">{selectedTransaction.customer_name}</p>
                  </div>
                )}
              </div>

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
