import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Eye,
  Loader2,
  Receipt,
  RefreshCw,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

type InvoiceStatus = 'draft' | 'pending' | 'received' | 'paid' | 'cancelled' | string;
type PaymentStatus = 'paid' | 'unpaid' | '' | string;

interface VendorRelation {
  id?: string;
  name?: string | null;
}

interface InvoiceListItem {
  id: string;
  outlet_id: string;
  invoice_number: string;
  vendor_id?: string | null;
  vendors?: VendorRelation | null;
  issue_date?: string | null;
  due_date?: string | null;
  status?: InvoiceStatus;
  payment_status?: PaymentStatus | null;
  payment_date?: string | null;
  total?: number | string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface InvoiceItemRecord {
  id?: string;
  description?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  total?: number | string | null;
  category?: string | null;
  sku?: string | null;
  barcode?: string | null;
  received_quantity?: number | string | null;
  remaining_quantity?: number | string | null;
}

interface InvoiceDetailRecord extends InvoiceListItem {
  invoice_items?: InvoiceItemRecord[];
  vendors?: VendorRelation | null;
  customers?: Record<string, unknown> | null;
  tax_rate?: number | string | null;
  subtotal?: number | string | null;
  tax_amount?: number | string | null;
}

interface InvoiceListResponse {
  items: InvoiceListItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
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

const normalizeStatus = (value: unknown): string => String(value || '').trim().toLowerCase();

const normalizePaymentStatus = (invoice: Pick<InvoiceListItem, 'payment_status' | 'status'>): string => {
  const direct = normalizeStatus(invoice.payment_status);
  if (direct === 'paid' || direct === 'unpaid') {
    return direct;
  }

  const workflowStatus = normalizeStatus(invoice.status);
  if (workflowStatus === 'paid') {
    return 'paid';
  }
  if (workflowStatus === 'cancelled') {
    return '';
  }
  if (workflowStatus) {
    return 'unpaid';
  }
  return '';
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

const getVendorName = (invoice: InvoiceListItem | InvoiceDetailRecord): string => {
  const name = String(invoice.vendors?.name || '').trim();
  return name || 'Unassigned vendor';
};

const stripPaymentMarkers = (notes?: string | null): string => {
  const lines = String(notes || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('[Payment status:'))
    .filter((line) => !line.startsWith('[Payment date:'))
    .filter((line) => !line.startsWith('[Received on '));
  return lines.join('\n');
};

const formatStatusLabel = (value?: string | null): string => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return 'Unknown';
  }
  return normalized
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const getTodayInputValue = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Invoices: React.FC = () => {
  const { currentUser, currentOutlet, canApproveVendorInvoices } = useOutlet();

  const [vendorInvoices, setVendorInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [processingInvoiceId, setProcessingInvoiceId] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<InvoiceDetailRecord | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<InvoiceListItem | null>(null);
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const canManageStatuses = canApproveVendorInvoices();
  const today = useMemo(() => startOfLocalDay(), []);

  const currencyCode = useMemo(() => {
    const outletCurrency = String(currentOutlet?.currency || '').trim().toUpperCase();
    return outletCurrency || 'NGN';
  }, [currentOutlet?.currency]);

  const formatMoney = (amount: number): string => {
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

  const fetchInvoicesForOutlet = async (outletId: string): Promise<InvoiceListItem[]> => {
    const records: InvoiceListItem[] = [];
    let page = 1;

    while (true) {
      const response = await apiClient.get<InvoiceListResponse>('/invoices/', {
        outlet_id: outletId,
        invoice_type: 'vendor',
        page,
        size: INVOICE_PAGE_SIZE,
      });

      if (response.error || !response.data) {
        throw new Error(response.error || 'Failed to load vendor invoices');
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
    if (!currentUser || !currentOutlet?.id) {
      setVendorInvoices([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const records = await fetchInvoicesForOutlet(currentOutlet.id);
      const sorted = [...records].sort((left, right) => {
        const leftDate = new Date(left.created_at || left.issue_date || 0).getTime();
        const rightDate = new Date(right.created_at || right.issue_date || 0).getTime();
        return rightDate - leftDate;
      });
      setVendorInvoices(sorted);
    } catch (loadError) {
      console.error('Failed to load vendor invoices', loadError);
      setVendorInvoices([]);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load vendor invoices');
    } finally {
      setLoading(false);
    }
  };

  useRealtimeSync({
    outletId: currentOutlet?.id || '',
    enabled: !!currentUser && !!currentOutlet?.id,
    onInvoiceChange: () => {
      void loadVendorInvoices();
    },
  });

  useEffect(() => {
    if (currentUser && currentOutlet?.id) {
      void loadVendorInvoices();
    } else {
      setVendorInvoices([]);
      setLoading(false);
    }
  }, [currentUser?.id, currentOutlet?.id]);

  const filteredInvoices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return vendorInvoices;
    }

    return vendorInvoices.filter((invoice) => {
      const invoiceNumber = String(invoice.invoice_number || '').toLowerCase();
      const vendorName = getVendorName(invoice).toLowerCase();
      const notes = String(stripPaymentMarkers(invoice.notes) || '').toLowerCase();
      return invoiceNumber.includes(query) || vendorName.includes(query) || notes.includes(query);
    });
  }, [searchQuery, vendorInvoices]);

  const metrics = useMemo(() => {
    let totalAmount = 0;
    let outstandingAmount = 0;
    let overdueAmount = 0;
    let dueSoonAmount = 0;
    let paidAmount = 0;
    let outstandingCount = 0;
    let overdueCount = 0;
    let dueSoonCount = 0;

    filteredInvoices.forEach((invoice) => {
      const amount = toNumber(invoice.total);
      const paymentStatus = normalizePaymentStatus(invoice);
      const daysUntilDue = getDaysUntilDate(invoice.due_date, today);

      totalAmount += amount;

      if (paymentStatus === 'paid') {
        paidAmount += amount;
        return;
      }

      if (paymentStatus === 'unpaid') {
        outstandingAmount += amount;
        outstandingCount += 1;

        if (daysUntilDue !== null && daysUntilDue < 0) {
          overdueAmount += amount;
          overdueCount += 1;
        } else if (daysUntilDue !== null && daysUntilDue <= 7) {
          dueSoonAmount += amount;
          dueSoonCount += 1;
        }
      }
    });

    return {
      totalInvoices: filteredInvoices.length,
      totalAmount,
      outstandingAmount,
      overdueAmount,
      dueSoonAmount,
      paidAmount,
      outstandingCount,
      overdueCount,
      dueSoonCount,
    };
  }, [filteredInvoices, today]);

  const handleViewInvoice = async (invoiceId: string) => {
    try {
      setProcessingInvoiceId(invoiceId);
      setError(null);
      const response = await apiClient.get<InvoiceDetailRecord>(`/invoices/${invoiceId}`);
      if (response.error || !response.data) {
        throw new Error(response.error || 'Failed to load invoice details');
      }
      setViewInvoice(response.data);
      setIsViewOpen(true);
    } catch (viewError) {
      console.error('Failed to view invoice', viewError);
      setError(viewError instanceof Error ? viewError.message : 'Failed to load invoice details');
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  const handleOpenMarkPaid = (invoice: InvoiceListItem) => {
    const defaultPaymentDate = String(invoice.payment_date || '').trim() || getTodayInputValue();
    setPaymentModalInvoice(invoice);
    setPaymentDate(defaultPaymentDate);
    setInfoMessage(null);
    setError(null);
  };

  const handleConfirmMarkPaid = async () => {
    if (!paymentModalInvoice) {
      return;
    }

    if (!paymentDate) {
      setError('Select a payment date before saving.');
      return;
    }

    try {
      setProcessingInvoiceId(paymentModalInvoice.id);
      setError(null);
      const response = await apiClient.put<InvoiceDetailRecord>(`/invoices/${paymentModalInvoice.id}`, {
        payment_status: 'paid',
        payment_date: paymentDate,
      });

      if (response.error || !response.data) {
        throw new Error(response.error || 'Failed to mark invoice as paid');
      }

      setInfoMessage(`Marked ${paymentModalInvoice.invoice_number} as paid.`);
      setPaymentModalInvoice(null);
      await loadVendorInvoices();

      if (viewInvoice?.id === paymentModalInvoice.id) {
        setViewInvoice((current) => (current ? { ...current, ...response.data } : current));
      }
    } catch (markError) {
      console.error('Failed to mark invoice paid', markError);
      setError(markError instanceof Error ? markError.message : 'Failed to mark invoice as paid');
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  const handleMarkUnpaid = async (invoice: InvoiceListItem) => {
    const confirmed = window.confirm(`Mark ${invoice.invoice_number} as unpaid? Existing payment date will remain for audit history.`);
    if (!confirmed) {
      return;
    }

    try {
      setProcessingInvoiceId(invoice.id);
      setError(null);
      const response = await apiClient.put<InvoiceDetailRecord>(`/invoices/${invoice.id}`, {
        payment_status: 'unpaid',
      });

      if (response.error || !response.data) {
        throw new Error(response.error || 'Failed to mark invoice as unpaid');
      }

      setInfoMessage(`Marked ${invoice.invoice_number} as unpaid.`);
      await loadVendorInvoices();

      if (viewInvoice?.id === invoice.id) {
        setViewInvoice((current) => (current ? { ...current, ...response.data } : current));
      }
    } catch (markError) {
      console.error('Failed to mark invoice unpaid', markError);
      setError(markError instanceof Error ? markError.message : 'Failed to mark invoice as unpaid');
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  const handleExportCsv = () => {
    const rows = filteredInvoices.map((invoice) => {
      const paymentStatus = normalizePaymentStatus(invoice) || 'unknown';
      const daysUntilDue = getDaysUntilDate(invoice.due_date, today);
      const dueSignal = daysUntilDue === null
        ? 'No due date'
        : daysUntilDue < 0
          ? `${Math.abs(daysUntilDue)} day(s) overdue`
          : `${daysUntilDue} day(s) remaining`;

      return [
        invoice.invoice_number,
        getVendorName(invoice),
        invoice.issue_date || '',
        invoice.due_date || '',
        formatStatusLabel(invoice.status),
        formatStatusLabel(paymentStatus),
        invoice.payment_date || '',
        String(toNumber(invoice.total)),
        dueSignal,
        JSON.stringify(stripPaymentMarkers(invoice.notes) || ''),
      ];
    });

    const csv = [
      ['Invoice Number', 'Vendor', 'Issue Date', 'Due Date', 'Workflow Status', 'Payment Status', 'Payment Date', 'Amount', 'Due Signal', 'Notes'].join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vendor-invoice-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getWorkflowBadgeClass = (status?: string | null): string => {
    switch (normalizeStatus(status)) {
      case 'received':
        return 'bg-blue-100 text-blue-700';
      case 'paid':
        return 'bg-emerald-100 text-emerald-700';
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'draft':
        return 'bg-slate-100 text-slate-700';
      case 'cancelled':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getPaymentBadgeClass = (paymentStatus: string): string => {
    switch (paymentStatus) {
      case 'paid':
        return 'bg-emerald-100 text-emerald-700';
      case 'unpaid':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            <Receipt size={14} />
            AP Ledger
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Vendor Invoice Ledger</h1>
            <p className="mt-1 text-sm text-gray-600">
              Track vendor invoices, unpaid exposure, and payment history for cash outflow control.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadVendorInvoices()} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={loading || filteredInvoices.length === 0}>
            <Download size={16} className="mr-2" />
            Export
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {infoMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {infoMessage}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total Invoices</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{metrics.totalInvoices}</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
              <Receipt size={18} />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">{formatMoney(metrics.totalAmount)} total invoice value</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Outstanding</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{formatMoney(metrics.outstandingAmount)}</p>
            </div>
            <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
              <Wallet size={18} />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">{metrics.outstandingCount} unpaid invoices</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Overdue</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{formatMoney(metrics.overdueAmount)}</p>
            </div>
            <div className="rounded-xl bg-rose-100 p-2 text-rose-700">
              <AlertCircle size={18} />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">{metrics.overdueCount} overdue invoices</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Due In 7 Days</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{formatMoney(metrics.dueSoonAmount)}</p>
            </div>
            <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
              <Clock3 size={18} />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">{metrics.dueSoonCount} invoices due soon</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paid Outflow</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{formatMoney(metrics.paidAmount)}</p>
            </div>
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
              <CreditCard size={18} />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">Settled supplier payments in this ledger</p>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
            <p className="text-sm text-gray-500">View invoice details and manage payment status.</p>
          </div>
          <div className="w-full lg:w-80">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search invoice number, vendor, or notes"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin" />
            Loading vendor invoices...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-gray-500">
            No vendor invoices found for this outlet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Vendor</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Issue Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Due Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Workflow</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Payment</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Payment Date</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredInvoices.map((invoice) => {
                  const workflowStatus = normalizeStatus(invoice.status) || 'unknown';
                  const paymentStatus = normalizePaymentStatus(invoice);
                  const daysUntilDue = getDaysUntilDate(invoice.due_date, today);
                  const isProcessing = processingInvoiceId === invoice.id;
                  const isOverdue = paymentStatus === 'unpaid' && daysUntilDue !== null && daysUntilDue < 0;
                  const canMarkPaid = canManageStatuses && paymentStatus !== 'paid';
                  const canMarkUnpaid = canManageStatuses && paymentStatus === 'paid';

                  return (
                    <tr key={invoice.id} className="align-top">
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">{invoice.invoice_number}</div>
                        {isOverdue ? (
                          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                            <AlertCircle size={12} />
                            {Math.abs(daysUntilDue || 0)} day(s) overdue
                          </div>
                        ) : daysUntilDue !== null && paymentStatus === 'unpaid' && daysUntilDue <= 7 ? (
                          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            <Clock3 size={12} />
                            Due in {daysUntilDue} day(s)
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-gray-700">{getVendorName(invoice)}</td>
                      <td className="px-4 py-4 text-gray-700">{invoice.issue_date ? formatDate(invoice.issue_date) : 'Not set'}</td>
                      <td className="px-4 py-4 text-gray-700">{invoice.due_date ? formatDate(invoice.due_date) : 'Not set'}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getWorkflowBadgeClass(workflowStatus)}`}>
                          {formatStatusLabel(workflowStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getPaymentBadgeClass(paymentStatus)}`}>
                          {paymentStatus ? formatStatusLabel(paymentStatus) : 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-700">{invoice.payment_date ? formatDate(invoice.payment_date) : 'Not recorded'}</td>
                      <td className="px-4 py-4 text-right font-medium text-gray-900">{formatMoney(toNumber(invoice.total))}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => void handleViewInvoice(invoice.id)} disabled={isProcessing}>
                            <Eye size={14} className="mr-1.5" />
                            View
                          </Button>
                          {canMarkPaid ? (
                            <Button variant="outline" size="sm" onClick={() => handleOpenMarkPaid(invoice)} disabled={isProcessing}>
                              <CheckCircle2 size={14} className="mr-1.5" />
                              Mark Paid
                            </Button>
                          ) : null}
                          {canMarkUnpaid ? (
                            <Button variant="outline" size="sm" onClick={() => void handleMarkUnpaid(invoice)} disabled={isProcessing}>
                              <XCircle size={14} className="mr-1.5" />
                              Mark Unpaid
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {paymentModalInvoice ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Mark Invoice Paid</h3>
              <p className="mt-1 text-sm text-gray-500">
                Choose the payment date for {paymentModalInvoice.invoice_number}.
              </p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="payment-date" className="mb-2 block text-sm font-medium text-gray-700">
                  Payment Date
                </label>
                <input
                  id="payment-date"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Existing payment date is preserved when you later mark an invoice unpaid.
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <Button variant="ghost" onClick={() => setPaymentModalInvoice(null)} disabled={processingInvoiceId === paymentModalInvoice.id}>
                Cancel
              </Button>
              <Button onClick={() => void handleConfirmMarkPaid()} disabled={processingInvoiceId === paymentModalInvoice.id}>
                {processingInvoiceId === paymentModalInvoice.id ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 size={16} className="mr-2" />
                )}
                Save Payment
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isViewOpen && viewInvoice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Invoice {viewInvoice.invoice_number}</h3>
                <p className="mt-1 text-sm text-gray-500">Full invoice context and payment state.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsViewOpen(false)}>
                <XCircle size={16} className="mr-1.5" />
                Close
              </Button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vendor</p>
                  <p className="mt-2 text-sm font-medium text-gray-900">{getVendorName(viewInvoice)}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Issue Date</p>
                  <p className="mt-2 text-sm font-medium text-gray-900">{viewInvoice.issue_date ? formatDate(viewInvoice.issue_date) : 'Not set'}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Due Date</p>
                  <p className="mt-2 text-sm font-medium text-gray-900">{viewInvoice.due_date ? formatDate(viewInvoice.due_date) : 'Not set'}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{formatMoney(toNumber(viewInvoice.total))}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Workflow Status</p>
                  <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getWorkflowBadgeClass(viewInvoice.status)}`}>
                    {formatStatusLabel(viewInvoice.status)}
                  </span>
                </div>
                <div className="rounded-2xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment Status</p>
                  <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getPaymentBadgeClass(normalizePaymentStatus(viewInvoice))}`}>
                    {formatStatusLabel(normalizePaymentStatus(viewInvoice) || 'unknown')}
                  </span>
                </div>
                <div className="rounded-2xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment Date</p>
                  <p className="mt-3 text-sm font-medium text-gray-900">{viewInvoice.payment_date ? formatDate(viewInvoice.payment_date) : 'Not recorded'}</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                  <h4 className="text-sm font-semibold text-gray-900">Line Items</h4>
                  <span className="text-xs text-gray-500">{viewInvoice.invoice_items?.length || 0} items</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Qty</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Unit Price</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Received</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Remaining</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {(viewInvoice.invoice_items || []).map((item) => (
                        <tr key={item.id || `${item.description}-${item.sku}`}>
                          <td className="px-4 py-3 text-gray-900">
                            <div className="font-medium">{item.description || 'Unnamed line item'}</div>
                            {item.category ? <div className="text-xs text-gray-500">{item.category}</div> : null}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{toNumber(item.quantity)}</td>
                          <td className="px-4 py-3 text-gray-700">{formatMoney(toNumber(item.unit_price))}</td>
                          <td className="px-4 py-3 text-gray-700">{item.received_quantity !== undefined && item.received_quantity !== null ? toNumber(item.received_quantity) : '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{item.remaining_quantity !== undefined && item.remaining_quantity !== null ? toNumber(item.remaining_quantity) : '—'}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{formatMoney(toNumber(item.total) || (toNumber(item.quantity) * toNumber(item.unit_price)))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900">Notes</h4>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600">
                    {stripPaymentMarkers(viewInvoice.notes) || 'No notes recorded.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900">Summary</h4>
                  <dl className="mt-3 space-y-2 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <dt>Subtotal</dt>
                      <dd className="font-medium text-gray-900">{formatMoney(toNumber(viewInvoice.subtotal))}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt>Tax</dt>
                      <dd className="font-medium text-gray-900">{formatMoney(toNumber(viewInvoice.tax_amount))}</dd>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                      <dt className="font-semibold text-gray-900">Total</dt>
                      <dd className="font-semibold text-gray-900">{formatMoney(toNumber(viewInvoice.total))}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
              <div className="text-xs text-gray-500">
                {viewInvoice.updated_at ? `Last updated ${formatDate(viewInvoice.updated_at)}` : 'Invoice details loaded'}
              </div>
              <div className="flex items-center gap-2">
                {canManageStatuses && normalizePaymentStatus(viewInvoice) !== 'paid' ? (
                  <Button variant="outline" size="sm" onClick={() => handleOpenMarkPaid(viewInvoice)}>
                    <CheckCircle2 size={14} className="mr-1.5" />
                    Mark Paid
                  </Button>
                ) : null}
                {canManageStatuses && normalizePaymentStatus(viewInvoice) === 'paid' ? (
                  <Button variant="outline" size="sm" onClick={() => void handleMarkUnpaid(viewInvoice)}>
                    <XCircle size={14} className="mr-1.5" />
                    Mark Unpaid
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Invoices;
