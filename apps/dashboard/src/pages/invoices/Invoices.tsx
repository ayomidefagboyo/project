import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  Clock,
  Download,
  DollarSign,
  Eye,
  Filter,
  RefreshCw,
  Receipt,
  Search,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

type InvoiceStatus = 'draft' | 'pending' | 'received' | 'paid' | 'overdue' | 'cancelled' | string;
type InvoiceStatusFilter = 'all' | 'draft' | 'pending' | 'received' | 'paid' | 'overdue' | 'cancelled';
type PaymentFilter = 'all' | 'paid' | 'unpaid';
type DueWindowFilter = 'all' | 'due_7' | 'overdue' | 'overdue_30';
type AgingBucketId = 'current' | 'overdue_1_30' | 'overdue_31_60' | 'overdue_61_90' | 'overdue_90_plus' | 'no_due_date';

interface InvoiceItemRecord {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total?: number | null;
  line_total?: number | null;
  category?: string | null;
}

interface InvoiceRecord {
  id: string;
  outlet_id: string;
  invoice_number: string;
  vendor_id?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  status: InvoiceStatus;
  subtotal?: number | null;
  tax_amount?: number | null;
  total?: number | null;
  notes?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
  invoice_items?: InvoiceItemRecord[];
}

interface InvoiceListResponse {
  items: InvoiceRecord[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

interface VendorListResponse {
  items: Array<{ id: string; name?: string | null }>;
  total: number;
  page: number;
  size: number;
  pages: number;
}

const INVOICE_PAGE_SIZE = 100;
const VENDOR_PAGE_SIZE = 100;

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

const formatStatusLabel = (status: unknown): string => {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    return 'Unknown';
  }
  return normalized
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const formatDateSafe = (value?: string | null): string => {
  if (!value) {
    return 'N/A';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return formatDate(parsed);
};

const getStatusBadgeClass = (status: unknown): string => {
  const normalized = normalizeStatus(status);
  if (normalized === 'paid') {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800';
  }
  if (normalized === 'received') {
    return 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800';
  }
  if (normalized === 'pending') {
    return 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800';
  }
  if (normalized === 'overdue') {
    return 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800';
  }
  if (normalized === 'draft') {
    return 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }
  if (normalized === 'cancelled') {
    return 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
  }
  return 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
};

const getPaymentBadgeClass = (status: unknown): string => {
  if (isPaidStatus(status)) {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800';
  }
  return 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-200 dark:border-orange-800';
};

const getInvoiceLineTotal = (item: InvoiceItemRecord): number => {
  const explicitTotal = toNumber(item.total ?? item.line_total);
  if (explicitTotal > 0) {
    return explicitTotal;
  }
  return toNumber(item.quantity) * toNumber(item.unit_price);
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

const toMonthKey = (dateValue?: string | null): string | null => {
  const parsed = parseDateValue(dateValue);
  if (!parsed) {
    return null;
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

interface AgingBucketMetric {
  id: AgingBucketId;
  label: string;
  count: number;
  amount: number;
}

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

const Invoices: React.FC = () => {
  const { currentUser, getAccessibleOutlets, canApproveVendorInvoices, userOutlets } = useOutlet();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [dueWindowFilter, setDueWindowFilter] = useState<DueWindowFilter>('all');
  const [vendorFocusFilter, setVendorFocusFilter] = useState<string>('all');
  const [vendorInvoices, setVendorInvoices] = useState<InvoiceRecord[]>([]);
  const [vendorNamesById, setVendorNamesById] = useState<Record<string, string>>({});
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [markPaidInvoice, setMarkPaidInvoice] = useState<InvoiceRecord | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const accessibleOutlets = useMemo(
    () => getAccessibleOutlets(),
    [currentUser, userOutlets, getAccessibleOutlets]
  );
  const outletScopeKey = accessibleOutlets.join('|');
  const canMarkPaid = canApproveVendorInvoices();
  const today = useMemo(() => startOfLocalDay(), []);

  const fetchVendorInvoicesForOutlet = async (outletId: string): Promise<InvoiceRecord[]> => {
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

  const fetchVendorsForOutlet = async (outletId: string): Promise<Array<{ id: string; name: string }>> => {
    const vendors: Array<{ id: string; name: string }> = [];
    let page = 1;

    while (true) {
      const response = await apiClient.get<VendorListResponse>('/vendors/', {
        outlet_id: outletId,
        page,
        size: VENDOR_PAGE_SIZE,
      });

      if (response.error || !response.data) {
        return vendors;
      }

      const pageItems = Array.isArray(response.data.items) ? response.data.items : [];
      pageItems.forEach((vendor) => {
        const vendorId = String(vendor.id || '').trim();
        const vendorName = String(vendor.name || '').trim();
        if (vendorId && vendorName) {
          vendors.push({ id: vendorId, name: vendorName });
        }
      });

      const totalPages = Math.max(1, Number(response.data.pages || 1));
      if (page >= totalPages) {
        break;
      }
      page += 1;
    }

    return vendors;
  };

  const loadVendorInvoices = async () => {
    if (!currentUser) {
      setVendorInvoices([]);
      setVendorNamesById({});
      setLoading(false);
      return;
    }

    const outletIds = getAccessibleOutlets();
    if (outletIds.length === 0) {
      setVendorInvoices([]);
      setVendorNamesById({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setInfoMessage(null);

      const invoiceResults = await Promise.allSettled(
        outletIds.map((outletId) => fetchVendorInvoicesForOutlet(outletId))
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

      const vendorResults = await Promise.allSettled(
        outletIds.map((outletId) => fetchVendorsForOutlet(outletId))
      );
      const vendorMap: Record<string, string> = {};
      vendorResults
        .filter(
          (result): result is PromiseFulfilledResult<Array<{ id: string; name: string }>> =>
            result.status === 'fulfilled'
        )
        .flatMap((result) => result.value)
        .forEach((vendor) => {
          vendorMap[vendor.id] = vendor.name;
        });

      const sortedInvoices = [...loadedInvoices].sort((left, right) => {
        const leftDate = new Date(left.created_at || left.issue_date || 0).getTime();
        const rightDate = new Date(right.created_at || right.issue_date || 0).getTime();
        return rightDate - leftDate;
      });

      setVendorInvoices(sortedInvoices);
      setVendorNamesById(vendorMap);

      if (failedInvoiceLoads > 0) {
        setError(`Some outlets failed to load (${failedInvoiceLoads}). Showing available invoices.`);
      }
    } catch (err) {
      console.error('Error loading invoices:', err);
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
      setVendorInvoices([]);
      setVendorNamesById({});
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

  const outletNamesById = useMemo(() => {
    const map: Record<string, string> = {};
    userOutlets.forEach((outlet) => {
      map[outlet.id] = outlet.name;
    });
    return map;
  }, [userOutlets]);

  const outletBusinessTypeById = useMemo(() => {
    const map: Record<string, string> = {};
    userOutlets.forEach((outlet) => {
      map[outlet.id] = outlet.businessType;
    });
    return map;
  }, [userOutlets]);

  const getVendorLabel = (invoice: InvoiceRecord): string => {
    const vendorId = String(invoice.vendor_id || '').trim();
    if (!vendorId) {
      return 'No vendor linked';
    }
    return vendorNamesById[vendorId] || vendorId;
  };

  const getOutletLabel = (invoice: InvoiceRecord): string => {
    const outletId = String(invoice.outlet_id || '').trim();
    if (!outletId) {
      return 'Unknown outlet';
    }
    return outletNamesById[outletId] || outletId;
  };

  const getDaysUntilDue = (invoice: InvoiceRecord): number | null => {
    return getDaysUntilDate(invoice.due_date, today);
  };

  const vendorFilterOptions = useMemo(() => {
    const vendorIds = new Set<string>();
    vendorInvoices.forEach((invoice) => {
      const vendorId = String(invoice.vendor_id || '').trim();
      if (vendorId) {
        vendorIds.add(vendorId);
      }
    });
    return Array.from(vendorIds)
      .map((vendorId) => ({
        id: vendorId,
        label: vendorNamesById[vendorId] || vendorId,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [vendorInvoices, vendorNamesById]);

  const unpaidInvoices = useMemo(
    () => vendorInvoices.filter((invoice) => isUnpaidStatus(invoice.status)),
    [vendorInvoices]
  );
  const paidInvoices = useMemo(
    () => vendorInvoices.filter((invoice) => isPaidStatus(invoice.status)),
    [vendorInvoices]
  );

  const dueSoonInvoices = useMemo(
    () =>
      unpaidInvoices.filter((invoice) => {
        const daysUntilDue = getDaysUntilDue(invoice);
        return daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7;
      }),
    [unpaidInvoices]
  );

  const autoOverdueCandidates = useMemo(
    () =>
      unpaidInvoices.filter((invoice) => {
        const currentStatus = normalizeStatus(invoice.status);
        if (currentStatus === 'overdue') {
          return false;
        }
        const daysUntilDue = getDaysUntilDue(invoice);
        return daysUntilDue !== null && daysUntilDue < 0;
      }),
    [unpaidInvoices]
  );

  const filteredInvoices = useMemo(() => {
    return vendorInvoices.filter((invoice) => {
      const vendorId = String(invoice.vendor_id || '').trim();
      const vendorName = vendorNamesById[vendorId] || vendorId;
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const daysUntilDue = getDaysUntilDue(invoice);

      const searchMatches =
        normalizedSearch.length === 0 ||
        String(invoice.invoice_number || '').toLowerCase().includes(normalizedSearch) ||
        vendorName.toLowerCase().includes(normalizedSearch) ||
        getOutletLabel(invoice).toLowerCase().includes(normalizedSearch) ||
        String(invoice.notes || '').toLowerCase().includes(normalizedSearch);

      const normalizedStatus = normalizeStatus(invoice.status);
      const statusMatches = statusFilter === 'all' || normalizedStatus === statusFilter;

      const paymentMatches =
        paymentFilter === 'all' ||
        (paymentFilter === 'paid' && isPaidStatus(invoice.status)) ||
        (paymentFilter === 'unpaid' && isUnpaidStatus(invoice.status));

      const dueWindowMatches =
        dueWindowFilter === 'all' ||
        (dueWindowFilter === 'due_7' &&
          isUnpaidStatus(invoice.status) &&
          daysUntilDue !== null &&
          daysUntilDue >= 0 &&
          daysUntilDue <= 7) ||
        (dueWindowFilter === 'overdue' &&
          isUnpaidStatus(invoice.status) &&
          daysUntilDue !== null &&
          daysUntilDue < 0) ||
        (dueWindowFilter === 'overdue_30' &&
          isUnpaidStatus(invoice.status) &&
          daysUntilDue !== null &&
          daysUntilDue < -30);

      const vendorFocusMatches = vendorFocusFilter === 'all' || vendorId === vendorFocusFilter;

      return searchMatches && statusMatches && paymentMatches && dueWindowMatches && vendorFocusMatches;
    });
  }, [
    dueWindowFilter,
    paymentFilter,
    searchTerm,
    statusFilter,
    vendorFocusFilter,
    vendorInvoices,
    vendorNamesById,
  ]);

  const summary = useMemo(() => {
    const draft = vendorInvoices.filter((invoice) => normalizeStatus(invoice.status) === 'draft');
    const overdue = vendorInvoices.filter((invoice) => normalizeStatus(invoice.status) === 'overdue');

    return {
      totalCount: vendorInvoices.length,
      totalAmount: vendorInvoices.reduce((total, invoice) => total + toNumber(invoice.total), 0),
      draftCount: draft.length,
      overdueCount: overdue.length,
      paidCount: paidInvoices.length,
      paidAmount: paidInvoices.reduce((total, invoice) => total + toNumber(invoice.total), 0),
      unpaidCount: unpaidInvoices.length,
      unpaidAmount: unpaidInvoices.reduce((total, invoice) => total + toNumber(invoice.total), 0),
      dueSoonCount: dueSoonInvoices.length,
      dueSoonAmount: dueSoonInvoices.reduce((total, invoice) => total + toNumber(invoice.total), 0),
    };
  }, [dueSoonInvoices, paidInvoices, unpaidInvoices, vendorInvoices]);

  const averageInvoiceValue = summary.totalCount > 0 ? summary.totalAmount / summary.totalCount : 0;
  const unpaidShare = summary.totalAmount > 0 ? (summary.unpaidAmount / summary.totalAmount) * 100 : 0;

  const monthlyInsights = useMemo(() => {
    const now = new Date();
    const monthPoints: Array<{
      key: string;
      label: string;
      count: number;
      totalAmount: number;
      unpaidAmount: number;
    }> = [];

    for (let offset = 5; offset >= 0; offset -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      monthPoints.push({
        key,
        label: monthDate.toLocaleString('en-US', { month: 'short' }),
        count: 0,
        totalAmount: 0,
        unpaidAmount: 0,
      });
    }

    const pointMap: Record<string, (typeof monthPoints)[number]> = {};
    monthPoints.forEach((point) => {
      pointMap[point.key] = point;
    });

    vendorInvoices.forEach((invoice) => {
      const key = toMonthKey(invoice.issue_date || invoice.created_at);
      if (!key || !pointMap[key]) {
        return;
      }
      const amount = toNumber(invoice.total);
      pointMap[key].count += 1;
      pointMap[key].totalAmount += amount;
      if (isUnpaidStatus(invoice.status)) {
        pointMap[key].unpaidAmount += amount;
      }
    });

    const current = monthPoints[monthPoints.length - 1];
    const previous = monthPoints[monthPoints.length - 2];
    const amountDeltaPct =
      previous && previous.totalAmount > 0
        ? ((current.totalAmount - previous.totalAmount) / previous.totalAmount) * 100
        : null;

    return {
      points: monthPoints,
      current,
      previous,
      amountDeltaPct,
    };
  }, [vendorInvoices]);
  const maxMonthlyAmount = useMemo(() => {
    const maxValue = Math.max(...monthlyInsights.points.map((point) => point.totalAmount), 0);
    return maxValue <= 0 ? 1 : maxValue;
  }, [monthlyInsights]);

  const topUnpaidVendors = useMemo(() => {
    const totalsByVendor: Record<string, { vendorId: string; vendorName: string; amount: number; count: number }> = {};
    unpaidInvoices.forEach((invoice) => {
      const vendorId = String(invoice.vendor_id || '').trim() || 'unlinked';
      if (!totalsByVendor[vendorId]) {
        totalsByVendor[vendorId] = {
          vendorId,
          vendorName: vendorId === 'unlinked' ? 'Unlinked Vendor' : vendorNamesById[vendorId] || vendorId,
          amount: 0,
          count: 0,
        };
      }
      totalsByVendor[vendorId].amount += toNumber(invoice.total);
      totalsByVendor[vendorId].count += 1;
    });

    return Object.values(totalsByVendor)
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 5);
  }, [unpaidInvoices, vendorNamesById]);

  const outletInsights = useMemo(() => {
    const insightsByOutlet: Record<
      string,
      {
        outletId: string;
        outletName: string;
        businessType: string;
        invoices: number;
        totalAmount: number;
        unpaidCount: number;
        unpaidAmount: number;
        overdueCount: number;
      }
    > = {};

    vendorInvoices.forEach((invoice) => {
      const outletId = String(invoice.outlet_id || '').trim() || 'unknown';
      if (!insightsByOutlet[outletId]) {
        insightsByOutlet[outletId] = {
          outletId,
          outletName: outletNamesById[outletId] || outletId,
          businessType: outletBusinessTypeById[outletId] || 'unspecified',
          invoices: 0,
          totalAmount: 0,
          unpaidCount: 0,
          unpaidAmount: 0,
          overdueCount: 0,
        };
      }

      const insight = insightsByOutlet[outletId];
      const amount = toNumber(invoice.total);
      insight.invoices += 1;
      insight.totalAmount += amount;
      if (isUnpaidStatus(invoice.status)) {
        insight.unpaidCount += 1;
        insight.unpaidAmount += amount;
      }
      if (normalizeStatus(invoice.status) === 'overdue') {
        insight.overdueCount += 1;
      }
    });

    return Object.values(insightsByOutlet).sort((left, right) => right.unpaidAmount - left.unpaidAmount);
  }, [vendorInvoices, outletBusinessTypeById, outletNamesById]);

  const businessTypeInsights = useMemo(() => {
    const totalsByType: Record<
      string,
      {
        businessType: string;
        outlets: number;
        invoices: number;
        totalAmount: number;
        unpaidAmount: number;
        overdueCount: number;
      }
    > = {};

    outletInsights.forEach((insight) => {
      const businessType = insight.businessType || 'unspecified';
      if (!totalsByType[businessType]) {
        totalsByType[businessType] = {
          businessType,
          outlets: 0,
          invoices: 0,
          totalAmount: 0,
          unpaidAmount: 0,
          overdueCount: 0,
        };
      }
      totalsByType[businessType].outlets += 1;
      totalsByType[businessType].invoices += insight.invoices;
      totalsByType[businessType].totalAmount += insight.totalAmount;
      totalsByType[businessType].unpaidAmount += insight.unpaidAmount;
      totalsByType[businessType].overdueCount += insight.overdueCount;
    });

    return Object.values(totalsByType).sort((left, right) => right.unpaidAmount - left.unpaidAmount);
  }, [outletInsights]);

  const agingBuckets = useMemo<AgingBucketMetric[]>(() => {
    const buckets: Record<AgingBucketId, AgingBucketMetric> = {
      current: { id: 'current', label: 'Current', count: 0, amount: 0 },
      overdue_1_30: { id: 'overdue_1_30', label: '1-30 days overdue', count: 0, amount: 0 },
      overdue_31_60: { id: 'overdue_31_60', label: '31-60 days overdue', count: 0, amount: 0 },
      overdue_61_90: { id: 'overdue_61_90', label: '61-90 days overdue', count: 0, amount: 0 },
      overdue_90_plus: { id: 'overdue_90_plus', label: '90+ days overdue', count: 0, amount: 0 },
      no_due_date: { id: 'no_due_date', label: 'No due date', count: 0, amount: 0 },
    };

    unpaidInvoices.forEach((invoice) => {
      const amount = toNumber(invoice.total);
      const daysUntilDue = getDaysUntilDue(invoice);
      if (daysUntilDue === null) {
        buckets.no_due_date.count += 1;
        buckets.no_due_date.amount += amount;
        return;
      }

      if (daysUntilDue >= 0) {
        buckets.current.count += 1;
        buckets.current.amount += amount;
        return;
      }

      const overdueDays = Math.abs(daysUntilDue);
      if (overdueDays <= 30) {
        buckets.overdue_1_30.count += 1;
        buckets.overdue_1_30.amount += amount;
      } else if (overdueDays <= 60) {
        buckets.overdue_31_60.count += 1;
        buckets.overdue_31_60.amount += amount;
      } else if (overdueDays <= 90) {
        buckets.overdue_61_90.count += 1;
        buckets.overdue_61_90.amount += amount;
      } else {
        buckets.overdue_90_plus.count += 1;
        buckets.overdue_90_plus.amount += amount;
      }
    });

    return Object.values(buckets);
  }, [unpaidInvoices]);

  const maxAgingAmount = useMemo(() => {
    const maxValue = Math.max(...agingBuckets.map((bucket) => bucket.amount), 0);
    return maxValue <= 0 ? 1 : maxValue;
  }, [agingBuckets]);

  const openMarkPaidModal = (invoice: InvoiceRecord) => {
    setMarkPaidInvoice(invoice);
    setPaymentMethod(String(invoice.payment_method || '').trim());
  };

  const closeMarkPaidModal = () => {
    setMarkPaidInvoice(null);
    setPaymentMethod('');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setDueWindowFilter('all');
    setVendorFocusFilter('all');
  };

  const handleExportUnpaidCsv = () => {
    if (unpaidInvoices.length === 0) {
      setInfoMessage('No unpaid invoices to export.');
      return;
    }

    const escapeCsvValue = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Invoice Number', 'Outlet', 'Business Type', 'Vendor', 'Status', 'Issue Date', 'Due Date', 'Days To Due', 'Amount'],
      ...unpaidInvoices.map((invoice) => {
        const daysToDue = getDaysUntilDue(invoice);
        return [
          invoice.invoice_number || 'N/A',
          getOutletLabel(invoice),
          formatBusinessTypeLabel(outletBusinessTypeById[invoice.outlet_id] || 'unspecified'),
          getVendorLabel(invoice),
          formatStatusLabel(invoice.status),
          formatDateSafe(invoice.issue_date),
          formatDateSafe(invoice.due_date),
          daysToDue === null ? 'N/A' : String(daysToDue),
          toNumber(invoice.total).toFixed(2),
        ];
      }),
    ];

    const csv = rows.map((row) => row.map((value) => escapeCsvValue(value)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `unpaid-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setInfoMessage('Unpaid invoice export is ready.');
  };

  const handleMarkSingleOverdue = async (invoice: InvoiceRecord) => {
    try {
      setProcessingId(invoice.id);
      setError(null);
      setInfoMessage(null);
      const response = await apiClient.put<InvoiceRecord>(`/invoices/${invoice.id}`, { status: 'overdue' });
      if (response.error) {
        throw new Error(response.error);
      }
      await loadVendorInvoices();
      setInfoMessage(`Marked ${invoice.invoice_number || 'invoice'} as overdue.`);
    } catch (err) {
      console.error('Error marking invoice overdue:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark invoice as overdue');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkMarkOverdue = async () => {
    if (autoOverdueCandidates.length === 0) {
      setInfoMessage('No overdue candidates found.');
      return;
    }

    const confirmed = window.confirm(
      `Mark ${autoOverdueCandidates.length} invoice(s) as overdue now?`
    );
    if (!confirmed) {
      return;
    }

    try {
      setBulkActionLoading(true);
      setError(null);
      setInfoMessage(null);

      const results = await Promise.all(
        autoOverdueCandidates.map(async (invoice) => {
          const response = await apiClient.put<InvoiceRecord>(`/invoices/${invoice.id}`, { status: 'overdue' });
          return { invoiceId: invoice.id, error: response.error };
        })
      );

      const failed = results.filter((result) => result.error).length;
      const updated = results.length - failed;

      await loadVendorInvoices();

      if (failed > 0) {
        setError(`Updated ${updated} invoice(s), but ${failed} failed.`);
      } else {
        setInfoMessage(`Marked ${updated} invoice(s) as overdue.`);
      }
    } catch (err) {
      console.error('Error running overdue bulk action:', err);
      setError(err instanceof Error ? err.message : 'Failed to run overdue bulk action');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleConfirmMarkPaid = async () => {
    if (!markPaidInvoice || !canMarkPaid) {
      return;
    }

    try {
      setProcessingId(markPaidInvoice.id);
      setError(null);
      setInfoMessage(null);

      const updatePayload: Record<string, unknown> = { status: 'paid' };
      const trimmedMethod = paymentMethod.trim();
      if (trimmedMethod) {
        updatePayload.payment_method = trimmedMethod;
      }

      const response = await apiClient.put<InvoiceRecord>(`/invoices/${markPaidInvoice.id}`, updatePayload);
      if (response.error) {
        throw new Error(response.error);
      }

      closeMarkPaidModal();
      await loadVendorInvoices();
      setInfoMessage(`Marked ${markPaidInvoice.invoice_number || 'invoice'} as paid.`);
    } catch (err) {
      console.error('Error marking invoice as paid:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark invoice as paid');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full animate-spin border-t-gray-900 dark:border-t-white mx-auto" />
                <Receipt className="w-6 h-6 text-gray-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="mt-6 text-gray-600 dark:text-gray-400 font-light">Loading invoices...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 rounded-xl flex items-center justify-center shadow-sm">
                <Receipt className="w-5 h-5 text-white dark:text-gray-900" />
              </div>
              <h1 className="text-3xl font-light text-gray-900 dark:text-white tracking-tight">
                Vendor Invoices
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
              Unified invoice ledger using the real invoices source
              {summary.unpaidCount > 0 && (
                <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {summary.unpaidCount} unpaid ({formatCurrency(summary.unpaidAmount)})
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="card p-6 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Unpaid</p>
                <p className="text-3xl font-light text-amber-600 dark:text-amber-400 tracking-tight">
                  {summary.unpaidCount}
                </p>
                <p className="text-xs text-muted-foreground">{formatCurrency(summary.unpaidAmount)}</p>
              </div>
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </div>

          <div className="card p-6 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Paid</p>
                <p className="text-3xl font-light text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {summary.paidCount}
                </p>
                <p className="text-xs text-muted-foreground">{formatCurrency(summary.paidAmount)}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="card p-6 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Overdue</p>
                <p className="text-3xl font-light text-red-600 dark:text-red-400 tracking-tight">
                  {summary.overdueCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary.unpaidCount > 0
                    ? `${Math.round((summary.overdueCount / summary.unpaidCount) * 100)}% of unpaid`
                    : 'No overdue risk'}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          <div className="card p-6 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Due in 7 Days</p>
                <p className="text-3xl font-light text-blue-600 dark:text-blue-300 tracking-tight">
                  {summary.dueSoonCount}
                </p>
                <p className="text-xs text-muted-foreground">{formatCurrency(summary.dueSoonAmount)}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                <CalendarDays className="w-6 h-6 text-blue-600 dark:text-blue-300" />
              </div>
            </div>
          </div>

          <div className="card p-6 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Average Value</p>
                <p className="text-xl font-semibold text-gray-800 dark:text-gray-200 tracking-tight">
                  {formatCurrency(averageInvoiceValue)}
                </p>
                <p className="text-xs text-muted-foreground">{summary.totalCount} total invoices</p>
              </div>
              <div className="w-12 h-12 bg-violet-50 dark:bg-violet-900/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-violet-600 dark:text-violet-300" />
              </div>
            </div>
          </div>

          <div className="card p-6 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Unpaid Share</p>
                <p className="text-3xl font-light text-orange-600 dark:text-orange-300 tracking-tight">
                  {Math.round(unpaidShare)}%
                </p>
                <p className="text-xs text-muted-foreground">of invoice value is unpaid</p>
              </div>
              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-orange-600 dark:text-orange-300" />
              </div>
            </div>
          </div>
        </div>

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

        <div className="card p-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Action Center</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Prioritize by risk, due date, outlet, and business type.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPaymentFilter('unpaid');
                  setDueWindowFilter('overdue');
                }}
              >
                Focus Overdue
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPaymentFilter('unpaid');
                  setDueWindowFilter('due_7');
                }}
              >
                Focus Due Soon
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkMarkOverdue}
                disabled={bulkActionLoading || autoOverdueCandidates.length === 0}
              >
                {bulkActionLoading
                  ? 'Updating...'
                  : `Mark Overdue (${autoOverdueCandidates.length})`}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportUnpaidCsv}>
                <Download className="w-4 h-4 mr-1" />
                Export Unpaid
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void loadVendorInvoices();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">6-Month Invoice Trend</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Current month: {formatCurrency(monthlyInsights.current.totalAmount)} ({monthlyInsights.current.count}{' '}
                  invoices)
                </p>
              </div>
              <div
                className={`text-sm font-medium ${
                  monthlyInsights.amountDeltaPct !== null && monthlyInsights.amountDeltaPct >= 0
                    ? 'text-emerald-600 dark:text-emerald-300'
                    : 'text-red-600 dark:text-red-300'
                }`}
              >
                {monthlyInsights.amountDeltaPct === null
                  ? 'No prior month baseline'
                  : `${monthlyInsights.amountDeltaPct >= 0 ? '+' : ''}${monthlyInsights.amountDeltaPct.toFixed(1)}% vs last month`}
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {monthlyInsights.points.map((point) => (
                <div key={point.key}>
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span>{point.label}</span>
                    <span>
                      {point.count} invoices | {formatCurrency(point.totalAmount)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 dark:bg-blue-400"
                      style={{ width: `${Math.max((point.totalAmount / maxMonthlyAmount) * 100, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Aging Buckets (Unpaid)</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Used to triage payment risk and overdue exposure.
                </p>
              </div>
              <Clock className="w-5 h-5 text-gray-500" />
            </div>
            <div className="mt-5 space-y-3">
              {agingBuckets.map((bucket) => (
                <div key={bucket.id}>
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span>{bucket.label}</span>
                    <span>
                      {bucket.count} | {formatCurrency(bucket.amount)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        bucket.id.startsWith('overdue')
                          ? 'bg-red-500 dark:bg-red-400'
                          : bucket.id === 'current'
                            ? 'bg-emerald-500 dark:bg-emerald-400'
                            : 'bg-gray-400 dark:bg-gray-500'
                      }`}
                      style={{ width: `${Math.max((bucket.amount / maxAgingAmount) * 100, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Unpaid Vendors</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Concentration risk and follow-up targets.
            </p>
            <div className="space-y-3">
              {topUnpaidVendors.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No unpaid vendors currently.</p>
              ) : (
                topUnpaidVendors.map((vendor) => (
                  <div
                    key={vendor.vendorId}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{vendor.vendorName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{vendor.count} unpaid invoices</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(vendor.amount)}
                      </p>
                      {vendor.vendorId !== 'unlinked' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setVendorFocusFilter(vendor.vendorId);
                            setPaymentFilter('unpaid');
                          }}
                        >
                          Focus
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Business Type Insights</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Supermarket, restaurant, and other verticals compared side-by-side.
            </p>
            <div className="space-y-3">
              {businessTypeInsights.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No business type insights available yet.</p>
              ) : (
                businessTypeInsights.map((entry) => (
                  <div
                    key={entry.businessType}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatBusinessTypeLabel(entry.businessType)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {entry.outlets} outlets | {entry.invoices} invoices | {entry.overdueCount} overdue
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-300">
                      {formatCurrency(entry.unpaidAmount)} unpaid
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Outlet-Level Invoice Insights</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Identify which outlets need immediate AP follow-up.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Outlet
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Business Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Invoices
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Unpaid
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Overdue
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Outstanding
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {outletInsights.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center" colSpan={7}>
                      No outlet invoice insights available.
                    </td>
                  </tr>
                ) : (
                  outletInsights.map((insight) => (
                    <tr key={insight.outletId}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {insight.outletName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {formatBusinessTypeLabel(insight.businessType)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{insight.invoices}</td>
                      <td className="px-4 py-3 text-sm text-amber-700 dark:text-amber-300">{insight.unpaidCount}</td>
                      <td className="px-4 py-3 text-sm text-red-700 dark:text-red-300">{insight.overdueCount}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(insight.unpaidAmount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearchTerm(insight.outletName);
                            setPaymentFilter('unpaid');
                          }}
                        >
                          Focus
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Invoice Filters</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {filteredInvoices.length} of {vendorInvoices.length}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search invoice number, vendor, or notes..."
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="relative">
              <select
                className="appearance-none w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as InvoiceStatusFilter)}
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="received">Received</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                <Filter className="w-4 h-4" />
              </div>
            </div>
            <div className="relative">
              <select
                className="appearance-none w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
              >
                <option value="all">All payments</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="relative">
              <select
                className="appearance-none w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                value={dueWindowFilter}
                onChange={(event) => setDueWindowFilter(event.target.value as DueWindowFilter)}
              >
                <option value="all">All due windows</option>
                <option value="due_7">Due in 7 days</option>
                <option value="overdue">Any overdue</option>
                <option value="overdue_30">Overdue 30+ days</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                <CalendarDays className="w-4 h-4" />
              </div>
            </div>
            <div className="relative">
              <select
                className="appearance-none w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                value={vendorFocusFilter}
                onChange={(event) => setVendorFocusFilter(event.target.value)}
              >
                <option value="all">All vendors</option>
                {vendorFilterOptions.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          {filteredInvoices.length === 0 ? (
            <div className="py-16 text-center">
              <Receipt className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400">No invoices match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800/60">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Outlet / Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Vendor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Due Intelligence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900/20">
                  {filteredInvoices.map((invoice) => {
                    const itemCount = Array.isArray(invoice.invoice_items) ? invoice.invoice_items.length : 0;
                    const daysUntilDue = getDaysUntilDue(invoice);
                    const dueLabel =
                      daysUntilDue === null
                        ? 'No due date'
                        : daysUntilDue < 0
                          ? `${Math.abs(daysUntilDue)} day(s) overdue`
                          : daysUntilDue === 0
                            ? 'Due today'
                            : `Due in ${daysUntilDue} day(s)`;
                    const dueBadgeClass =
                      daysUntilDue === null
                        ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        : daysUntilDue < 0
                          ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                          : daysUntilDue <= 7
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
                    const overdueCandidate =
                      isUnpaidStatus(invoice.status) &&
                      normalizeStatus(invoice.status) !== 'overdue' &&
                      daysUntilDue !== null &&
                      daysUntilDue < 0;

                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-6 py-4 align-top">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {invoice.invoice_number || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {itemCount} item{itemCount === 1 ? '' : 's'}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {getOutletLabel(invoice)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {formatBusinessTypeLabel(outletBusinessTypeById[invoice.outlet_id] || 'unspecified')}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-start space-x-2">
                            <Building2 className="w-4 h-4 mt-0.5 text-gray-400" />
                            <div className="text-sm text-gray-900 dark:text-gray-100">
                              {getVendorLabel(invoice)}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-gray-700 dark:text-gray-300">
                          <div>Issued: {formatDateSafe(invoice.issue_date)}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Due: {formatDateSafe(invoice.due_date)}
                          </div>
                          <span
                            className={`inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${dueBadgeClass}`}
                          >
                            {dueLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(toNumber(invoice.total))}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getPaymentBadgeClass(
                              invoice.status
                            )}`}
                          >
                            {isPaidStatus(invoice.status) ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                              invoice.status
                            )}`}
                          >
                            {formatStatusLabel(invoice.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              onClick={() => setSelectedInvoice(invoice)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                            {canMarkPaid && isUnpaidStatus(invoice.status) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                onClick={() => openMarkPaidModal(invoice)}
                                disabled={processingId === invoice.id}
                              >
                                <DollarSign className="w-4 h-4 mr-1" />
                                Paid
                              </Button>
                            )}
                            {overdueCandidate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => {
                                  void handleMarkSingleOverdue(invoice);
                                }}
                                disabled={processingId === invoice.id}
                              >
                                Overdue
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 p-4 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Invoice {selectedInvoice.invoice_number || 'N/A'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Vendor: {getVendorLabel(selectedInvoice)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(null)}>
                Close
              </Button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[78vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    {formatStatusLabel(selectedInvoice.status)}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Payment</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    {isPaidStatus(selectedInvoice.status) ? 'Paid' : 'Unpaid'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Issue Date</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    {formatDateSafe(selectedInvoice.issue_date)}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Due Date</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    {formatDateSafe(selectedInvoice.due_date)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Subtotal</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(toNumber(selectedInvoice.subtotal))}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Tax</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(toNumber(selectedInvoice.tax_amount))}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Total</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(toNumber(selectedInvoice.total))}
                  </p>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Notes</p>
                  <p className="mt-2 text-sm text-gray-900 dark:text-gray-200 whitespace-pre-wrap">
                    {selectedInvoice.notes}
                  </p>
                </div>
              )}

              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Invoice Items</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800/60">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Qty
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Line Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {(selectedInvoice.invoice_items || []).length === 0 ? (
                        <tr>
                          <td
                            className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center"
                            colSpan={4}
                          >
                            No items found on this invoice.
                          </td>
                        </tr>
                      ) : (
                        (selectedInvoice.invoice_items || []).map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                              {item.description || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                              {toNumber(item.quantity)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                              {formatCurrency(toNumber(item.unit_price))}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {formatCurrency(getInvoiceLineTotal(item))}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {markPaidInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 p-4 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Mark Invoice as Paid</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Invoice <span className="font-medium">{markPaidInvoice.invoice_number || 'N/A'}</span> for{' '}
              <span className="font-medium">{formatCurrency(toNumber(markPaidInvoice.total))}</span> will be updated to paid.
            </p>

            <label className="block mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              Payment Method (optional)
            </label>
            <input
              type="text"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              placeholder="Bank transfer, cash, card..."
              className="w-full mt-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />

            <div className="flex items-center justify-end gap-3 mt-6">
              <Button variant="outline" onClick={closeMarkPaidModal} disabled={processingId === markPaidInvoice.id}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleConfirmMarkPaid}
                disabled={processingId === markPaidInvoice.id}
              >
                {processingId === markPaidInvoice.id ? 'Saving...' : 'Confirm Paid'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
