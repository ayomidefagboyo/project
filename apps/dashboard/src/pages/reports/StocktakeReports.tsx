import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Eye,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import {
  stocktakeReportService,
  type StocktakeSessionSummary,
  type StocktakeSessionDetail
} from '@/lib/stocktakeReportService';

const formatNaira = (amount: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const StocktakeReports: React.FC = () => {
  const { currentOutlet } = useOutlet();
  const [sessions, setSessions] = useState<StocktakeSessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size] = useState(25);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<StocktakeSessionDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / size));

  const loadSessions = useCallback(async () => {
    if (!currentOutlet?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await stocktakeReportService.listStocktakeSessions(currentOutlet.id, {
        page,
        size,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });
      setSessions(response.items || []);
      setTotal(response.total || 0);
    } catch (loadError) {
      setSessions([]);
      setTotal(0);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load stocktake reports');
    } finally {
      setIsLoading(false);
    }
  }, [currentOutlet?.id, page, size, dateFrom, dateTo]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const openDetail = useCallback(async (sessionId: string) => {
    if (!currentOutlet?.id) return;
    setSelectedSessionId(sessionId);
    setSelectedDetail(null);
    setDetailError(null);
    setIsDetailLoading(true);
    try {
      const detail = await stocktakeReportService.getStocktakeSessionDetail(sessionId, currentOutlet.id);
      setSelectedDetail(detail);
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : 'Failed to load stocktake details');
    } finally {
      setIsDetailLoading(false);
    }
  }, [currentOutlet?.id]);

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) => {
      return (
        session.id.toLowerCase().includes(query) ||
        (session.performed_by_name || '').toLowerCase().includes(query) ||
        (session.terminal_id || '').toLowerCase().includes(query)
      );
    });
  }, [sessions, search]);
  const showEmptyState = !isLoading && filteredSessions.length === 0;

  if (!currentOutlet) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-sm text-gray-600 dark:text-gray-300">Select an outlet to view stocktake reports.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Stocktake Reports</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Reconciliation sessions and item-level variance history for {currentOutlet.name}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="inline-flex items-center gap-2 w-fit"
          onClick={() => void loadSessions()}
          disabled={isLoading}
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <div className="relative sm:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by session, staff, terminal"
              className="w-full h-9 sm:h-10 rounded-lg border border-gray-300 dark:border-gray-600 pl-9 pr-3 text-sm bg-white dark:bg-gray-800"
            />
          </div>
          <div className="relative">
            <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setPage(1);
                setDateFrom(event.target.value);
              }}
              aria-label="From date"
              className="w-full h-9 sm:h-10 rounded-lg border border-gray-300 dark:border-gray-600 pl-8 pr-2 text-xs sm:text-sm bg-white dark:bg-gray-800"
            />
          </div>
          <div className="relative">
            <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setPage(1);
                setDateTo(event.target.value);
              }}
              aria-label="To date"
              className="w-full h-9 sm:h-10 rounded-lg border border-gray-300 dark:border-gray-600 pl-8 pr-2 text-xs sm:text-sm bg-white dark:bg-gray-800"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {isLoading && (
            <div className="px-4 py-10 text-center text-sm text-gray-500">Loading stocktake reports...</div>
          )}
          {showEmptyState && (
            <div className="px-4 py-10 text-center text-sm text-gray-500">No stocktake sessions found.</div>
          )}
          {!isLoading && filteredSessions.map((session) => (
            <div key={session.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {session.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-500">{session.terminal_id || 'No terminal'}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs inline-flex items-center gap-1"
                  onClick={() => void openDetail(session.id)}
                >
                  <Eye size={14} />
                  View
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500">Completed</p>
                  <p className="text-gray-800 dark:text-gray-200">{formatDateTime(session.completed_at)}</p>
                </div>
                <div>
                  <p className="text-gray-500">By</p>
                  <p className="text-gray-800 dark:text-gray-200">{session.performed_by_name || 'System'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Adjusted</p>
                  <p className="text-gray-800 dark:text-gray-200">{session.adjusted_items} / {session.total_items}</p>
                </div>
                <div>
                  <p className="text-gray-500">Net Variance</p>
                  <p className={session.net_quantity_variance >= 0 ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                    {session.net_quantity_variance >= 0 ? '+' : ''}
                    {session.net_quantity_variance}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Value Impact: {formatNaira(session.total_variance_value)}
              </p>
            </div>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Session</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Completed</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Adjusted</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Net Variance</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Value Impact</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">Loading stocktake reports...</td>
                </tr>
              )}

              {showEmptyState && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                    No stocktake sessions found.
                  </td>
                </tr>
              )}

              {!isLoading && filteredSessions.map((session) => (
                <tr key={session.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    <div className="font-semibold">{session.id.slice(0, 8).toUpperCase()}</div>
                    <div className="text-xs text-gray-500">{session.terminal_id || 'No terminal'}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {formatDateTime(session.completed_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {session.performed_by_name || 'System'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {session.adjusted_items} / {session.total_items}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <span className={session.net_quantity_variance >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                      {session.net_quantity_variance >= 0 ? '+' : ''}
                      {session.net_quantity_variance}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {formatNaira(session.total_variance_value)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      className="h-8 px-3 text-xs inline-flex items-center gap-1"
                      onClick={() => void openDetail(session.id)}
                    >
                      <Eye size={14} />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Page {page} of {totalPages} ({total} total sessions)
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {selectedSessionId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Stocktake Session Details</h2>
                <p className="text-xs text-gray-500 mt-1">{selectedSessionId}</p>
              </div>
              <button
                className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => {
                  setSelectedSessionId(null);
                  setSelectedDetail(null);
                  setDetailError(null);
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-auto max-h-[75vh] space-y-4">
              {isDetailLoading && (
                <p className="text-sm text-gray-600 dark:text-gray-300">Loading session details...</p>
              )}

              {detailError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {detailError}
                </div>
              )}

              {selectedDetail && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <p className="text-xs text-gray-500">Adjusted Items</p>
                      <p className="text-lg font-semibold">{selectedDetail.session.adjusted_items}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <p className="text-xs text-gray-500">Unchanged Items</p>
                      <p className="text-lg font-semibold">{selectedDetail.session.unchanged_items}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <p className="text-xs text-gray-500">Net Variance</p>
                      <p className="text-lg font-semibold">{selectedDetail.session.net_quantity_variance}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <p className="text-xs text-gray-500">Total Value Impact</p>
                      <p className="text-lg font-semibold">{formatNaira(selectedDetail.session.total_variance_value)}</p>
                    </div>
                  </div>

                  <div className="md:hidden space-y-2">
                    {selectedDetail.items.map((item) => (
                      <div key={item.movement_id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-1">
                        <p className="text-sm font-semibold">{item.product_name}</p>
                        <p className="text-xs text-gray-500">SKU: {item.sku || '-'}</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-gray-500">System</p>
                            <p>{item.system_quantity}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Counted</p>
                            <p>{item.counted_quantity}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Variance</p>
                            <p className={item.quantity_change >= 0 ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                              {item.quantity_change >= 0 ? '+' : ''}
                              {item.quantity_change}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300">Reason: {item.reason || '-'}</p>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Product</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">SKU</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">System</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Counted</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Variance</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDetail.items.map((item) => (
                          <tr key={item.movement_id} className="border-t border-gray-100 dark:border-gray-800">
                            <td className="px-3 py-2 text-sm font-medium">{item.product_name}</td>
                            <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">{item.sku || '-'}</td>
                            <td className="px-3 py-2 text-sm text-right">{item.system_quantity}</td>
                            <td className="px-3 py-2 text-sm text-right">{item.counted_quantity}</td>
                            <td className="px-3 py-2 text-sm text-right">
                              <span className={item.quantity_change >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                                {item.quantity_change >= 0 ? '+' : ''}
                                {item.quantity_change}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{item.reason || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StocktakeReports;
