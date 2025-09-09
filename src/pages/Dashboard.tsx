import React, { useState, useEffect } from 'react';
import { DollarSign, FileText, CreditCard, TrendingUp, BarChart, ChevronDown, Building2, Filter } from 'lucide-react';
import DashboardCard from '@/components/dashboard/DashboardCard';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { vendorInvoiceService } from '@/lib/vendorInvoiceService';
import { VendorInvoice, DashboardView, Outlet } from '@/types';
import { formatCurrency } from '@/lib/utils';
import VendorInvoiceTable from '@/components/invoice/VendorInvoiceTable';

const Dashboard: React.FC = () => {
  const { 
    currentUser, 
    userOutlets, 
    canViewAllOutlets, 
    getAccessibleOutlets, 
    isBusinessOwner 
  } = useOutlet();

  // Multi-store dashboard state
  const [dashboardView, setDashboardView] = useState<DashboardView>({
    scope: canViewAllOutlets() ? 'all' : 'outlet_specific',
    selectedOutlets: [],
    dateRange: {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      endDate: new Date().toISOString()
    }
  });

  const [vendorInvoices, setVendorInvoices] = useState<VendorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOutletSelectorOpen, setIsOutletSelectorOpen] = useState(false);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isOutletSelectorOpen && !target.closest('[data-dropdown="outlet-selector"]')) {
        setIsOutletSelectorOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOutletSelectorOpen]);

  // Initialize selected outlets
  useEffect(() => {
    if (currentUser) {
      const accessibleOutlets = getAccessibleOutlets();
      setDashboardView(prev => ({
        ...prev,
        selectedOutlets: canViewAllOutlets() ? accessibleOutlets : [accessibleOutlets[0]].filter(Boolean)
      }));
    }
  }, [currentUser, canViewAllOutlets]);

  // Load vendor invoices data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const outletIds = dashboardView.selectedOutlets;
      if (outletIds.length === 0) return;

      const { data, error: invoiceError } = await vendorInvoiceService.getVendorInvoices(outletIds);
      
      if (invoiceError) {
        setError(invoiceError);
      } else if (data) {
        setVendorInvoices(data);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dashboardView.selectedOutlets.length > 0) {
      loadDashboardData();
    }
  }, [dashboardView.selectedOutlets]);

  // Calculate metrics from vendor invoices
  const calculateMetrics = () => {
    const paidInvoices = vendorInvoices.filter(inv => inv.status === 'paid');
    const pendingInvoices = vendorInvoices.filter(inv => inv.status === 'pending_approval');
    const approvedInvoices = vendorInvoices.filter(inv => inv.status === 'approved');

    const totalRevenue = 0; // This would come from sales data
    const totalExpenses = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const approvedAmount = approvedInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    return {
      totalRevenue,
      totalExpenses,
      pendingInvoicesCount: pendingInvoices.length,
      pendingAmount,
      approvedAmount,
      netProfit: totalRevenue - totalExpenses,
      cashBalance: 0 // This would come from daily reports
    };
  };

  const metrics = calculateMetrics();

  // Get selected outlets for display
  const selectedOutletNames = dashboardView.selectedOutlets
    .map(id => userOutlets.find(outlet => outlet.id === id)?.name)
    .filter(Boolean);

  // Recent vendor invoices
  const recentInvoices = [...vendorInvoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const handleOutletToggle = (outletId: string) => {
    setDashboardView(prev => {
      const isSelected = prev.selectedOutlets.includes(outletId);
      const newSelectedOutlets = isSelected
        ? prev.selectedOutlets.filter(id => id !== outletId)
        : [...prev.selectedOutlets, outletId];

      return {
        ...prev,
        selectedOutlets: newSelectedOutlets
      };
    });
  };

  const handleScopeChange = (scope: 'all' | 'outlet_specific') => {
    setDashboardView(prev => ({
      ...prev,
      scope,
      selectedOutlets: scope === 'all' ? getAccessibleOutlets() : [getAccessibleOutlets()[0]].filter(Boolean)
    }));
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header Section with Outlet Selector */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
              {isBusinessOwner ? 'Business overview across outlets' : 'Welcome back to Compass'}
            </p>
          </div>
          <div className="flex-shrink-0">
            <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white border-0">
              Generate Report
            </Button>
          </div>
        </div>

        {/* Outlet Selector - Only show for business owners */}
        {canViewAllOutlets() && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">View Data For:</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {dashboardView.scope === 'all' 
                      ? `All outlets (${selectedOutletNames.length})` 
                      : selectedOutletNames.join(', ')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Scope Toggle */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => handleScopeChange('all')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      dashboardView.scope === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    All Outlets
                  </button>
                  <button
                    onClick={() => handleScopeChange('outlet_specific')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      dashboardView.scope === 'outlet_specific'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Specific Outlets
                  </button>
                </div>

                {/* Outlet Selector Dropdown */}
                {dashboardView.scope === 'outlet_specific' && (
                  <div className="relative" data-dropdown="outlet-selector">
                    <Button
                      variant="outline"
                      onClick={() => setIsOutletSelectorOpen(!isOutletSelectorOpen)}
                      className="flex items-center gap-2"
                    >
                      <Filter size={16} />
                      Select Outlets
                      <ChevronDown size={14} className={`transition-transform ${isOutletSelectorOpen ? 'rotate-180' : ''}`} />
                    </Button>
                    
                    {isOutletSelectorOpen && (
                      <div className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 p-2">
                        {userOutlets.map((outlet) => (
                          <label key={outlet.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dashboardView.selectedOutlets.includes(outlet.id)}
                              onChange={() => handleOutletToggle(outlet.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-900 dark:text-white">{outlet.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                              {outlet.businessType}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <DashboardCard
          title="Revenue"
          value={formatCurrency(metrics.totalRevenue)}
          icon={<DollarSign size={20} />}
          change={{ value: 12.5, isPositive: true }}
          subtitle={dashboardView.scope === 'all' ? 'All outlets' : `${selectedOutletNames.length} outlet${selectedOutletNames.length !== 1 ? 's' : ''}`}
        />
        
        <DashboardCard
          title="Expenses (Paid)"
          value={formatCurrency(metrics.totalExpenses)}
          icon={<CreditCard size={20} />}
          change={{ value: 5.2, isPositive: false }}
          subtitle="Vendor invoices paid"
        />
        
        <DashboardCard
          title="Pending Approval"
          value={`${metrics.pendingInvoicesCount}`}
          icon={<FileText size={20} />}
          change={{ value: 2.1, isPositive: false }}
          subtitle={`${formatCurrency(metrics.pendingAmount)} waiting`}
        />
        
        <DashboardCard
          title="Approved (Unpaid)"
          value={formatCurrency(metrics.approvedAmount)}
          icon={<TrendingUp size={20} />}
          change={{ value: 8.3, isPositive: true }}
          subtitle="Ready for payment"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Vendor Invoices */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Recent Vendor Invoices
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Latest bills from suppliers across {dashboardView.scope === 'all' ? 'all outlets' : 'selected outlets'}
              </p>
            </div>
            <a 
              href="/invoices" 
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 h-9 px-3 rounded-md w-full sm:w-auto justify-center"
            >
              View All
            </a>
          </div>
          {recentInvoices.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
              <VendorInvoiceTable invoices={recentInvoices} />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-8 text-center">
              <FileText size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No vendor invoices yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Vendor invoices will appear here once they are created
              </p>
            </div>
          )}
        </div>
        
        {/* Outlet Breakdown */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {dashboardView.scope === 'all' ? 'Outlet Breakdown' : 'Selected Outlets'}
          </h3>
          
          <div className="space-y-3">
            {selectedOutletNames.length > 0 ? (
              userOutlets
                .filter(outlet => dashboardView.selectedOutlets.includes(outlet.id))
                .map((outlet) => {
                  const outletInvoices = vendorInvoices.filter(inv => inv.outletId === outlet.id);
                  const outletPending = outletInvoices.filter(inv => inv.status === 'pending_approval').length;
                  const outletExpenses = outletInvoices
                    .filter(inv => inv.status === 'paid')
                    .reduce((sum, inv) => sum + inv.amount, 0);
                  
                  return (
                    <div key={outlet.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">{outlet.name}</h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {outlet.businessType}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Expenses:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(outletExpenses)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Pending:</span>
                          <span className={`font-medium ${outletPending > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                            {outletPending}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-6 text-center">
                <Building2 size={32} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select outlets to view breakdown
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Multi-Outlet Analytics Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {dashboardView.scope === 'all' ? 'Multi-Outlet Analytics' : 'Outlet Performance'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Vendor invoice trends across selected outlets
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Revenue</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Expenses</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-block w-3 h-3 rounded-full bg-orange-500"></span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Pending</span>
            </div>
          </div>
        </div>
        <div className="h-72 flex items-center justify-center">
          <div className="text-center">
            <BarChart size={48} className="text-gray-300 dark:text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {dashboardView.scope === 'all' 
                ? 'Multi-outlet analytics chart will be displayed here'
                : 'Outlet comparison chart will be displayed here'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Showing data for {selectedOutletNames.length} outlet{selectedOutletNames.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;