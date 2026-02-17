/**
 * Transactions Page – Full-page sales history
 * Modeled after Square POS Transactions view
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, RotateCcw, Receipt, X } from 'lucide-react';
import { posService, type POSTransaction, type PendingOfflineTransaction, PaymentMethod } from '../lib/posService';
import { useOutlet } from '../contexts/OutletContext';
import { useToast } from '../components/ui/Toast';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { printReceiptContent } from '../lib/receiptPrinter';
import type { ReceiptPrintStyle } from '../lib/receiptPrinter';
import type { ReceiptTemplate } from '../components/settings/ReceiptEditor';

// Extend base transaction type with UI-specific fields returned by API
interface ExtendedTransaction extends POSTransaction {
  offline_id?: string;
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
  const [isLoadingTransactionDetails, setIsLoadingTransactionDetails] = useState(false);
  const [pendingProductLookup, setPendingProductLookup] = useState<Record<string, { name: string; sku?: string }>>({});
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const requestIdRef = useRef(0);

  const matchesActiveFilters = useCallback(
    (tx: {
      transaction_date?: string;
      payment_method?: string;
      split_payments?: Array<{ method: string; amount: number; reference?: string }>;
      status?: string;
      transaction_number?: string;
      customer_name?: string;
    }): boolean => {
      if (selectedDate) {
        const txDate = tx.transaction_date ? tx.transaction_date.split('T')[0] : '';
        if (txDate !== selectedDate) return false;
      }
      const splitCount = Array.isArray(tx.split_payments) ? tx.split_payments.length : 0;
      const isSplit = splitCount > 1;
      if (paymentFilter === 'split') {
        if (!isSplit) return false;
      } else if (paymentFilter !== 'all') {
        if (isSplit || tx.payment_method !== paymentFilter) return false;
      }
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;

      const needle = searchQuery.trim().toLowerCase();
      if (needle) {
        const txn = tx.transaction_number?.toLowerCase() || '';
        const customer = tx.customer_name?.toLowerCase() || '';
        const payment = isSplit ? 'split' : (tx.payment_method?.toLowerCase() || '');
        if (!txn.includes(needle) && !customer.includes(needle) && !payment.includes(needle)) {
          return false;
        }
      }

      return true;
    },
    [selectedDate, paymentFilter, statusFilter, searchQuery]
  );

  const buildOfflineReceiptNumber = (offlineId: string, createdAt?: string): string => {
    const stamp = new Date(createdAt || Date.now()).toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const suffix = (offlineId.split('_').pop() || 'LOCAL').slice(0, 6).toUpperCase();
    return `OFF-${stamp}-${suffix}`;
  };

  const toPendingTransactionRow = (tx: PendingOfflineTransaction): ExtendedTransaction => {
    const createdAt = tx.created_at || new Date().toISOString();
    const subtotal = (tx.items || []).reduce((sum, item) => {
      const unit = Number(item.unit_price || 0);
      const qty = Number(item.quantity || 0);
      const lineDiscount = Number(item.discount_amount || 0);
      return sum + (unit * qty) - lineDiscount;
    }, 0);
    const transactionDiscount = Number(tx.discount_amount || 0);
    const total = Math.max(0, subtotal - transactionDiscount);
    const tendered = typeof tx.tendered_amount === 'number' ? tx.tendered_amount : total;

    return {
      id: tx.offline_id,
      offline_id: tx.offline_id,
      outlet_id: tx.outlet_id,
      transaction_number: buildOfflineReceiptNumber(tx.offline_id, createdAt),
      cashier_id: tx.cashier_id,
      customer_id: tx.customer_id,
      customer_name: tx.customer_name,
      subtotal,
      tax_amount: 0,
      discount_amount: transactionDiscount,
      total_amount: total,
      payment_method: tx.payment_method as any,
      tendered_amount: tendered,
      change_amount: Math.max(0, tendered - total),
      payment_reference: tx.payment_reference,
      status: 'pending' as any,
      transaction_date: createdAt,
      split_payments: tx.split_payments,
      items: (tx.items || []).map((item, index) => {
        const itemLookup = pendingProductLookup[item.product_id] || null;
        const unitPrice = Number(item.unit_price || 0);
        const quantity = Number(item.quantity || 0);
        const discountAmount = Number(item.discount_amount || 0);
        return {
          id: `${tx.offline_id}-${index}`,
          product_id: item.product_id,
          sku: itemLookup?.sku || '',
          product_name: itemLookup?.name || `Product ${index + 1}`,
          quantity,
          unit_price: unitPrice,
          discount_amount: discountAmount,
          tax_amount: 0,
          line_total: Math.max(0, unitPrice * quantity - discountAmount),
        };
      }),
      notes: tx.notes,
      receipt_printed: false,
      created_at: createdAt,
      cashier_name: 'Pending Sync',
    };
  };

  useEffect(() => {
    if (!currentOutlet?.id) {
      setPendingProductLookup({});
      return;
    }

    let cancelled = false;
    const hydratePendingNames = async () => {
      try {
        const cached = await posService.getCachedProducts(currentOutlet.id, {
          activeOnly: false,
          page: 1,
          size: 20000,
        });
        if (cancelled) return;
        const lookup: Record<string, { name: string; sku?: string }> = {};
        (cached.items || []).forEach((product) => {
          lookup[product.id] = { name: product.name, sku: product.sku };
        });
        setPendingProductLookup(lookup);
      } catch {
        if (!cancelled) {
          setPendingProductLookup({});
        }
      }
    };

    hydratePendingNames();
    return () => {
      cancelled = true;
    };
  }, [currentOutlet?.id]);

  const mergeWithPendingOffline = useCallback(
    (base: ExtendedTransaction[], pending: PendingOfflineTransaction[]): ExtendedTransaction[] => {
      const pendingRows = pending
        .filter((tx) => tx.outlet_id === currentOutlet?.id)
        .map(toPendingTransactionRow)
        .filter((tx) => matchesActiveFilters(tx));

      if (pendingRows.length === 0) return base;

      const seen = new Set(base.map((tx) => tx.id));
      const seenOfflineIds = new Set(
        base
          .map((tx) => (tx as ExtendedTransaction).offline_id)
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      );
      const merged = [
        ...pendingRows.filter((tx) => !seen.has(tx.id) && !(tx.offline_id && seenOfflineIds.has(tx.offline_id))),
        ...base
      ];
      merged.sort(
        (a, b) =>
          new Date(b.transaction_date || b.created_at || 0).getTime() -
          new Date(a.transaction_date || a.created_at || 0).getTime()
      );

      return merged;
    },
    [currentOutlet?.id, matchesActiveFilters, pendingProductLookup]
  );

  const filterLocalTransactions = useCallback(
    (data: POSTransaction[]): ExtendedTransaction[] => {
      return data.filter((tx) => matchesActiveFilters(tx)) as ExtendedTransaction[];
    },
    [matchesActiveFilters]
  );

  const loadTransactions = useCallback(async () => {
    if (!currentOutlet?.id) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    // 1) Local-first render (instant)
    try {
      setIsLoading(true);
      const [localData, pendingOffline] = await Promise.all([
        posService.getLocalTransactions(currentOutlet.id, 2000),
        posService.getPendingOfflineTransactions(),
      ]);

      if (requestId !== requestIdRef.current) return;

      const filteredLocal = filterLocalTransactions(localData);
      const mergedLocal = mergeWithPendingOffline(filteredLocal as ExtendedTransaction[], pendingOffline);
      const start = (currentPage - 1) * TRANSACTIONS_PAGE_SIZE;
      const pageData = mergedLocal.slice(start, start + TRANSACTIONS_PAGE_SIZE);
      setTransactions(pageData);
      setTotalCount(mergedLocal.length);
      setIsLoading(false);
    } catch (localErr) {
      console.error('Local transaction cache failed:', localErr);
      if (requestId === requestIdRef.current) {
        setTransactions([]);
        setTotalCount(0);
      }
      setIsLoading(false);
    }

    // 2) Background server refresh
    try {
      const result = await posService.getTransactions(currentOutlet.id, {
        page: currentPage,
        size: TRANSACTIONS_PAGE_SIZE,
        date_from: selectedDate || undefined,
        date_to: selectedDate || undefined,
        payment_method:
          paymentFilter !== 'all' && paymentFilter !== 'split'
            ? (paymentFilter as PaymentMethod)
            : undefined,
        split_only: paymentFilter === 'split' ? true : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
      });

      if (requestId !== requestIdRef.current) return;

      const pendingOffline = await posService.getPendingOfflineTransactions();
      const mergedPage = mergeWithPendingOffline((result.items || []) as ExtendedTransaction[], pendingOffline);
      const pendingForOutlet = pendingOffline
        .filter((tx) => tx.outlet_id === currentOutlet.id)
        .map(toPendingTransactionRow)
        .filter((tx) => matchesActiveFilters(tx)).length;

      setTransactions(mergedPage.slice(0, TRANSACTIONS_PAGE_SIZE));
      setTotalCount((result.total || 0) + pendingForOutlet);
    } catch (err) {
      console.error('Error refreshing transactions from server:', err);
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    currentOutlet?.id,
    currentPage,
    selectedDate,
    paymentFilter,
    statusFilter,
    searchQuery,
    filterLocalTransactions,
    mergeWithPendingOffline,
    matchesActiveFilters,
  ]);

  const handleRefresh = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await posService.syncOfflineTransactions();
      } catch (syncErr) {
        console.error('Failed to sync pending offline transactions on refresh:', syncErr);
      }
    }
    await loadTransactions();
  }, [loadTransactions]);

  const openTransactionDetails = useCallback(async (tx: ExtendedTransaction) => {
    setSelectedTransaction(tx);
    setIsLoadingTransactionDetails(false);

    if (tx.status === 'pending') {
      return;
    }

    const hasLineItems = Array.isArray(tx.items) && tx.items.length > 0;
    if (hasLineItems) {
      return;
    }

    setIsLoadingTransactionDetails(true);
    try {
      const fullTransaction = await posService.getTransaction(tx.id);
      setSelectedTransaction((prev) => {
        if (!prev || prev.id !== tx.id) return prev;
        return { ...prev, ...(fullTransaction as ExtendedTransaction) };
      });
    } catch (err) {
      console.error('Failed to load transaction details:', err);
    } finally {
      setIsLoadingTransactionDetails(false);
    }
  }, []);

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

  useEffect(() => {
    const handleSyncedEvent = () => {
      if (!currentOutlet?.id) return;
      void loadTransactions();
    };

    window.addEventListener('pos-transactions-synced', handleSyncedEvent);
    return () => window.removeEventListener('pos-transactions-synced', handleSyncedEvent);
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
      pos: { label: 'Card', cls: 'bg-purple-100 text-purple-800' },
      credit: { label: 'Credit', cls: 'bg-amber-100 text-amber-800' },
      mobile: { label: 'Mobile', cls: 'bg-pink-100 text-pink-800' },
    };
    const normalized = String(method || '').toLowerCase();
    const info = map[normalized] || {
      label: getPaymentMethodLabel(String(method || '')),
      cls: 'bg-gray-100 text-gray-800',
    };
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${info.cls}`}>{info.label}</span>;
  };

  const getSplitPayments = (
    tx: Pick<ExtendedTransaction, 'split_payments'>
  ): Array<{ method: string; amount: number; reference?: string }> => {
    if (!Array.isArray(tx.split_payments)) return [];
    return tx.split_payments
      .map((entry) => ({
        method: String(entry.method || '').toLowerCase(),
        amount: Number(entry.amount || 0),
        reference: entry.reference,
      }))
      .filter((entry) => Number.isFinite(entry.amount) && entry.amount > 0 && !!entry.method);
  };

  const isSplitTransaction = (tx: Pick<ExtendedTransaction, 'split_payments'>): boolean =>
    getSplitPayments(tx).length > 1;

  const getPaymentMethodLabel = (method: string): string => {
    const normalized = method.toLowerCase();
    if (normalized === 'pos') return 'Card';
    if (normalized === 'cash') return 'Cash';
    if (normalized === 'transfer') return 'Transfer';
    if (normalized === 'credit') return 'Credit';
    if (normalized === 'mobile') return 'Mobile';
    return method;
  };

  const renderPaymentDisplay = (
    tx: Pick<ExtendedTransaction, 'payment_method' | 'split_payments'>,
    showBreakdown = false
  ) => {
    const splitPayments = getSplitPayments(tx);
    if (splitPayments.length > 1) {
      return (
        <div className="space-y-1">
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">Split</span>
          {showBreakdown && (
            <div className="space-y-1">
              {splitPayments.map((entry, index) => (
                <div key={`${entry.method}-${index}`} className="text-xs text-gray-700">
                  <span className="font-medium">{getPaymentMethodLabel(entry.method)}</span>
                  <span>{` ${formatCurrency(entry.amount)}`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return getPaymentBadge(tx.payment_method);
  };

  const sanitizeDisplayNote = (notes?: string | null): string | null => {
    if (!notes || typeof notes !== 'string') return null;
    const trimmed = notes.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        const candidate = (parsed as any).note || (parsed as any).notes || (parsed as any).message;
        if (typeof candidate === 'string' && candidate.trim()) {
          return candidate.trim();
        }
        return null;
      }
    } catch {
      // Keep plain text notes.
    }
    return trimmed;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'pending') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Pending Sync</span>;
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
    if (selectedTransaction.status === 'pending') {
      showError('Pending offline sale cannot be voided until it syncs.');
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

  const handleReprintReceipt = async () => {
    if (!selectedTransaction) return;
    if (selectedTransaction.status === 'pending') {
      showError('Pending offline sale cannot be reprinted until it syncs.');
      return;
    }

    try {
      setIsPrintingReceipt(true);
      const printResult = await posService.printReceipt(selectedTransaction.id, 1);
      if (!printResult?.receipt_content) {
        showError('Receipt content was empty.');
        return;
      }

      // Read template styling for the print window
      let printStyle: ReceiptPrintStyle | undefined;
      if (currentOutlet?.id) {
        try {
          const scopedRaw = localStorage.getItem(`pos-receipt-template:${currentOutlet.id}`);
          const raw = scopedRaw || localStorage.getItem('pos-receipt-template');
          if (raw) {
            const tpl = JSON.parse(raw) as ReceiptTemplate;
            if (tpl?.styling) {
              printStyle = {
                fontSize: tpl.styling.fontSize,
                fontFamily: tpl.styling.fontFamily,
                lineSpacing: tpl.styling.lineSpacing,
                paperWidth: tpl.styling.paperWidth,
              };
            }
          }
        } catch { /* ignore parse errors */ }
      }

      const printed = await printReceiptContent(printResult.receipt_content, {
        title: `Receipt ${selectedTransaction.transaction_number}`,
        copies: 1,
        style: printStyle,
      });
      if (!printed.success) {
        showError('Unable to open print flow. Allow pop-ups or configure native print bridge.');
        return;
      }
      success('Receipt print started.');
    } catch (err: any) {
      showError(err?.message || 'Failed to reprint receipt.');
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  const handleRefund = async () => {
    if (!selectedTransaction) return;
    if (selectedTransaction.status !== 'completed') {
      showError('Only completed transactions can be refunded.');
      return;
    }
    if ((selectedTransaction.receipt_type || '').toLowerCase() === 'return' || Number(selectedTransaction.total_amount) <= 0) {
      showError('This transaction cannot be refunded again.');
      return;
    }
    if (selectedTransaction.status === 'pending') {
      showError('Pending offline sale cannot be refunded until it syncs.');
      return;
    }

    try {
      setIsRefunding(true);
      await posService.refundTransaction(selectedTransaction.id, {
        return_reason: refundReason.trim() || 'Customer return',
        amount: Math.abs(Number(selectedTransaction.total_amount || 0)),
      });
      success('Refund processed successfully.');
      setShowRefundConfirm(false);
      setRefundReason('');
      setSelectedTransaction(null);
      await loadTransactions();
    } catch (err: any) {
      showError(err?.message || 'Failed to process refund.');
    } finally {
      setIsRefunding(false);
    }
  };

  useEffect(() => {
    setShowVoidConfirm(false);
    setVoidReason('');
    setShowRefundConfirm(false);
    setRefundReason('');
  }, [selectedTransaction?.id]);

  if (!currentOutlet) {
    return <div className="flex items-center justify-center h-full text-gray-500">Select an outlet to view transactions.</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50 overflow-hidden">
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
              <option value="split">Split</option>
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
              <option value="pending">Pending Sync</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
              <option value="refunded">Refunded</option>
            </select>
            <button
              onClick={() => void handleRefresh()}
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
                onClick={() => void openTransactionDetails(tx)}
                className={`w-full text-left bg-white border rounded-lg px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all ${tx.status === 'voided' ? 'opacity-60 border-red-200' : 'border-gray-200'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-mono font-semibold text-gray-800">{tx.transaction_number}</span>
                    {renderPaymentDisplay(tx)}
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
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => {
              setSelectedTransaction(null);
              setIsLoadingTransactionDetails(false);
            }}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Transaction Details</h3>
              <button
                onClick={() => {
                  setSelectedTransaction(null);
                  setIsLoadingTransactionDetails(false);
                }}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
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
                  <div>{renderPaymentDisplay(selectedTransaction, true)}</div>
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

              {/* Line Items */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Items</p>
                {isLoadingTransactionDetails ? (
                  <div className="text-sm text-gray-500">Loading items...</div>
                ) : (selectedTransaction.items || []).length > 0 ? (
                  <div className="space-y-2">
                    {(selectedTransaction.items || []).map((item, index) => {
                      const lineTotal = Number(
                        item.line_total ?? (Number(item.unit_price || 0) * Number(item.quantity || 0) - Number(item.discount_amount || 0))
                      );
                      return (
                        <div key={item.id || `${item.product_id}-${index}`} className="rounded-lg border border-gray-200 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {item.product_name || item.sku || `Product ${index + 1}`}
                              </p>
                              <p className="text-xs text-gray-500">
                                {Number(item.quantity || 0)} × {formatCurrency(Number(item.unit_price || 0))}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{formatCurrency(lineTotal)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No line items recorded.</div>
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
              {sanitizeDisplayNote(selectedTransaction.notes) && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{sanitizeDisplayNote(selectedTransaction.notes)}</p>
                </div>
              )}
            </div>

            {/* Drawer footer */}
            {selectedTransaction.status !== 'pending' && (
              <div className="px-5 py-4 border-t border-gray-100">
                {!showVoidConfirm && !showRefundConfirm ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={handleReprintReceipt}
                      disabled={isPrintingReceipt}
                      className="py-2.5 border border-blue-200 text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-colors text-sm disabled:opacity-60"
                    >
                      {isPrintingReceipt ? 'Printing...' : 'Reprint Receipt'}
                    </button>
                    <button
                      onClick={() => {
                        setShowRefundConfirm(true);
                        setShowVoidConfirm(false);
                      }}
                      disabled={
                        selectedTransaction.status !== 'completed' ||
                        (selectedTransaction.receipt_type || '').toLowerCase() === 'return' ||
                        Number(selectedTransaction.total_amount) <= 0
                      }
                      className="py-2.5 border border-amber-200 text-amber-700 font-semibold rounded-xl hover:bg-amber-50 transition-colors text-sm disabled:opacity-60"
                    >
                      Refund
                    </button>
                    <button
                      onClick={() => {
                        setShowVoidConfirm(true);
                        setShowRefundConfirm(false);
                      }}
                      disabled={selectedTransaction.status === 'voided'}
                      className="py-2.5 border-2 border-red-200 text-red-700 font-semibold rounded-xl hover:bg-red-50 transition-colors text-sm disabled:opacity-60"
                    >
                      Void Transaction
                    </button>
                  </div>
                ) : showVoidConfirm ? (
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
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-amber-800">Confirm refund for this transaction.</p>
                    <textarea
                      value={refundReason}
                      onChange={e => setRefundReason(e.target.value)}
                      placeholder="Reason for refund..."
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleRefund}
                        disabled={isRefunding}
                        className="flex-1 py-2 bg-amber-600 text-white font-semibold rounded-lg text-sm hover:bg-amber-700 disabled:opacity-60"
                      >
                        {isRefunding ? 'Processing...' : 'Confirm Refund'}
                      </button>
                      <button
                        onClick={() => { setShowRefundConfirm(false); setRefundReason(''); }}
                        className="flex-1 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg text-sm hover:bg-gray-300"
                      >
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
