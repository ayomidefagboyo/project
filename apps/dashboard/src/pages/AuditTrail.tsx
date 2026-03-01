import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, CalendarDays, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { apiClient } from '@/lib/apiClient';

interface AuditTrailEntry {
  id: string;
  outlet_id: string;
  user_id?: string | null;
  staff_profile_id?: string | null;
  user_name: string;
  actor_type?: string | null;
  actor_role?: string | null;
  auth_source?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details: string;
  timestamp: string;
}

interface AuditTrailResponse {
  items: AuditTrailEntry[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

const DEFAULT_ENTITY_TYPES = [
  'invoice',
  'expense',
  'eod_report',
  'product',
  'product_import',
  'department',
  'transaction',
  'stocktake',
  'inventory_adjustment',
  'inventory_transfer',
  'held_receipt',
  'cash_drawer_session',
  'receipt_settings',
  'outlet',
  'staff',
  'staff_profile',
  'vendor',
  'report',
  'inventory',
  'sales',
];

const ACTION_OPTIONS = [
  'create',
  'import',
  'validate',
  'update',
  'delete',
  'approve',
  'reject',
  'adjust',
  'return',
  'void',
  'receive',
  'transfer',
  'hold',
  'open',
  'close',
  'reset',
];

const formatLabel = (value: string): string =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getActionColor = (action: string) => {
  const normalized = action.toLowerCase();

  switch (normalized) {
    case 'create':
    case 'receive':
      return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
    case 'update':
    case 'approve':
      return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20';
    case 'delete':
    case 'reject':
    case 'void':
      return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
    default:
      return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
  }
};

const getActionSymbol = (action: string): string => {
  const normalized = action.toLowerCase();
  if (normalized === 'create' || normalized === 'receive') return '✚';
  if (normalized === 'update' || normalized === 'approve') return '✎';
  if (normalized === 'delete' || normalized === 'reject' || normalized === 'void') return '✖';
  if (normalized === 'transfer') return '⇄';
  return '•';
};

const AuditTrail: React.FC = () => {
  const { currentOutlet } = useOutlet();

  const [entries, setEntries] = useState<AuditTrailEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const loadAuditTrail = async () => {
    if (!currentOutlet?.id) {
      setEntries([]);
      setTotalEntries(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string | number> = {
        outlet_id: currentOutlet.id,
        page: 1,
        size: 200,
      };

      if (entityFilter !== 'all') params.entity_type = entityFilter;
      if (actionFilter !== 'all') params.action = actionFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (debouncedSearchTerm) params.search = debouncedSearchTerm;

      const response = await apiClient.get<AuditTrailResponse>('/audit/', params);
      if (response.error || !response.data) {
        throw new Error(response.error || 'Failed to load audit trail');
      }

      const apiItems = Array.isArray(response.data.items) ? response.data.items : [];
      const sortedEntries = [...apiItems].sort((left, right) => {
        return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
      });

      setEntries(sortedEntries);
      setTotalEntries(Number(response.data.total || sortedEntries.length));
    } catch (loadError) {
      console.error('Failed to load audit trail:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load audit trail');
      setEntries([]);
      setTotalEntries(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAuditTrail();
  }, [currentOutlet?.id, entityFilter, actionFilter, dateFrom, dateTo, debouncedSearchTerm]);

  const entityOptions = useMemo(() => {
    const fromData = entries.map((entry) => String(entry.entity_type || '').toLowerCase()).filter(Boolean);
    return Array.from(new Set([...DEFAULT_ENTITY_TYPES, ...fromData])).sort();
  }, [entries]);

  const handleExportCsv = () => {
    if (entries.length === 0) return;

    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details'],
      ...entries.map((entry) => [
        entry.timestamp,
        entry.user_name || 'Unknown',
        entry.action,
        entry.entity_type,
        entry.entity_id || '',
        entry.details,
      ]),
    ];

    const csv = rows.map((row) => row.map((value) => escapeCsv(value)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-trail-${currentOutlet?.name || 'outlet'}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!currentOutlet) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">Select an outlet to view audit trail activity.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Audit Trail</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Track all changes and activities for {currentOutlet.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center justify-center"
            onClick={() => void loadAuditTrail()}
            disabled={loading}
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center justify-center"
            onClick={handleExportCsv}
            disabled={entries.length === 0}
          >
            <Download size={16} className="mr-2" />
            Export
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-2">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search audit entries..."
            className="w-full h-9 sm:h-10 pl-10 pr-3 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 w-full lg:w-auto lg:flex lg:flex-row">
          <div className="relative min-w-0 lg:w-auto">
            <select
              className="appearance-none w-full h-9 pl-3 pr-7 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value)}
            >
              <option value="all">All Types</option>
              {entityOptions.map((type) => (
                <option key={type} value={type}>{formatLabel(type)}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
              <Filter size={14} />
            </div>
          </div>

          <div className="relative min-w-0 lg:w-auto">
            <select
              className="appearance-none w-full h-9 pl-3 pr-7 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
            >
              <option value="all">All Actions</option>
              {ACTION_OPTIONS.map((action) => (
                <option key={action} value={action}>{formatLabel(action)}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
              <Filter size={14} />
            </div>
          </div>

          <div className="relative min-w-0 lg:w-auto">
            <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              aria-label="From date"
              className="w-full h-9 lg:w-36 xl:w-40 pl-8 pr-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="relative min-w-0 lg:w-auto">
            <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              aria-label="To date"
              className="w-full h-9 lg:w-36 xl:w-40 pl-8 pr-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Showing {entries.length} of {totalEntries} entries
        </div>

        {loading ? (
          <div className="text-center py-16">
            <p className="text-gray-500 dark:text-gray-400">Loading audit entries...</p>
          </div>
        ) : (
          <div className="flow-root">
            <ul role="list" className="-mb-8">
              {entries.map((entry, entryIdx) => (
                <li key={entry.id}>
                  <div className="relative pb-8">
                    {entryIdx !== entries.length - 1 ? (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true"></span>
                    ) : null}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-800 ${getActionColor(entry.action)}`}>
                          {getActionSymbol(entry.action)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 pt-1.5 flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-4">
                        <div>
                          <p className="text-sm text-gray-900 dark:text-white">{entry.details}</p>
                          <div className="mt-1 flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <p>By {entry.user_name || 'Unknown'}</p>
                            <span className="mx-1">•</span>
                            <p>Entity: {formatLabel(entry.entity_type || 'unknown')}</p>
                          </div>
                        </div>
                        <div className="text-sm whitespace-nowrap text-gray-500 dark:text-gray-400 sm:text-right">
                          {formatDateTime(entry.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 dark:text-gray-400">No audit entries found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditTrail;
