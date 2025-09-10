import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  PlusCircle, 
  Filter, 
  Search, 
  Download, 
  Eye,
  Building2,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Calendar,
  BarChart3,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { dailyReports } from '@/lib/mockData';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useOutlet } from '@/contexts/OutletContext';
import { eodService, useLoadingState, ErrorMessage } from '@/lib/services';

interface OutletEODSummary {
  outlet_id: string;
  outlet_name: string;
  today_sales: number;
  today_profit: number;
  week_sales: number;
  week_profit: number;
  month_sales: number;
  month_profit: number;
  pending_reports: number;
  last_report_date: string | null;
  cash_variance_today: number | null;
  status: 'good' | 'warning' | 'critical';
}

interface MultiOutletAnalytics {
  total_outlets: number;
  total_sales_today: number;
  total_profit_today: number;
  total_pending_reports: number;
  outlets_with_discrepancies: number;
  best_performing_outlet: {
    name: string;
    sales: number;
  };
  worst_performing_outlet: {
    name: string;
    sales: number;
  };
}

const DailyReports: React.FC = () => {
  const { currentUser, currentOutlet, userOutlets, hasPermission } = useOutlet();
  const { isLoading, setLoading, error, setError } = useLoadingState();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [outletSummaries, setOutletSummaries] = useState<OutletEODSummary[]>([]);
  const [analytics, setAnalytics] = useState<MultiOutletAnalytics | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'outlets' | 'reports'>('overview');
  const [actualReports, setActualReports] = useState<any[]>([]);

  // Check permissions
  const canViewMultiOutlet = hasPermission('view_all_outlets') || 
                            currentUser?.role === 'super_admin' ||
                            currentUser?.role === 'outlet_admin';

  useEffect(() => {
    if (canViewMultiOutlet && userOutlets.length > 0) {
      loadMultiOutletData();
    }
    // Also load individual reports for current outlet
    if (currentOutlet) {
      loadOutletReports();
    }
  }, [selectedDate, userOutlets, canViewMultiOutlet, currentOutlet]);

  const loadOutletReports = async () => {
    if (!currentOutlet) {
      console.log('No current outlet selected');
      return;
    }
    
    console.log('Loading reports for outlet:', currentOutlet.id);
    
    try {
      const { data: reports, error } = await eodService.getReports(currentOutlet.id);
      console.log('Reports loaded:', { reports, error });
      
      if (error) {
        console.error('Failed to load outlet reports:', error);
        setError(`Failed to load reports: ${error}`);
        setActualReports([]);
      } else {
        console.log(`Loaded ${reports?.length || 0} reports`);
        setActualReports(reports || []);
      }
    } catch (err) {
      console.error('Error loading outlet reports:', err);
      setError('Error loading reports');
      setActualReports([]);
    }
  };

  const loadMultiOutletData = async () => {
    if (!userOutlets.length) return;

    setLoading(true);
    setError(null);

    try {
      const summaries: OutletEODSummary[] = [];
      
      // Load data for each outlet
      for (const outlet of userOutlets) {
        try {
          // Get EOD summary for this outlet
          const summary = await eodService.getEODSummary(outlet.id);
          
          // Determine status based on various factors
          let status: 'good' | 'warning' | 'critical' = 'good';
          
          if (summary.pending_reports > 0) {
            status = 'warning';
          }
          
          if (summary.cash_variance_today && Math.abs(summary.cash_variance_today) > 100) {
            status = 'critical';
          }

          summaries.push({
            outlet_id: outlet.id,
            outlet_name: outlet.name,
            today_sales: summary.today_sales,
            today_profit: summary.today_profit,
            week_sales: summary.week_sales,
            week_profit: summary.week_profit,
            month_sales: summary.month_sales,
            month_profit: summary.month_profit,
            pending_reports: summary.pending_reports,
            last_report_date: summary.last_report_date,
            cash_variance_today: summary.cash_variance_today,
            status
          });
        } catch (err) {
          console.error(`Error loading data for outlet ${outlet.name}:`, err);
          // Add outlet with error status
          summaries.push({
            outlet_id: outlet.id,
            outlet_name: outlet.name,
            today_sales: 0,
            today_profit: 0,
            week_sales: 0,
            week_profit: 0,
            month_sales: 0,
            month_profit: 0,
            pending_reports: 0,
            last_report_date: null,
            cash_variance_today: null,
            status: 'critical'
          });
        }
      }

      setOutletSummaries(summaries);

      // Calculate multi-outlet analytics
      const totalSalesToday = summaries.reduce((sum, s) => sum + s.today_sales, 0);
      const totalProfitToday = summaries.reduce((sum, s) => sum + s.today_profit, 0);
      const totalPendingReports = summaries.reduce((sum, s) => sum + s.pending_reports, 0);
      const outletsWithDiscrepancies = summaries.filter(s => 
        s.cash_variance_today && Math.abs(s.cash_variance_today) > 10
      ).length;

      const bestPerforming = summaries.reduce((best, current) => 
        current.today_sales > best.today_sales ? current : best
      );

      const worstPerforming = summaries.reduce((worst, current) => 
        current.today_sales < worst.today_sales ? current : worst
      );

      setAnalytics({
        total_outlets: summaries.length,
        total_sales_today: totalSalesToday,
        total_profit_today: totalProfitToday,
        total_pending_reports: totalPendingReports,
        outlets_with_discrepancies: outletsWithDiscrepancies,
        best_performing_outlet: {
          name: bestPerforming.outlet_name,
          sales: bestPerforming.today_sales
        },
        worst_performing_outlet: {
          name: worstPerforming.outlet_name,
          sales: worstPerforming.today_sales
        }
      });

    } catch (err) {
      setError('Failed to load multi-outlet EOD data');
      console.error('Multi-outlet EOD error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning': return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const getStatusColor = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good': return 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800';
      case 'warning': return 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'critical': return 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800';
    }
  };
  
  const filteredReports = actualReports.filter(report => {
    return formatDate(report.date).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (report.created_by && report.created_by.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Daily Reports</h1>
          <p className="text-gray-500 dark:text-gray-400">Track your daily business performance across all outlets</p>
        </div>
        <div className="flex items-center gap-3">
          {canViewMultiOutlet && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          )}
        <Button asChild>
            <Link to="/eod" className="flex items-center">
            <PlusCircle size={16} className="mr-2" />
            New Report
          </Link>
        </Button>
        </div>
      </div>

      {error && <ErrorMessage error={error} onDismiss={() => setError(null)} />}

      {/* Multi-Outlet Overview - Only show if user has permission */}
      {canViewMultiOutlet && (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: 'Multi-Outlet Overview', icon: BarChart3 },
                { id: 'outlets', label: 'Outlet Details', icon: Building2 },
                { id: 'reports', label: 'Individual Reports', icon: FileText }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && analytics && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <Building2 className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Outlets</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {analytics.total_outlets}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <DollarSign className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sales Today</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatCurrency(analytics.total_sales_today)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Profit Today</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatCurrency(analytics.total_profit_today)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <AlertTriangle className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Reports</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {analytics.total_pending_reports}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Highlights */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Best Performing Outlet
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-bold text-green-600">
                        {analytics.best_performing_outlet.name}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {formatCurrency(analytics.best_performing_outlet.sales)} today
                      </p>
                    </div>
                    <CheckCircle className="h-12 w-12 text-green-600" />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Needs Attention
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Outlets with discrepancies:</span>
                      <span className="font-semibold text-red-600">
                        {analytics.outlets_with_discrepancies}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Pending reports:</span>
                      <span className="font-semibold text-orange-600">
                        {analytics.total_pending_reports}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Outlets Tab */}
          {activeTab === 'outlets' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {outletSummaries.map((outlet) => (
                <div
                  key={outlet.outlet_id}
                  className={`rounded-lg shadow-sm border p-6 ${getStatusColor(outlet.status)}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {outlet.outlet_name}
                      </h3>
                      <div className="flex items-center mt-1">
                        {getStatusIcon(outlet.status)}
                        <span className="ml-1 text-sm text-gray-600 dark:text-gray-400">
                          {outlet.status === 'good' ? 'All Good' : 
                           outlet.status === 'warning' ? 'Needs Attention' : 'Critical Issues'}
                        </span>
                      </div>
                    </div>
                    <Building2 className="h-6 w-6 text-gray-400" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Today's Sales:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(outlet.today_sales)}
                      </span>
      </div>

                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Today's Profit:</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(outlet.today_profit)}
                      </span>
                    </div>

                    {outlet.pending_reports > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Pending Reports:</span>
                        <span className="font-semibold text-orange-600">
                          {outlet.pending_reports}
                        </span>
                      </div>
                    )}

                    {outlet.cash_variance_today !== null && Math.abs(outlet.cash_variance_today) > 10 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Cash Variance:</span>
                        <span className={`font-semibold ${
                          Math.abs(outlet.cash_variance_today) > 50 ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {outlet.cash_variance_today >= 0 ? '+' : ''}{formatCurrency(outlet.cash_variance_today)}
                        </span>
                      </div>
                    )}

                    <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Week Sales:</span>
                        <span className="text-gray-900 dark:text-white">
                          {formatCurrency(outlet.week_sales)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-600 dark:text-gray-400">Month Sales:</span>
                        <span className="text-gray-900 dark:text-white">
                          {formatCurrency(outlet.month_sales)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Individual Reports Tab - Only show if user has permission for multi-outlet OR if they don't have permission */}
      {(!canViewMultiOutlet || activeTab === 'reports') && (
        <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search reports..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Download size={18} />
          </Button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-200 sm:pl-6">
                Date
              </th>
              <th scope="col" className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200 sm:table-cell">
                Created By
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                Sales
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                Expenses
              </th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-200">
                Closing Balance
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {filteredReports.map((report) => (
              <tr key={report.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                  {formatDate(report.date)}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 sm:table-cell">
                      {report.created_by || 'System'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(report.total_sales || 0)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(report.expenses || 0)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">
                      {formatCurrency((report.total_sales || 0) - (report.expenses || 0))}
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                  >
                    <Eye size={16} className="mr-1" />
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredReports.length === 0 && (
          <div className="text-center py-16 px-4">
            <p className="text-gray-500 dark:text-gray-400">No reports found</p>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Report Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Sales (Period)</p>
            <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(filteredReports.reduce((sum, report) => sum + (report.total_sales || 0), 0))}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Expenses (Period)</p>
            <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(filteredReports.reduce((sum, report) => sum + (report.expenses || 0), 0))}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">Net Profit (Period)</p>
            <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
              {formatCurrency(
                    filteredReports.reduce((sum, report) => sum + (report.total_sales || 0), 0) -
                    filteredReports.reduce((sum, report) => sum + (report.expenses || 0), 0)
              )}
            </p>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default DailyReports;