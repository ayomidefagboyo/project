/**
 * Transaction History Component
 * View and manage past transactions
 */

import React, { useState, useEffect } from 'react';
import { X, Search, Eye, RotateCcw } from 'lucide-react';
import { posService, PaymentMethod } from '../../lib/posService';

interface Transaction {
  id: string;
  transaction_number: string;
  total_amount: number;
  payment_method: string;
  transaction_date: string;
  cashier_id: string;
  customer_name?: string;
  status: string;
  receipt_printed: boolean;
}

interface TransactionHistoryProps {
  outletId: string;
  isOpen: boolean;
  onClose: () => void;
  onViewTransaction?: (transactionId: string) => void;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  outletId,
  isOpen,
  onClose,
  onViewTransaction
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    if (isOpen && outletId) {
      loadTransactions();
    }
  }, [isOpen, outletId, selectedDate]);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const result = await posService.getTransactions(outletId, {
        date_from: selectedDate,
        date_to: selectedDate,
        size: 100
      });
      setTransactions(result.items || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredTransactions = transactions.filter(tx => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        tx.transaction_number.toLowerCase().includes(query) ||
        tx.customer_name?.toLowerCase().includes(query) ||
        tx.payment_method.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-200 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by transaction number, customer..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading transactions...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No transactions found</div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">{tx.transaction_number}</span>
                        {tx.status === 'voided' && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">VOIDED</span>
                        )}
                        {tx.receipt_printed && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">PRINTED</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {formatDate(tx.transaction_date)} · {tx.payment_method.toUpperCase()}
                        {tx.customer_name && ` · ${tx.customer_name}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-900">{formatCurrency(tx.total_amount)}</span>
                      <button
                        onClick={() => setSelectedTransaction(tx)}
                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transaction Details Modal */}
        {selectedTransaction && (
          <TransactionDetailsModal
            transaction={selectedTransaction}
            onClose={() => setSelectedTransaction(null)}
            onVoid={async () => {
              // Void functionality will be implemented
              await loadTransactions();
              setSelectedTransaction(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

interface TransactionDetailsModalProps {
  transaction: Transaction;
  onClose: () => void;
  onVoid: () => void;
}

const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  transaction,
  onClose,
  onVoid
}) => {
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      alert('Please provide a reason for voiding this transaction');
      return;
    }

    try {
      await posService.voidTransaction(transaction.id, voidReason);
      alert('Transaction voided successfully. Stock quantities have been restored.');
      onVoid();
      setShowVoidConfirm(false);
    } catch (error: any) {
      alert(`Failed to void transaction: ${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Transaction Details</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <span className="text-sm text-gray-500">Transaction Number:</span>
            <span className="ml-2 font-semibold">{transaction.transaction_number}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500">Date:</span>
            <span className="ml-2">{new Date(transaction.transaction_date).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500">Payment Method:</span>
            <span className="ml-2">{transaction.payment_method.toUpperCase()}</span>
          </div>
          {transaction.customer_name && (
            <div>
              <span className="text-sm text-gray-500">Customer:</span>
              <span className="ml-2">{transaction.customer_name}</span>
            </div>
          )}
          <div>
            <span className="text-sm text-gray-500">Total:</span>
            <span className="ml-2 font-bold text-lg">
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN'
              }).format(transaction.total_amount)}
            </span>
          </div>
        </div>

        {transaction.status !== 'voided' && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowVoidConfirm(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg"
            >
              Void Transaction
            </button>
          </div>
        )}

        {showVoidConfirm && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-semibold text-red-900 mb-2">Void Transaction?</p>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for voiding..."
              className="w-full px-3 py-2 border border-red-300 rounded-lg mb-3"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={handleVoid}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg"
              >
                Confirm Void
              </button>
              <button
                onClick={() => {
                  setShowVoidConfirm(false);
                  setVoidReason('');
                }}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionHistory;
