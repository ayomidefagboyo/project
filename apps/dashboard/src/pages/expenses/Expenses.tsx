import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Filter, Search, Download, Receipt, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { apiClient } from '@/lib/apiClient';
import { formatCurrency, formatDate } from '@/lib/utils';

interface ExpenseRecord {
  id: string;
  outlet_id: string;
  date: string;
  amount: number;
  category: string;
  subcategory?: string | null;
  description: string;
  vendor_id?: string | null;
  payment_method?: string | null;
  status?: 'pending' | 'approved' | 'rejected' | string;
  created_at?: string | null;
}

interface ExpenseListResponse {
  items: ExpenseRecord[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const formatCategoryLabel = (value: string): string =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatStatusLabel = (value?: string | null): string => {
  const normalized = String(value || 'pending').trim().toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const Expenses: React.FC = () => {
  const { currentOutlet } = useOutlet();
  const PAGE_SIZE = 100;

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadExpenses = async () => {
    if (!currentOutlet?.id) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      let page = 1;
      let totalPages = 1;
      const loadedExpenses: ExpenseRecord[] = [];

      while (page <= totalPages) {
        const response = await apiClient.get<ExpenseListResponse>('/expenses/', {
          outlet_id: currentOutlet.id,
          page,
          size: PAGE_SIZE,
        });

        if (response.error || !response.data) {
          throw new Error(response.error || 'Failed to load expenses');
        }

        const pageItems = Array.isArray(response.data.items) ? response.data.items : [];
        loadedExpenses.push(...pageItems);
        totalPages = Math.max(1, Number(response.data.pages || 1));
        page += 1;
      }

      setExpenses(loadedExpenses);
    } catch (loadError) {
      console.error('Failed to load expenses:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load expenses');
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExpenses();
  }, [currentOutlet?.id]);

  const uniqueCategories = useMemo(
    () => Array.from(new Set(expenses.map((expense) => expense.category).filter(Boolean))).sort(),
    [expenses]
  );

  const filteredExpenses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return expenses.filter((expense) => {
      const categoryMatches = categoryFilter === 'all' || expense.category === categoryFilter;

      if (!query) {
        return categoryMatches;
      }

      const searchMatches =
        expense.description.toLowerCase().includes(query) ||
        String(expense.subcategory || '').toLowerCase().includes(query) ||
        String(expense.vendor_id || '').toLowerCase().includes(query) ||
        String(expense.category || '').toLowerCase().includes(query);

      return categoryMatches && searchMatches;
    });
  }, [expenses, searchTerm, categoryFilter]);

  const totals = useMemo(() => {
    const totalAmount = filteredExpenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
    const averageAmount = filteredExpenses.length > 0 ? totalAmount / filteredExpenses.length : 0;

    const categoryTotals = filteredExpenses.reduce<Record<string, number>>((accumulator, expense) => {
      const key = String(expense.category || 'uncategorized');
      accumulator[key] = (accumulator[key] || 0) + toNumber(expense.amount);
      return accumulator;
    }, {});

    const pendingAmount = filteredExpenses
      .filter((expense) => String(expense.status || '').toLowerCase() === 'pending')
      .reduce((sum, expense) => sum + toNumber(expense.amount), 0);

    const topCategoryEntry = Object.entries(categoryTotals).sort((left, right) => right[1] - left[1])[0];

    return {
      totalAmount,
      averageAmount,
      pendingAmount,
      topCategory: topCategoryEntry ? formatCategoryLabel(topCategoryEntry[0]) : 'None',
    };
  }, [filteredExpenses]);

  const handleExport = () => {
    if (filteredExpenses.length === 0) return;

    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Date', 'Description', 'Category', 'Subcategory', 'Payment Method', 'Status', 'Amount'],
      ...filteredExpenses.map((expense) => [
        expense.date,
        expense.description,
        expense.category,
        expense.subcategory || '',
        expense.payment_method || '',
        expense.status || 'pending',
        toNumber(expense.amount).toFixed(2),
      ]),
    ];

