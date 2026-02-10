import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    Search,
    Filter,
    Download,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    Banknote,
    Smartphone,
    CreditCard,
    Users,
    BarChart3
} from 'lucide-react';

interface SalesBreakdownModalProps {
    isOpen: boolean;
    onClose: () => void;
    salesBreakdown: any;
    formData: { date: string };
    selectedCashier: string;
    availableCashiers: any[];
    formatCurrency: (value: number) => string;
}

export const SalesBreakdownModal: React.FC<SalesBreakdownModalProps> = ({
    isOpen,
    onClose,
    salesBreakdown,
    formData,
    selectedCashier,
    availableCashiers,
    formatCurrency
}) => {
    // Transaction filtering and pagination states
    const [searchQuery, setSearchQuery] = useState('');
    const [paymentFilter, setPaymentFilter] = useState<string>('all');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [sortField, setSortField] = useState<'time' | 'amount' | 'items'>('time');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [showFilters, setShowFilters] = useState(false);

    // Filter, sort, and paginate transactions
    const { filteredTransactions, totalPages, stats } = useMemo(() => {
        if (!salesBreakdown?.breakdown?.transactions) {
            return { filteredTransactions: [], totalPages: 0, stats: { total: 0, filtered: 0 } };
        }

        let transactions = [...salesBreakdown.breakdown.transactions];
        const totalCount = transactions.length;

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            transactions = transactions.filter((tx: any) =>
                tx.transaction_number.toLowerCase().includes(query) ||
                tx.cashier_name.toLowerCase().includes(query)
            );
        }

        // Apply payment method filter
        if (paymentFilter !== 'all') {
            transactions = transactions.filter((tx: any) => tx.payment_method === paymentFilter);
        }

        // Apply amount range filter
        const min = minAmount ? parseFloat(minAmount) : null;
        const max = maxAmount ? parseFloat(maxAmount) : null;
        if (min !== null || max !== null) {
            transactions = transactions.filter((tx: any) => {
                const amount = parseFloat(tx.amount);
                if (min !== null && amount < min) return false;
                if (max !== null && amount > max) return false;
                return true;
            });
        }

        const filteredCount = transactions.length;

        // Apply sorting
        transactions.sort((a: any, b: any) => {
            let aVal, bVal;

            switch (sortField) {
                case 'time':
                    aVal = new Date(a.transaction_date).getTime();
                    bVal = new Date(b.transaction_date).getTime();
                    break;
                case 'amount':
                    aVal = parseFloat(a.amount);
                    bVal = parseFloat(b.amount);
                    break;
                case 'items':
                    aVal = a.items_count;
                    bVal = b.items_count;
                    break;
                default:
                    return 0;
            }

            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        });

        // Apply pagination
        const pages = Math.ceil(transactions.length / pageSize);
        const startIndex = (currentPage - 1) * pageSize;
        const paginatedTransactions = transactions.slice(startIndex, startIndex + pageSize);

        return {
            filteredTransactions: paginatedTransactions,
            totalPages: pages,
            stats: { total: totalCount, filtered: filteredCount }
        };
    }, [salesBreakdown, searchQuery, paymentFilter, minAmount, maxAmount, sortField, sortDirection, currentPage, pageSize]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, paymentFilter, minAmount, maxAmount, sortField, sortDirection, pageSize]);

    // Export transactions to CSV
    const exportToCSV = () => {
        if (!salesBreakdown?.breakdown?.transactions) return;

        const headers = ['Time', 'Transaction #', 'Cashier', 'Payment Method', 'Amount', 'Items', 'Tax', 'Discount'];
        const rows = salesBreakdown.breakdown.transactions.map((tx: any) => [
            new Date(tx.transaction_date).toLocaleString(),
            tx.transaction_number,
            tx.cashier_name,
            tx.payment_method,
            tx.amount,
            tx.items_count,
            tx.tax || 0,
            tx.discount || 0
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map((row: any[]) => row.map((cell: any) => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales-breakdown-${formData.date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleSort = (field: 'time' | 'amount' | 'items') => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const SortIcon = ({ field }: { field: 'time' | 'amount' | 'items' }) => {
        if (sortField !== field) return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
        return sortDirection === 'asc' ?
            <ChevronUp className="w-4 h-4 text-orange-600" /> :
            <ChevronDown className="w-4 h-4 text-orange-600" />;
    };

    const clearFilters = () => {
        setSearchQuery('');
        setPaymentFilter('all');
        setMinAmount('');
        setMaxAmount('');
    };

    if (!isOpen || !salesBreakdown) return null;

    const activeFiltersCount = [
        searchQuery.trim(),
        paymentFilter !== 'all',
        minAmount,
        maxAmount
    ].filter(Boolean).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden m-4 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-orange-50 to-white dark:from-gray-800 dark:to-gray-800">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Sales Breakdown - {formData.date}
                        </h2>
                        {selectedCashier ? (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Filtered by: {availableCashiers.find(c => c.id === selectedCashier)?.name}
                            </p>
                        ) : (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">All cashiers</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {salesBreakdown.breakdown.summary.total_transactions}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Total Transactions</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-200 dark:border-green-800">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {formatCurrency(salesBreakdown.breakdown.summary.total_amount)}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Total Sales</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                {formatCurrency(salesBreakdown.breakdown.summary.total_tax)}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Total Tax</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-red-200 dark:border-red-800">
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                                {formatCurrency(salesBreakdown.breakdown.summary.total_discount)}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Total Discount</div>
                        </div>
                    </div>
                </div>

                {/* Filters and Search */}
                <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col gap-4">
                        {/* Search and Filter Toggle */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Search by transaction # or cashier name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${showFilters || activeFiltersCount > 0
                                        ? 'bg-orange-600 text-white hover:bg-orange-700'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                <Filter className="w-5 h-5" />
                                Filters
                                {activeFiltersCount > 0 && (
                                    <span className="bg-white text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {activeFiltersCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Advanced Filters */}
                        {showFilters && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Payment Method
                                    </label>
                                    <select
                                        value={paymentFilter}
                                        onChange={(e) => setPaymentFilter(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    >
                                        <option value="all">All Methods</option>
                                        <option value="cash">Cash</option>
                                        <option value="pos">POS/Card</option>
                                        <option value="transfer">Transfer</option>
                                        <option value="mobile">Mobile</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Min Amount (₦)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={minAmount}
                                        onChange={(e) => setMinAmount(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Max Amount (₦)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="∞"
                                        value={maxAmount}
                                        onChange={(e) => setMaxAmount(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                {activeFiltersCount > 0 && (
                                    <div className="sm:col-span-3 flex justify-end">
                                        <button
                                            onClick={clearFilters}
                                            className="text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-medium"
                                        >
                                            Clear all filters
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Results Info */}
                        <div className="flex items-center justify-between text-sm">
                            <div className="text-gray-600 dark:text-gray-400">
                                Showing <span className="font-semibold text-gray-900 dark:text-white">{filteredTransactions.length}</span> of{' '}
                                <span className="font-semibold text-gray-900 dark:text-white">{stats.filtered}</span> filtered transactions
                                {stats.filtered !== stats.total && (
                                    <span className="text-gray-500"> (from {stats.total} total)</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-gray-600 dark:text-gray-400">Show:</label>
                                <select
                                    value={pageSize}
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                    className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={200}>200</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-900 sticky top-0 z-10">
                            <tr>
                                <th
                                    className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                                    onClick={() => handleSort('time')}
                                >
                                    <div className="flex items-center gap-2">
                                        Time
                                        <SortIcon field="time" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                                    Transaction #
                                </th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                                    Cashier
                                </th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                                    Payment
                                </th>
                                <th
                                    className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                                    onClick={() => handleSort('amount')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Amount
                                        <SortIcon field="amount" />
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                                    onClick={() => handleSort('items')}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        Items
                                        <SortIcon field="items" />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                        No transactions found matching your filters
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((tx: any) => (
                                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                                            {new Date(tx.transaction_date).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                                            {tx.transaction_number}
                                        </td>
                                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                                            {tx.cashier_name}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 capitalize">
                                                {tx.payment_method === 'cash' && <Banknote className="w-3.5 h-3.5" />}
                                                {tx.payment_method === 'pos' && <CreditCard className="w-3.5 h-3.5" />}
                                                {(tx.payment_method === 'transfer' || tx.payment_method === 'mobile') && <Smartphone className="w-3.5 h-3.5" />}
                                                {tx.payment_method === 'pos' ? 'POS/Card' : tx.payment_method}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white tabular-nums">
                                            {formatCurrency(tx.amount)}
                                        </td>
                                        <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">
                                            {tx.items_count}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                Page {currentPage} of {totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    First
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                </button>
                                <button
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Last
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
