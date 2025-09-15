import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  FileText, 
  CreditCard, 
  TrendingUp, 
  BarChart3, 
  ChevronDown, 
  Building2, 
  Filter,
  Calendar,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import DashboardCard from '@/components/dashboard/DashboardCard';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { vendorInvoiceService } from '@/lib/vendorInvoiceService';
import { VendorInvoice, DashboardView, Outlet } from '@/types';
import { formatCurrency } from '@/lib/utils';
import VendorInvoiceTable from '@/components/invoice/VendorInvoiceTable';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { supabase } from '@/lib/supabase';

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
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    }
  });

  const [vendorInvoices, setVendorInvoices] = useState<VendorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOutletSelectorOpen, setIsOutletSelectorOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [outletName, setOutletName] = useState('');
  const [businessType, setBusinessType] = useState<'supermarket' | 'restaurant' | 'lounge' | 'retail' | 'cafe'>('retail');
  
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
      const selectedOutlets = canViewAllOutlets() ? accessibleOutlets : [accessibleOutlets[0]].filter(Boolean);

      setDashboardView(prev => ({
        ...prev,
        selectedOutlets
      }));

      // Show onboarding for new users with no data
      if (selectedOutlets.length === 0 && isBusinessOwner() && vendorInvoices.length === 0) {
        setShowOnboarding(true);
      }
      setLoading(false);
    }
  }, [currentUser, canViewAllOutlets, vendorInvoices.length]);

  // Load vendor invoices data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const outletIds = dashboardView.selectedOutlets;
      if (outletIds.length === 0) {
        setLoading(false);
        return;
      }

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

  // Handle outlet setup
  const handleOutletSetup = async () => {
    if (!outletName.trim()) return;

    try {
      setLoading(true);

      // If user already has an outlet, update it; otherwise create new one
      if (currentUser?.outletId) {
        // Update existing outlet
        const { error: updateError } = await supabase
          .from('outlets')
          .update({
            name: outletName,
            business_type: businessType,
          })
          .eq('id', currentUser.outletId);

        if (updateError) throw updateError;
      } else {
        // This shouldn't happen with our new OAuth flow, but keeping as fallback
        console.warn('User has no outlet - this should not happen with new OAuth flow');
      }

      setOnboardingStep(2);
    } catch (error) {
      console.error('Error setting up outlet:', error);
      setError('Failed to setup outlet');
    } finally {
      setLoading(false);
    }
  };

  // Handle trial activation
  const handleTrialActivation = async () => {
    try {
      setLoading(true);

      // Start free trial - this would integrate with your subscription system
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 7); // 7-day trial

      // Update user's trial status (you may need to add this to your schema)
      const { error: trialError } = await supabase
        .from('users')
        .update({
          trial_started_at: new Date().toISOString(),
          trial_ends_at: trialEndDate.toISOString(),
        })
        .eq('id', currentUser?.id);

      if (trialError) throw trialError;

      setShowOnboarding(false);
      setOnboardingStep(1);

      // Refresh the page or reload data
      window.location.reload();
    } catch (error) {
      console.error('Error activating trial:', error);
      setError('Failed to activate trial');
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = () => {
    const totalExpenses = vendorInvoices.reduce((sum, invoice) => 
      sum + (invoice.totalAmount || 0), 0
    );
    const pendingInvoices = vendorInvoices.filter(invoice => 
      invoice.approvalStatus === 'pending'
    ).length;
    const approvedInvoices = vendorInvoices.filter(invoice => 
      invoice.approvalStatus === 'approved'
    ).length;
    
    return {
      totalExpenses,
      pendingInvoices,
      approvedInvoices,
      totalInvoices: vendorInvoices.length
    };
  };

  const metrics = calculateMetrics();

  // Export report functionality
  const handleExportReport = () => {
    try {
      const reportData = {
        generatedAt: new Date().toISOString(),
        outlets: selectedOutletNames,
        dateRange: {
          startDate: dashboardView.dateRange.startDate,
          endDate: dashboardView.dateRange.endDate
        },
        metrics: {
          totalSales: 45250.00, // This would come from real data
          totalExpenses: metrics.totalExpenses,
          pendingInvoices: metrics.pendingInvoices,
          approvedInvoices: metrics.approvedInvoices,
          totalInvoices: metrics.totalInvoices
        },
        invoices: vendorInvoices.map(invoice => ({
          id: invoice.id,
          vendor: invoice.vendorName,
          amount: invoice.totalAmount,
          status: invoice.approvalStatus,
          date: invoice.createdAt,
          outlet: userOutlets.find(o => o.id === invoice.outletId)?.name
        }))
      };

      // Create and download CSV
      const csvContent = generateCSVReport(reportData);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `dashboard-report-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Failed to export report. Please try again.');
    }
  };

  // Generate CSV content
  const generateCSVReport = (data: any) => {
    const headers = ['Metric', 'Value', 'Outlet'];
    const rows = [
      ['Total Sales', `$${data.metrics.totalSales.toLocaleString()}`, data.outlets.join('; ')],
      ['Total Expenses', `$${data.metrics.totalExpenses.toLocaleString()}`, data.outlets.join('; ')],
      ['Pending Invoices', data.metrics.pendingInvoices.toString(), data.outlets.join('; ')],
      ['Approved Invoices', data.metrics.approvedInvoices.toString(), data.outlets.join('; ')],
      ['Total Invoices', data.metrics.totalInvoices.toString(), data.outlets.join('; ')],
      [''], // Empty row
      ['Invoice Details', '', ''],
      ['Invoice ID', 'Vendor', 'Amount', 'Status', 'Date', 'Outlet']
    ];

    // Add invoice details
    data.invoices.forEach((invoice: any) => {
      rows.push([
        invoice.id,
        invoice.vendor || 'N/A',
        `$${(invoice.amount || 0).toLocaleString()}`,
        invoice.status || 'Unknown',
        new Date(invoice.date).toLocaleDateString(),
        invoice.outlet || 'N/A'
      ]);
    });

    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-12 h-12 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Loading Dashboard</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Preparing your financial overview</p>
          </div>
        </div>
      </div>
    );
  }

  const selectedOutletNames = dashboardView.selectedOutlets
    .map(id => userOutlets.find(outlet => outlet.id === id)?.name)
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Onboarding Popup */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 max-w-2xl w-full p-8 relative">
            <button
              onClick={() => setShowOnboarding(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {onboardingStep === 1 ? (
              // Step 1: Business Setup
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Welcome to Compazz!
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Let's set up your business to get started
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={outletName}
                      onChange={(e) => setOutletName(e.target.value)}
                      placeholder="Enter your business name"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Business Type
                    </label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value as typeof businessType)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="retail">Retail Store</option>
                      <option value="restaurant">Restaurant</option>
                      <option value="cafe">Cafe</option>
                      <option value="supermarket">Supermarket</option>
                      <option value="lounge">Lounge/Bar</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                  <Button
                    onClick={handleOutletSetup}
                    disabled={!outletName.trim() || loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 disabled:opacity-50"
                  >
                    {loading ? 'Setting up...' : 'Continue'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowOnboarding(false)}
                    className="px-8 py-3"
                  >
                    Skip for now
                  </Button>
                </div>
              </div>
            ) : (
              // Step 2: Trial Activation
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Business Setup Complete!
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Start your free 7-day trial to access all features
                  </p>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-blue-900/20 dark:to-emerald-900/20 p-6 rounded-xl">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Your 7-Day Free Trial Includes:
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Smart Receipt Scanning</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Invoice Management</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Financial Reports</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Team Collaboration</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={handleTrialActivation}
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white px-8 py-3"
                  >
                    {loading ? 'Starting Trial...' : 'Start Free Trial'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowOnboarding(false)}
                    className="px-8 py-3"
                  >
                    Maybe Later
                  </Button>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No credit card required • Cancel anytime • Full access to all features
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Header with Export and Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Overview of your business performance
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline" 
                className="flex items-center space-x-2"
                onClick={() => setIsOutletSelectorOpen(!isOutletSelectorOpen)}
              >
                <Filter className="w-4 h-4" />
                <span>Filter</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
              <FeatureGate
                userId={currentUser?.id || ''}
                feature="advancedAnalytics"
                fallback={
                  <Button
                    className="flex items-center space-x-2 bg-gray-400 cursor-not-allowed"
                    disabled
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Export Report (Pro)</span>
                  </Button>
                }
              >
                <Button
                  className="flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                  onClick={() => handleExportReport()}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Export Report</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </FeatureGate>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Outlet Selector */}
        {canViewAllOutlets() && (
          <div className="mb-12">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Multi-Location View</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Viewing data for {selectedOutletNames.length} location{selectedOutletNames.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                
                <div className="relative lg:ml-auto" data-dropdown="outlet-selector">
                  <button
                    onClick={() => setIsOutletSelectorOpen(!isOutletSelectorOpen)}
                    className="flex items-center space-x-3 px-6 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {selectedOutletNames.length > 0 
                        ? selectedOutletNames.join(', ')
                        : 'Select locations'
                      }
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOutletSelectorOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isOutletSelectorOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-10">
                      <div className="p-4 space-y-2">
                        {userOutlets.map(outlet => (
                          <label key={outlet.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dashboardView.selectedOutlets.includes(outlet.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setDashboardView(prev => ({
                                    ...prev,
                                    selectedOutlets: [...prev.selectedOutlets, outlet.id]
                                  }));
                                } else {
                                  setDashboardView(prev => ({
                                    ...prev,
                                    selectedOutlets: prev.selectedOutlets.filter(id => id !== outlet.id)
                                  }));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {outlet.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                {outlet.businessType}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <DashboardCard
            title="Total Sales"
            value="$45,250.00"
            icon={<TrendingUp className="w-5 h-5" />}
            subtitle="This month"
            change={{ value: 15.2, isPositive: true }}
          />
          <DashboardCard
            title="Total Expenses"
            value={formatCurrency(metrics.totalExpenses)}
            icon={<DollarSign className="w-5 h-5" />}
            subtitle="This month"
            change={{ value: 12.5, isPositive: false }}
          />
          <DashboardCard
            title="Pending Approvals"
            value={metrics.pendingInvoices.toString()}
            icon={<Clock className="w-5 h-5" />}
            subtitle={metrics.pendingInvoices === 1 ? "Invoice awaiting" : "Invoices awaiting"}
            change={{ value: 8.1, isPositive: false }}
          />
          <DashboardCard
            title="Approved Invoices"
            value={metrics.approvedInvoices.toString()}
            icon={<CheckCircle className="w-5 h-5" />}
            subtitle="Ready for payment"
            change={{ value: 23.4, isPositive: true }}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Vendor Invoices */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
              <div className="p-8 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Invoices</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Latest vendor invoices requiring attention
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="flex items-center space-x-2">
                    <Filter className="w-4 h-4" />
                    <span>Filter</span>
                  </Button>
                </div>
              </div>
              
              <div className="p-8">
                {vendorInvoices.length > 0 ? (
                  <VendorInvoiceTable
                    invoices={vendorInvoices.slice(0, 5)}
                    onApprove={(invoice) => {
                      console.log('Approve invoice:', invoice);
                    }}
                    onReject={(invoice) => {
                      console.log('Reject invoice:', invoice);
                    }}
                    showActions={true}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No invoices yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                      When you receive vendor invoices, they'll appear here for review and approval.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Live updates</p>
                </div>
              </div>
              
              <RecentActivity />
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Quick Actions</h2>
              <div className="space-y-3">
                <button className="w-full flex items-center space-x-3 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Create Invoice</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Generate new invoice</p>
                  </div>
                </button>
                
                <button className="w-full flex items-center space-x-3 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Add Expense</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Record new expense</p>
                  </div>
                </button>
                
                <button className="w-full flex items-center space-x-3 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors">
                  <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">EOD Report</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">End of day summary</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Per-Outlet Breakdown */}
        {canViewAllOutlets() && dashboardView.selectedOutlets.length > 1 && (
          <div className="mt-12">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-8">Outlet Performance</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashboardView.selectedOutlets.length > 0 ? (
                  dashboardView.selectedOutlets.map(outletId => {
                    const outlet = userOutlets.find(o => o.id === outletId);
                    if (!outlet) return null;

                    const outletInvoices = vendorInvoices.filter(inv => inv.outletId === outletId);
                    const outletExpenses = outletInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
                    const outletPending = outletInvoices.filter(inv => inv.approvalStatus === 'pending').length;

                    return (
                      <div key={outlet.id} className="p-6 border border-gray-100 dark:border-gray-700 rounded-xl hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">{outlet.name}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-1">
                              {outlet.businessType}
                            </p>
                          </div>
                          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Monthly Expenses</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(outletExpenses)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Pending Items</span>
                            <span className={`font-semibold ${
                              outletPending > 0 
                                ? 'text-orange-600 dark:text-orange-400' 
                                : 'text-gray-900 dark:text-white'
                            }`}>
                              {outletPending}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full text-center py-12">
                    <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Select outlets above to view performance breakdown
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;