    const csv = rows.map((row) => row.map((value) => escape(value)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses-${currentOutlet?.name || 'outlet'}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteExpense = async (expense: ExpenseRecord) => {
    const confirmed = window.confirm(`Delete expense \"${expense.description}\"?`);
    if (!confirmed) return;

    try {
      setDeletingId(expense.id);
      const response = await apiClient.delete<{ message: string }>(`/expenses/${expense.id}`);
      if (response.error) {
        throw new Error(response.error);
      }

      setExpenses((previous) => previous.filter((entry) => entry.id !== expense.id));
    } catch (deleteError) {
      console.error('Failed to delete expense:', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete expense');
    } finally {
      setDeletingId(null);
    }
  };

  if (!currentOutlet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="card p-8 text-center">
            <Receipt className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">Select an outlet to manage expenses.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 rounded-xl flex items-center justify-center shadow-sm">
                <Receipt className="w-5 h-5 text-white dark:text-gray-900" />
              </div>
              <h1 className="text-3xl font-light text-gray-900 dark:text-white tracking-tight">Expenses</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-light">
              {currentOutlet.name} expense ledger
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => void loadExpenses()}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              asChild
              className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white border-0 px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              <Link to="/dashboard/expenses/create" className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Add Expense</span>
              </Link>
            </Button>
          </div>
        </div>

        {error && (
          <div className="card border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 p-4">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="card p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by description, category, or vendor reference..."
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-48 lg:w-56">
                <select
                  className="appearance-none w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="all">All Categories</option>
                  {uniqueCategories.map((category) => (
                    <option key={category} value={category}>
                      {formatCategoryLabel(category)}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                  <Filter className="w-4 h-4" />
                </div>
              </div>

              <Button variant="outline" className="w-full sm:w-auto" onClick={handleExport} disabled={filteredExpenses.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th scope="col" className="py-4 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="hidden px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:table-cell">
                    Category
                  </th>
                  <th scope="col" className="hidden px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider md:table-cell">
                    Payment
                  </th>
                  <th scope="col" className="hidden px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider lg:table-cell">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="relative py-4 pl-3 pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 px-4 text-gray-500 dark:text-gray-400">
                      Loading expenses...
                    </td>
                  </tr>
                )}

                {!loading && filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-4 pl-6 pr-3 text-sm font-medium text-gray-900 dark:text-white">
                      <div>{expense.description}</div>
                      {expense.subcategory && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{expense.subcategory}</div>
                      )}
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-gray-600 dark:text-gray-400 sm:table-cell">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                        {formatCategoryLabel(expense.category)}
                      </span>
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-gray-600 dark:text-gray-400 md:table-cell">
                      {formatCategoryLabel(String(expense.payment_method || 'cash'))}
                    </td>
                    <td className="hidden px-6 py-4 text-sm lg:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        String(expense.status || '').toLowerCase() === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                          : String(expense.status || '').toLowerCase() === 'rejected'
                            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                      }`}>
                        {formatStatusLabel(expense.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(expense.date)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-right text-gray-900 dark:text-white">
                      {formatCurrency(toNumber(expense.amount))}
                    </td>
                    <td className="relative py-4 pl-3 pr-6 text-right text-sm font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDeleteExpense(expense)}
                        disabled={deletingId === expense.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        {deletingId === expense.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </td>
                  </tr>
                ))}

                {!loading && filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-16 px-4">
                      <div className="flex flex-col items-center space-y-3">
                        <Receipt className="w-12 h-12 text-gray-400" />
                        <p className="text-gray-500 dark:text-gray-400 font-light">No expenses found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-medium mb-6 text-foreground tracking-tight">Expense Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Expenses</p>
                <p className="text-2xl font-light text-foreground tracking-tight">{formatCurrency(totals.totalAmount)}</p>
              </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Average Per Expense</p>
                <p className="text-2xl font-light text-foreground tracking-tight">{formatCurrency(totals.averageAmount)}</p>
              </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Pending Amount</p>
                <p className="text-2xl font-light text-amber-700 dark:text-amber-300 tracking-tight">{formatCurrency(totals.pendingAmount)}</p>
              </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Top Category</p>
                <p className="text-xl font-light text-foreground tracking-tight">{totals.topCategory}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Expenses;
