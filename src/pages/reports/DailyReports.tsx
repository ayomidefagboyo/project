import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
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
  FileText,
  Activity
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 rounded-xl flex items-center justify-center shadow-sm">
                <BarChart3 className="w-5 h-5 text-white dark:text-gray-900" />
              </div>
              <h1 className="text-3xl font-light text-gray-900 dark:text-white tracking-tight">Daily Reports</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-light">
              Track your daily business performance across all outlets with precision
            </p>
          </div>
          <div className="flex items-center gap-4">
            {canViewMultiOutlet && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
              />
            )}
            <Button 
              asChild 
              className="bg-gray-900 hover:bg-gray-800 text-white border-0 px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              <Link to="/dashboard/eod" className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>New Report</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="card border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <p className="text-red-800 dark:text-red-200 font-light">{error}</p>
            </div>
          </div>
        )}

        {/* Multi-Outlet Overview - Only show if user has permission */}
        {canViewMultiOutlet && (
          <>
            {/* Tabs */}
            <div className="card p-0">
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                {[
                  { id: 'overview', label: 'Multi-Outlet Overview', icon: BarChart3 },
                  { id: 'outlets', label: 'Outlet Details', icon: Building2 },
                  { id: 'reports', label: 'Individual Reports', icon: FileText }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center px-6 py-4 font-medium text-sm transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'border-b-2 border-gray-900 dark:border-white text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/30'
                    }`}
                  >
                    <tab.icon className="w-4 h-4 mr-2" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && analytics && (
              <div className="space-y-8">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="card p-6 hover:shadow-lg transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Outlets</p>
                        <p className="text-3xl font-light text-foreground tracking-tight">
                          {analytics.total_outlets}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </div>

                  <div className="card p-6 hover:shadow-lg transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Sales Today</p>
                        <p className="text-3xl font-light text-foreground tracking-tight">
                          {formatCurrency(analytics.total_sales_today)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </div>
                  </div>

                  <div className="card p-6 hover:shadow-lg transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Profit Today</p>
                        <p className="text-3xl font-light text-foreground tracking-tight">
                          {formatCurrency(analytics.total_profit_today)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>
                  </div>

                  <div className="card p-6 hover:shadow-lg transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Pending Reports</p>
                        <p className="text-3xl font-light text-foreground tracking-tight">
                          {analytics.total_pending_reports}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                      </div>
                    </div>
                  </div>
              </div>

                {/* Performance Highlights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="card p-6 hover:shadow-lg transition-all duration-200">
                    <h3 className="text-lg font-medium text-foreground mb-6 tracking-tight">
                      Best Performing Outlet
                    </h3>
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <p className="text-xl font-light text-emerald-600 dark:text-emerald-400 tracking-tight">
                          {analytics.best_performing_outlet.name}
                        </p>
                        <p className="text-muted-foreground font-light">
                          {formatCurrency(analytics.best_performing_outlet.sales)} today
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </div>
                  </div>

                  <div className="card p-6 hover:shadow-lg transition-all duration-200">
                    <h3 className="text-lg font-medium text-foreground mb-6 tracking-tight">
                      Needs Attention
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-light">Outlets with discrepancies:</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="font-medium text-red-600 dark:text-red-400">
                            {analytics.outlets_with_discrepancies}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-light">Pending reports:</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {analytics.total_pending_reports}
                          </span>
                        </div>
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
        <div className="card p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search reports by date or creator..."
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 px-4 py-3 rounded-xl"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Reports Table */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th scope="col" className="py-4 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="hidden px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:table-cell">
                    Created By
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Sales
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Expenses
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Closing Balance
                  </th>
                  <th scope="col" className="relative py-4 pl-3 pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(report.date)}
                    </td>
                    <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400 sm:table-cell">
                      {report.created_by || 'System'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(report.total_sales || 0)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(report.expenses || 0)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-right text-gray-900 dark:text-white">
                      {formatCurrency((report.total_sales || 0) - (report.expenses || 0))}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredReports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-16 px-4">
                      <div className="flex flex-col items-center space-y-3">
                        <FileText className="w-12 h-12 text-gray-400" />
                        <p className="text-gray-500 dark:text-gray-400 font-light">No reports found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="card p-6">
          <h2 className="text-lg font-medium mb-6 text-foreground tracking-tight">Report Summary</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Sales (Period)</p>
                <p className="text-2xl font-light text-foreground tracking-tight">
                  {formatCurrency(filteredReports.reduce((sum, report) => sum + (report.total_sales || 0), 0))}
                </p>
              </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Expenses (Period)</p>
                <p className="text-2xl font-light text-foreground tracking-tight">
                  {formatCurrency(filteredReports.reduce((sum, report) => sum + (report.expenses || 0), 0))}
                </p>
              </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Net Profit (Period)</p>
                <p className="text-2xl font-light text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {formatCurrency(
                    filteredReports.reduce((sum, report) => sum + (report.total_sales || 0), 0) -
                    filteredReports.reduce((sum, report) => sum + (report.expenses || 0), 0)
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
        </>
      )}
      </div>
    </div>
  );
};

export default DailyReports;