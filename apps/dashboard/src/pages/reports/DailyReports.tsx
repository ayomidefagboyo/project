import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Calendar,
  Clock3,
  Download,
  FileText,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useOutlet } from '@/contexts/OutletContext';
import { eodService } from '@/lib/eodServiceNew';
import type { EnhancedDailyReport } from '@/types';

const getTodayValue = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return 'N/A';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A';
  }

  return parsed.toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toAmount = (value: unknown): number => {
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

const getReportExpenses = (report: EnhancedDailyReport): number => {
  return toAmount(report.total_expenses) || toAmount(report.expenses);
};

const getReportNet = (report: EnhancedDailyReport): number => {
  return toAmount(report.total_sales) - getReportExpenses(report);
};

const matchesSearch = (report: EnhancedDailyReport, query: string): boolean => {
  if (!query) {
    return true;
  }

  const haystack = [
    report.date,
    report.created_by,
    report.status,
    report.notes,
    report.id,
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');

  return haystack.includes(query);
};

const DailyReports: React.FC = () => {
  const { currentOutlet } = useOutlet();
  const [reports, setReports] = useState<EnhancedDailyReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!currentOutlet?.id) {
      setReports([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: loadError } = await eodService.getReports(currentOutlet.id);
      if (loadError) {
        setError(loadError);
        setReports([]);
        return;
      }

      const sorted = [...(data || [])].sort((left, right) => {
        const leftTime = new Date(left.created_at || left.updated_at || left.date || 0).getTime();
        const rightTime = new Date(right.created_at || right.updated_at || right.date || 0).getTime();
        return rightTime - leftTime;
      });

      setReports(sorted);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load daily reports');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [currentOutlet?.id]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const filteredReports = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesDate = !selectedDate || report.date === selectedDate;
      return matchesDate && matchesSearch(report, query);
    });
  }, [reports, searchTerm, selectedDate]);

  const summary = useMemo(() => {
    const today = getTodayValue();
    const visibleSales = filteredReports.reduce((sum, report) => sum + toAmount(report.total_sales), 0);
    const visibleExpenses = filteredReports.reduce((sum, report) => sum + getReportExpenses(report), 0);
    const visibleNet = visibleSales - visibleExpenses;
    const todayCount = reports.filter((report) => report.date === today).length;
    const latestReport = reports[0] || null;
    const averageNet = filteredReports.length > 0 ? visibleNet / filteredReports.length : 0;

    return {
      totalReports: reports.length,
      visibleReports: filteredReports.length,
      visibleSales,
      visibleExpenses,
      visibleNet,
      todayCount,
      latestReport,
      averageNet,
    };
  }, [filteredReports, reports]);

  const handleExport = () => {
    if (filteredReports.length === 0) {
      return;
    }

    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Report Date', 'Submitted At', 'Submitted By', 'Status', 'Sales', 'Expenses', 'Net', 'Closing Balance'],
      ...filteredReports.map((report) => [
        report.date,
        report.created_at || report.updated_at || '',
        report.created_by || 'System',
        report.status,
        toAmount(report.total_sales).toFixed(2),
        getReportExpenses(report).toFixed(2),
        getReportNet(report).toFixed(2),
        toAmount(report.closing_balance).toFixed(2),
      ]),
    ];

    const csv = rows.map((row) => row.map((value) => escapeCsv(value)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily-reports-${currentOutlet?.name || 'outlet'}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!currentOutlet) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-sm text-gray-600 dark:text-gray-300">Select an outlet to view daily reports.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 rounded-xl flex items-center justify-center shadow-sm">
                <BarChart3 className="w-5 h-5 text-white dark:text-gray-900" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-light text-gray-900 dark:text-white tracking-tight">Daily Reports</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-light">
              EOD submissions, timestamps, and outlet-level performance for {currentOutlet.name}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                void loadReports();
              }}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={handleExport}
              disabled={filteredReports.length === 0}
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link to="/dashboard/daily-reports/create" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span>New Report</span>
              </Link>
            </Button>
          </div>
        </div>

        {error && (
          <div className="card border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 p-4">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="card p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Reports Logged</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{summary.visibleReports}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.totalReports} total for this outlet
                  </p>
                </div>
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Today</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{summary.todayCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">EOD submissions today</p>
                </div>
                <Clock3 className="w-5 h-5 text-gray-400" />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Sales Captured</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(summary.visibleSales)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Current visible list</p>
                </div>
                <Activity className="w-5 h-5 text-gray-400" />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Net After Expenses</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(summary.visibleNet)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Average: {formatCurrency(summary.averageNet)}</p>
                </div>
                <TrendingUp className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Latest EOD Submission</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  The most recent closeout recorded for this outlet.
                </p>
              </div>
              <Clock3 className="w-5 h-5 text-gray-400 mt-1" />
            </div>
            {summary.latestReport ? (
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500 dark:text-gray-400">Report date</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatDate(summary.latestReport.date)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500 dark:text-gray-400">Submitted</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatDateTime(summary.latestReport.created_at || summary.latestReport.updated_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500 dark:text-gray-400">Submitted by</span>
                  <span className="font-medium text-gray-900 dark:text-white">{summary.latestReport.created_by || 'System'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500 dark:text-gray-400">Closing balance</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(toAmount(summary.latestReport.closing_balance))}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No EOD reports recorded yet for this outlet.</p>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Outlet Snapshot</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Quick spend and closeout view for the currently visible reports.
                </p>
              </div>
              <Wallet className="w-5 h-5 text-gray-400 mt-1" />
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 dark:text-gray-400">Operating expenses</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(summary.visibleExpenses)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 dark:text-gray-400">Average daily sales</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(summary.visibleReports > 0 ? summary.visibleSales / summary.visibleReports : 0)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 dark:text-gray-400">Average closing balance</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(
                    summary.visibleReports > 0
                      ? filteredReports.reduce((sum, report) => sum + toAmount(report.closing_balance), 0) / summary.visibleReports
                      : 0
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by date, staff, status, note, or report ID"
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="relative w-full lg:w-56">
              <Calendar className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
              />
            </div>
            {selectedDate && (
              <Button
                variant="outline"
                className="w-full lg:w-auto"
                onClick={() => setSelectedDate('')}
              >
                Clear Date
              </Button>
            )}
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">EOD History</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Every daily closeout for the currently selected outlet, including exact submission time.
            </p>
          </div>

          <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
            {loading && (
              <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading daily reports...</div>
            )}
            {!loading && filteredReports.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">No daily reports found for this outlet.</div>
            )}
            {!loading && filteredReports.map((report) => (
              <div key={report.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(report.date)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(report.created_at || report.updated_at)}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 uppercase">
                    {report.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">By</p>
                    <p className="text-gray-900 dark:text-white">{report.created_by || 'System'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Closing</p>
                    <p className="text-gray-900 dark:text-white">{formatCurrency(toAmount(report.closing_balance))}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Sales</p>
                    <p className="text-gray-900 dark:text-white">{formatCurrency(toAmount(report.total_sales))}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Expenses</p>
                    <p className="text-gray-900 dark:text-white">{formatCurrency(getReportExpenses(report))}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Net</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(getReportNet(report))}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="py-4 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Report Date</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Submitted</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">By</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Sales</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Expenses</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Net</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Closing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      Loading daily reports...
                    </td>
                  </tr>
                )}
                {!loading && filteredReports.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      No daily reports found for this outlet.
                    </td>
                  </tr>
                )}
                {!loading && filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(report.date)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {formatDateTime(report.created_at || report.updated_at)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {report.created_by || 'System'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300 uppercase">
                      {report.status}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                      {formatCurrency(toAmount(report.total_sales))}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-right text-gray-700 dark:text-gray-300">
                      {formatCurrency(getReportExpenses(report))}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(getReportNet(report))}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                      {formatCurrency(toAmount(report.closing_balance))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyReports;
