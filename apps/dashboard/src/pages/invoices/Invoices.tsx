import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  RefreshCw,
  Store,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

type InvoiceStatus = 'draft' | 'pending' | 'received' | 'paid' | 'overdue' | 'cancelled' | string;

interface InvoiceRecord {
  id: string;
  outlet_id: string;
  invoice_number: string;
  vendor_id?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  status: InvoiceStatus;
  total?: number | null;
  created_at?: string | null;
}

interface InvoiceListResponse {
  items: InvoiceRecord[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

interface OutletInsight {
  outletId: string;
  outletName: string;
  businessType: string;
  currency: string;
  invoiceCount: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
  overdueCount: number;
  overdueAmount: number;
  dueSoonCount: number;
  dueSoonAmount: number;
  overdueCandidateCount: number;
}

interface BusinessTypeInsight {
  businessType: string;
  outlets: number;
  invoices: number;
  unpaidAmount: number;
  overdueAmount: number;
}

const INVOICE_PAGE_SIZE = 100;

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const normalizeStatus = (status: unknown): string => String(status || '').trim().toLowerCase();

const isPaidStatus = (status: unknown): boolean => normalizeStatus(status) === 'paid';

const isUnpaidStatus = (status: unknown): boolean => {
  const normalized = normalizeStatus(status);
  return normalized !== 'paid' && normalized !== 'cancelled';
};

const formatBusinessTypeLabel = (value?: string | null): string => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return 'Unspecified';
  }
  return normalized
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const parseDateValue = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const startOfLocalDay = (value?: Date): Date => {
  const source = value ? new Date(value) : new Date();
  source.setHours(0, 0, 0, 0);
  return source;
};

const getDaysUntilDate = (dateValue?: string | null, fromDate?: Date): number | null => {
  const parsed = parseDateValue(dateValue);
  if (!parsed) {
    return null;
  }
  const startDate = startOfLocalDay(fromDate);
  const startDue = startOfLocalDay(parsed);
  const diffMs = startDue.getTime() - startDate.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const Invoices: React.FC = () => {
  const {
    currentUser,
    currentOutlet,
    getAccessibleOutlets,
    canApproveVendorInvoices,
    userOutlets,
  } = useOutlet();

  const [vendorInvoices, setVendorInvoices] = useState<InvoiceRecord[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [processingOutletId, setProcessingOutletId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const accessibleOutlets = useMemo(
    () => getAccessibleOutlets(),
    [currentUser, userOutlets, getAccessibleOutlets]
  );
  const outletScopeKey = accessibleOutlets.join('|');
  const today = useMemo(() => startOfLocalDay(), []);
  const canManageStatuses = canApproveVendorInvoices();

  const outletConfigById = useMemo(() => {
    const map: Record<string, { name: string; currency: string; businessType: string }> = {};
    userOutlets.forEach((outlet) => {
      map[outlet.id] = {
        name: outlet.name || outlet.id,
        currency: String(outlet.currency || '').trim().toUpperCase(),
        businessType: String(outlet.businessType || '').trim() || 'unspecified',
      };
    });
    return map;
  }, [userOutlets]);

  const primaryCurrencyCode = useMemo(() => {
    const currentCurrency = String(currentOutlet?.currency || '').trim().toUpperCase();
    if (currentCurrency) {
      return currentCurrency;
    }

    const firstOutletCurrency = userOutlets
      .map((outlet) => String(outlet.currency || '').trim().toUpperCase())
      .find(Boolean);

    return firstOutletCurrency || '';
  }, [currentOutlet?.currency, userOutlets]);

  const formatMoney = (amount: number, outletId?: string): string => {
    const outletCurrency = outletId ? outletConfigById[outletId]?.currency : undefined;
    const currencyCode = outletCurrency || primaryCurrencyCode;

    if (!currencyCode) {
      return new Intl.NumberFormat('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    }

    try {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return new Intl.NumberFormat('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    }
  };

  const getDaysUntilDue = (invoice: InvoiceRecord): number | null => getDaysUntilDate(invoice.due_date, today);

  const fetchInvoicesForOutlet = async (outletId: string): Promise<InvoiceRecord[]> => {
    const records: InvoiceRecord[] = [];
    let page = 1;

    while (true) {
      const response = await apiClient.get<InvoiceListResponse>('/invoices/', {
        outlet_id: outletId,
        invoice_type: 'vendor',
        page,
        size: INVOICE_PAGE_SIZE,
      });

      if (response.error || !response.data) {
        throw new Error(response.error || `Failed to load invoices for outlet ${outletId}`);
      }

      const pageItems = Array.isArray(response.data.items) ? response.data.items : [];
      records.push(...pageItems);

      const totalPages = Math.max(1, Number(response.data.pages || 1));
      if (page >= totalPages) {
        break;
      }
      page += 1;
    }

    return records;
  };

  const loadVendorInvoices = async () => {
    if (!currentUser) {
      setVendorInvoices([]);
      setLoading(false);
      return;
    }

    const outletIds = getAccessibleOutlets();
    if (outletIds.length === 0) {
      setVendorInvoices([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setInfoMessage(null);

      const invoiceResults = await Promise.allSettled(
        outletIds.map((outletId) => fetchInvoicesForOutlet(outletId))
      );

      const loadedInvoices = invoiceResults
        .filter(
          (result): result is PromiseFulfilledResult<InvoiceRecord[]> => result.status === 'fulfilled'
        )
        .flatMap((result) => result.value);

      const failedInvoiceLoads = invoiceResults.filter((result) => result.status === 'rejected').length;
      if (failedInvoiceLoads > 0 && loadedInvoices.length === 0) {
        throw new Error('Failed to load invoices for your accessible outlets.');
      }

      const sorted = [...loadedInvoices].sort((left, right) => {
        const leftDate = new Date(left.created_at || left.issue_date || 0).getTime();
        const rightDate = new Date(right.created_at || right.issue_date || 0).getTime();
        return rightDate - leftDate;
      });

      setVendorInvoices(sorted);

      if (failedInvoiceLoads > 0) {
        setError(`Some outlets failed to load (${failedInvoiceLoads}). Showing available invoices.`);
      }
    } catch (err) {
      console.error('Error loading invoices:', err);
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
      setVendorInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const primaryOutletId = accessibleOutlets[0] || '';
  const { isConnected: isRealtimeConnected } = useRealtimeSync({
    outletId: primaryOutletId,
    enabled: !!currentUser && accessibleOutlets.length > 0,
    onInvoiceChange: () => {
      void loadVendorInvoices();
    },
  });

  useEffect(() => {
    if (currentUser) {
      void loadVendorInvoices();
    }
  }, [currentUser?.id, outletScopeKey]);

  const outletInsights = useMemo<OutletInsight[]>(() => {
    const byOutlet: Record<string, OutletInsight> = {};

    vendorInvoices.forEach((invoice) => {
      const outletId = String(invoice.outlet_id || '').trim() || 'unknown';
      const outletConfig = outletConfigById[outletId];

      if (!byOutlet[outletId]) {
        byOutlet[outletId] = {
          outletId,
          outletName: outletConfig?.name || outletId,
          businessType: outletConfig?.businessType || 'unspecified',
          currency: outletConfig?.currency || primaryCurrencyCode || '',
          invoiceCount: 0,
          totalAmount: 0,
          paidCount: 0,
          paidAmount: 0,
          unpaidCount: 0,
          unpaidAmount: 0,
          overdueCount: 0,
          overdueAmount: 0,
          dueSoonCount: 0,
          dueSoonAmount: 0,
          overdueCandidateCount: 0,
        };
      }

      const insight = byOutlet[outletId];
      const amount = toNumber(invoice.total);
      const status = normalizeStatus(invoice.status);
      const daysUntilDue = getDaysUntilDue(invoice);

      insight.invoiceCount += 1;
      insight.totalAmount += amount;

      if (isPaidStatus(status)) {
        insight.paidCount += 1;
        insight.paidAmount += amount;
      }

      if (isUnpaidStatus(status)) {
        insight.unpaidCount += 1;
        insight.unpaidAmount += amount;

        if (daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7) {
          insight.dueSoonCount += 1;
          insight.dueSoonAmount += amount;
        }

        if (daysUntilDue !== null && daysUntilDue < 0 && status !== 'overdue') {
          insight.overdueCandidateCount += 1;
        }
      }

      if (status === 'overdue') {
        insight.overdueCount += 1;
        insight.overdueAmount += amount;
      }
    });

    const selected = Object.values(byOutlet);
    const filtered = selectedOutletId === 'all'
      ? selected
      : selected.filter((insight) => insight.outletId === selectedOutletId);

    return filtered.sort((left, right) => right.unpaidAmount - left.unpaidAmount);
  }, [outletConfigById, primaryCurrencyCode, selectedOutletId, vendorInvoices]);

  const businessTypeInsights = useMemo<BusinessTypeInsight[]>(() => {
    const byType: Record<string, BusinessTypeInsight> = {};

    outletInsights.forEach((insight) => {
      const key = insight.businessType || 'unspecified';
      if (!byType[key]) {
        byType[key] = {
          businessType: key,
          outlets: 0,
          invoices: 0,
          unpaidAmount: 0,
          overdueAmount: 0,
        };
      }

      byType[key].outlets += 1;
      byType[key].invoices += insight.invoiceCount;
      byType[key].unpaidAmount += insight.unpaidAmount;
      byType[key].overdueAmount += insight.overdueAmount;
    });

    return Object.values(byType).sort((left, right) => right.unpaidAmount - left.unpaidAmount);
  }, [outletInsights]);

  const summary = useMemo(() => {
    const result = {
      outlets: outletInsights.length,
      invoices: 0,
      unpaidCount: 0,
      unpaidAmount: 0,
      overdueCount: 0,
      overdueAmount: 0,
      dueSoonCount: 0,
      dueSoonAmount: 0,
      paidAmount: 0,
      outletsWithUnpaid: 0,
      outletsWithOverdue: 0,
    };

    outletInsights.forEach((insight) => {
      result.invoices += insight.invoiceCount;
      result.unpaidCount += insight.unpaidCount;
      result.unpaidAmount += insight.unpaidAmount;
      result.overdueCount += insight.overdueCount;
      result.overdueAmount += insight.overdueAmount;
      result.dueSoonCount += insight.dueSoonCount;
      result.dueSoonAmount += insight.dueSoonAmount;
      result.paidAmount += insight.paidAmount;
      if (insight.unpaidCount > 0) {
        result.outletsWithUnpaid += 1;
      }
      if (insight.overdueCount > 0 || insight.overdueCandidateCount > 0) {
        result.outletsWithOverdue += 1;
      }
    });

    return result;
  }, [outletInsights]);

  const currenciesInScope = useMemo(() => {
    const seen = new Set<string>();
    outletInsights.forEach((insight) => {
      if (insight.currency) {
        seen.add(insight.currency);
      }
    });
    return Array.from(seen);
  }, [outletInsights]);

  const hasMixedCurrencies = currenciesInScope.length > 1;

  const handleExportInsightsCsv = (outletId: string | 'all' = 'all') => {
    const rowsSource = outletId === 'all'
      ? outletInsights
      : outletInsights.filter((insight) => insight.outletId === outletId);

    if (rowsSource.length === 0) {
      setInfoMessage('No outlet insights to export.');
      return;
    }

    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      [
        'Outlet',
        'Business Type',
        'Currency',
        'Invoices',
        'Unpaid Invoices',
        'Overdue Invoices',
        'Due in 7 Days',
        'Total Amount',
        'Outstanding Amount',
        'Overdue Amount',
      ],
      ...rowsSource.map((insight) => [
        insight.outletName,
        formatBusinessTypeLabel(insight.businessType),
        insight.currency,
        String(insight.invoiceCount),
        String(insight.unpaidCount),
        String(insight.overdueCount),
        String(insight.dueSoonCount),
        insight.totalAmount.toFixed(2),
        insight.unpaidAmount.toFixed(2),
        insight.overdueAmount.toFixed(2),
      ]),
    ];

    const csv = rows.map((row) => row.map((value) => escapeCsv(value)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `outlet-invoice-insights-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setInfoMessage('Outlet insights export is ready.');
  };

  const handleMarkOverdueForOutlet = async (outletId: string) => {
    if (!canManageStatuses) {
      setError('You do not have permission to update invoice status.');
      return;
    }

    const candidates = vendorInvoices.filter((invoice) => {
      if (invoice.outlet_id !== outletId) {
        return false;
      }
      const status = normalizeStatus(invoice.status);
      if (!isUnpaidStatus(status) || status === 'overdue') {
        return false;
      }
      const daysUntilDue = getDaysUntilDue(invoice);
      return daysUntilDue !== null && daysUntilDue < 0;
    });

    if (candidates.length === 0) {
      setInfoMessage('No overdue candidates found for this outlet.');
      return;
    }

    const outletName = outletConfigById[outletId]?.name || outletId;
    const confirmed = window.confirm(
      `Mark ${candidates.length} invoice(s) as overdue for ${outletName}?`
    );
    if (!confirmed) {
      return;
    }

    try {
      setProcessingOutletId(outletId);
      setError(null);
      setInfoMessage(null);

      const results = await Promise.all(
        candidates.map(async (invoice) => {
          const response = await apiClient.put<InvoiceRecord>(`/invoices/${invoice.id}`, { status: 'overdue' });
          return response.error;
        })
      );

      const failed = results.filter(Boolean).length;
      const updated = results.length - failed;

      await loadVendorInvoices();

      if (failed > 0) {
        setError(`Updated ${updated} invoice(s), but ${failed} failed.`);
      } else {
        setInfoMessage(`Marked ${updated} invoice(s) as overdue for ${outletName}.`);
      }
    } catch (err) {
      console.error('Error marking overdue invoices:', err);
      setError(err instanceof Error ? err.message : 'Failed to update overdue invoices');
    } finally {
      setProcessingOutletId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full animate-spin border-t-gray-900 dark:border-t-white mx-auto" />
                <Store className="w-6 h-6 text-gray-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="mt-6 text-gray-600 dark:text-gray-400 font-light">Loading outlet invoice insights...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 rounded-xl flex items-center justify-center shadow-sm">
                <Store className="w-5 h-5 text-white dark:text-gray-900" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-light text-gray-900 dark:text-white tracking-tight">
                Outlet Invoice Insights
              </h1>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  isRealtimeConnected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                }`}
              >
                {isRealtimeConnected ? 'Live' : 'Polling'}
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-light">
              Outlet-only view for owner decisions. Currency is synced from outlet settings
              {primaryCurrencyCode ? ` (primary: ${primaryCurrencyCode})` : ''}.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
            <select
              className="appearance-none px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white w-full sm:w-auto"
              value={selectedOutletId}
              onChange={(event) => setSelectedOutletId(event.target.value)}
            >
              <option value="all">All Outlets</option>
              {accessibleOutlets.map((outletId) => (
                <option key={outletId} value={outletId}>
                  {outletConfigById[outletId]?.name || outletId}
                </option>
              ))}
            </select>

            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                void loadVendorInvoices();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => handleExportInsightsCsv(selectedOutletId === 'all' ? 'all' : selectedOutletId)}
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {hasMixedCurrencies && (
          <div className="card border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-200 text-sm">
                Multiple outlet currencies detected ({currenciesInScope.join(', ')}). Each outlet row uses its own currency.
              </p>
            </div>
          </div>
        )}

        {infoMessage && (
          <div className="card border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-emerald-800 dark:text-emerald-200 font-light">{infoMessage}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="card border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <p className="text-red-800 dark:text-red-200 font-light">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Outlets in Scope</p>
            <p className="text-2xl font-semibold mt-1 text-gray-900 dark:text-white">{summary.outlets}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.invoices} total invoices</p>
          </div>

          <div className="card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-semibold mt-1 text-amber-700 dark:text-amber-300">{formatMoney(summary.unpaidAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.unpaidCount} unpaid invoices</p>
          </div>

          <div className="card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Overdue Exposure</p>
            <p className="text-2xl font-semibold mt-1 text-red-700 dark:text-red-300">{formatMoney(summary.overdueAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.overdueCount} overdue invoices</p>
          </div>

          <div className="card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Due in 7 Days</p>
            <p className="text-2xl font-semibold mt-1 text-blue-700 dark:text-blue-300">{formatMoney(summary.dueSoonAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.dueSoonCount} invoices</p>
          </div>

          <div className="card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Paid Value</p>
            <p className="text-2xl font-semibold mt-1 text-emerald-700 dark:text-emerald-300">{formatMoney(summary.paidAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.outletsWithOverdue} outlets need attention</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Business Type Insights</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Unpaid and overdue exposure by outlet type (supermarket, restaurant, etc).
            </p>
            <div className="space-y-3">
              {businessTypeInsights.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No business type insights available.</p>
              ) : (
                businessTypeInsights.map((entry) => (
                  <div
                    key={entry.businessType}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatBusinessTypeLabel(entry.businessType)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {entry.outlets} outlets | {entry.invoices} invoices
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                        {formatMoney(entry.unpaidAmount)} unpaid
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-300">
                        {formatMoney(entry.overdueAmount)} overdue
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Outlet Priority List</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Ranked by outstanding amount to guide follow-up.
            </p>
            <div className="space-y-3">
              {outletInsights.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No outlet data available.</p>
              ) : (
                outletInsights.map((insight) => (
                  <div
                    key={insight.outletId}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{insight.outletName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatBusinessTypeLabel(insight.businessType)} | {insight.unpaidCount} unpaid | {insight.overdueCount} overdue
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white text-right">
                        {formatMoney(insight.unpaidAmount, insight.outletId)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Outlet-Level Invoice Insights</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            This view is focused only on outlet insights and owner-level actions.
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Outlet</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Business Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Currency</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Invoices</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Unpaid</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Overdue</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Due 7d</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Outstanding</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {outletInsights.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center" colSpan={9}>
                      No outlet insights available.
                    </td>
                  </tr>
                ) : (
                  outletInsights.map((insight) => (
                    <tr key={insight.outletId}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{insight.outletName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatBusinessTypeLabel(insight.businessType)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{insight.currency || 'Not set'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{insight.invoiceCount}</td>
                      <td className="px-4 py-3 text-sm text-amber-700 dark:text-amber-300">{insight.unpaidCount}</td>
                      <td className="px-4 py-3 text-sm text-red-700 dark:text-red-300">{insight.overdueCount}</td>
                      <td className="px-4 py-3 text-sm text-blue-700 dark:text-blue-300">{insight.dueSoonCount}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                        {formatMoney(insight.unpaidAmount, insight.outletId)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedOutletId(insight.outletId)}
                          >
                            Focus
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportInsightsCsv(insight.outletId)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Export
                          </Button>

                          {canManageStatuses && insight.overdueCandidateCount > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => {
                                void handleMarkOverdueForOutlet(insight.outletId);
                              }}
                              disabled={processingOutletId === insight.outletId}
                            >
                              {processingOutletId === insight.outletId
                                ? 'Updating...'
                                : `Mark Overdue (${insight.overdueCandidateCount})`}
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedOutletId('all')}
                          >
                            Clear
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Latest Invoices (Context)</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Recent items for the selected outlet scope to support follow-up decisions.
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Invoice</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Outlet</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Issue Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Due Signal</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {vendorInvoices
                  .filter((invoice) => selectedOutletId === 'all' || invoice.outlet_id === selectedOutletId)
                  .slice(0, 12)
                  .map((invoice) => {
                    const daysUntilDue = getDaysUntilDue(invoice);
                    const dueText =
                      daysUntilDue === null
                        ? 'No due date'
                        : daysUntilDue < 0
                          ? `${Math.abs(daysUntilDue)} day(s) overdue`
                          : daysUntilDue === 0
                            ? 'Due today'
                            : `Due in ${daysUntilDue} day(s)`;

                    return (
                      <tr key={invoice.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{invoice.invoice_number || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{outletConfigById[invoice.outlet_id]?.name || invoice.outlet_id}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {invoice.issue_date ? formatDate(invoice.issue_date) : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{dueText}</td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              isPaidStatus(invoice.status)
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                : normalizeStatus(invoice.status) === 'overdue'
                                  ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                            }`}
                          >
                            {normalizeStatus(invoice.status) || 'unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                          {formatMoney(toNumber(invoice.total), invoice.outlet_id)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Invoices;
