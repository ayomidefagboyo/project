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
import { stripeService } from '@/lib/stripeService';
import { authService } from '@/lib/auth';
import TrialExpired from '@/components/TrialExpired';
import CompanyOnboarding from '@/components/onboarding/CompanyOnboarding';
import { trackUserJourney, trackTrialEvent, trackFeatureUsage, trackDashboardInteraction, trackDeviceInfo } from '@/lib/posthog';

const Dashboard: React.FC = () => {
  const {
    currentUser,
    userOutlets,
    canViewAllOutlets,
    getAccessibleOutlets,
    isBusinessOwner,
    refreshData,
    loadOutletData
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
  const [showCompanyOnboarding, setShowCompanyOnboarding] = useState(false);
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
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

  // Handle return from Stripe and complete onboarding
  useEffect(() => {
    const handleStripeReturn = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const trialStarted = urlParams.get('trial');
      const onboardingComplete = urlParams.get('onboarding');
      const paymentCancelled = urlParams.get('payment') === 'cancelled';

      // Handle cancelled payment
      if (trialStarted === 'cancelled' || paymentCancelled) {
        localStorage.removeItem('onboarding_data');
        window.history.replaceState({}, document.title, '/dashboard');
        setError('Trial setup was cancelled. You can try again anytime.');
        return;
      }

      if (trialStarted === 'started' && onboardingComplete === 'complete' && currentUser) {
        try {
          // Get stored onboarding data
          const storedData = localStorage.getItem('onboarding_data');
          if (!storedData) return;

          const onboardingData = JSON.parse(storedData);

          // Only create profile/outlet if needed (for OAuth users)
          if (onboardingData.needsProfileCreation) {
            setLoading(true);

            // Create outlet
            const outletData = {
              name: onboardingData.outletName,
              business_type: onboardingData.businessType,
              status: 'active',
              address: {
                street: '',
                city: '',
                state: '',
                zip: '',
                country: 'USA',
              },
              phone: '',
              email: onboardingData.userEmail,
              opening_hours: {
                monday: { open: '09:00', close: '17:00', closed: false },
                tuesday: { open: '09:00', close: '17:00', closed: false },
                wednesday: { open: '09:00', close: '17:00', closed: false },
                thursday: { open: '09:00', close: '17:00', closed: false },
                friday: { open: '09:00', close: '17:00', closed: false },
                saturday: { open: '09:00', close: '17:00', closed: false },
                sunday: { open: '09:00', close: '17:00', closed: true }
              },
              tax_rate: 8.25,
              currency: 'USD',
              timezone: 'America/New_York',
            };

            const { data: outlet, error: outletError } = await supabase
              .from('outlets')
              .insert(outletData)
              .select()
              .single();

            if (outletError) throw outletError;

            // Create business settings
            const { error: settingsError } = await supabase
              .from('business_settings')
              .insert({
                outlet_id: outlet.id,
                business_name: onboardingData.outletName,
                business_type: onboardingData.businessType,
                theme: 'light',
                language: 'en',
                date_format: 'MM/DD/YYYY',
                time_format: '12h',
                currency: 'USD',
                timezone: 'America/New_York'
              });

            if (settingsError) throw settingsError;

            // Create user profile
            const { error: profileError } = await authService.createUserProfile({
              name: onboardingData.userName,
              role: 'business_owner',
              outletId: outlet.id
            });

            if (profileError) throw new Error(profileError);

            // Clean up
            localStorage.removeItem('onboarding_data');

            // Refresh context to load new data
            await refreshData();
            await loadOutletData();

            setLoading(false);

            // Clean up URL
            window.history.replaceState({}, document.title, '/dashboard');
          } else {
            // Clean up for existing users
            localStorage.removeItem('onboarding_data');
            window.history.replaceState({}, document.title, '/dashboard');
          }
        } catch (error) {
          console.error('Error completing onboarding after Stripe:', error);
          setError('Failed to complete setup. Please contact support.');
          setLoading(false);
        }
      }
    };

    if (currentUser) {
      handleStripeReturn();
    }
  }, [currentUser, refreshData, loadOutletData]);

  // Initialize selected outlets
  useEffect(() => {
    if (currentUser) {
      // Check if user has outlets before proceeding
      if (!currentUser.outletId && userOutlets.length === 0) {
        // New user without outlets - show company onboarding immediately
        setShowCompanyOnboarding(true);
        setLoading(false);
        return;
      }

      // User has outlets - proceed with normal dashboard loading
      const accessibleOutlets = getAccessibleOutlets();
      const selectedOutlets = canViewAllOutlets() ? accessibleOutlets : [accessibleOutlets[0]].filter(Boolean);

      setDashboardView(prev => ({
        ...prev,
        selectedOutlets
      }));

      // Track dashboard access and device info (only for users with outlets)
      try {
        trackUserJourney('dashboard', {
          user_id: currentUser.id,
          accessible_outlets_count: accessibleOutlets.length,
          can_view_all: canViewAllOutlets(),
          is_business_owner: isBusinessOwner()
        });

        // Track device info for analytics
        trackDeviceInfo();

        // Track dashboard feature viewing
        trackFeatureUsage('dashboard_overview', 'viewed', {
          user_id: currentUser.id,
          outlet_count: accessibleOutlets.length
        });
      } catch (error) {
        console.warn('Analytics tracking failed:', error);
      }

      // Check subscription status
      if (currentUser) {
        checkSubscriptionStatus();
      }

      setLoading(false);
    }
  }, [currentUser, canViewAllOutlets]);

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

  // Check subscription status (Stripe-managed)
  const checkSubscriptionStatus = async () => {
    if (!currentUser?.id) return;

    try {
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('status, trial_end, plan_id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking subscription:', error);
        return;
      }

      if (!subscription) {
        // No subscription yet - show onboarding for business owners without outlets
        if (isBusinessOwner() && !currentUser.outletId) {
          setShowOnboarding(true);
        }
        return;
      }

      // Handle trial status
      if (subscription.status === 'trialing' && subscription.trial_end) {
        const trialEndDate = new Date(subscription.trial_end);
        const now = new Date();
        const diffTime = trialEndDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        setTrialDaysRemaining(diffDays);

        // Show trial expired modal if trial has ended
        if (diffDays <= 0) {
          setShowTrialExpired(true);
        }
      } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
        // Show trial expired for payment issues
        setShowTrialExpired(true);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };

  // Handle complete onboarding - redirect to Stripe FIRST
  const handleCompleteOnboarding = async () => {
    try {
      setLoading(true);

      // Store onboarding data in localStorage for after Stripe return
      const onboardingData = {
        outletName: outletName.trim() || `${currentUser?.name}'s Business`,
        businessType: businessType,
        needsProfileCreation: !currentUser?.outletId, // Flag for OAuth users
        userName: currentUser?.name || '',
        userEmail: currentUser?.email || ''
      };

      localStorage.setItem('onboarding_data', JSON.stringify(onboardingData));

      // Redirect to Stripe IMMEDIATELY for payment method collection
      const successUrl = `${window.location.origin}/dashboard?trial=started&onboarding=complete`;
      const cancelUrl = `${window.location.origin}/dashboard?trial=cancelled`;

      // Track trial start attempt
      trackTrialEvent('started', 'startup', 7);

      // Debug: Check API URL
      console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);

      // Create Stripe subscription with trial (default to startup plan)
      const response = await stripeService.createSubscriptionCheckout(
        'startup', // Default plan for trial
        successUrl,
        cancelUrl,
        7 // 7-day trial
      );

      // Redirect to Stripe checkout immediately
      await stripeService.redirectToCheckout((response as any).sessionId);
    } catch (error) {
      console.error('Error starting trial:', error);
      setError('Failed to start trial. Please try again.');
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
    .map(id => userOutlets?.find(outlet => outlet.id === id)?.name)
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Trial Expired Modal */}
      {showTrialExpired && (
        <TrialExpired
          currentPlan="business"
          daysRemaining={trialDaysRemaining}
          onUpgrade={() => {
            setShowTrialExpired(false);
            // Refresh page to reflect new subscription status
            window.location.reload();
          }}
        />
      )}

      {/* Company Onboarding Modal */}
      {showCompanyOnboarding && (
        <CompanyOnboarding
          onComplete={() => {
            setShowCompanyOnboarding(false);
            // Refresh outlet data after onboarding
            refreshData();
          }}
          onSkip={() => {
            setShowCompanyOnboarding(false);
            // For now, just hide the modal - could show a different message
          }}
        />
      )}

      {/* Onboarding Popup */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-lg w-full relative border border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setShowOnboarding(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="px-8 pt-8 pb-6 text-center border-b border-gray-50 dark:border-gray-800">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
                Welcome to Compazz
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2 font-light">
                Start your 7-day free trial
              </p>
            </div>

            {/* Features */}
            <div className="px-8 py-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">Receipt Scanning</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-light">AI-powered document processing</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">Financial Reports</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-light">Real-time insights and analytics</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">Team Collaboration</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-light">Multi-user access and permissions</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-50 dark:border-gray-800">
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center font-light">
                  No charges during trial • Cancel anytime
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-8 pb-8">
              <Button
                onClick={handleCompleteOnboarding}
                disabled={loading}
                className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 font-medium py-3 rounded-lg transition-colors"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mr-2"></div>
                    Starting Trial...
                  </div>
                ) : (
                  'Start Free Trial'
                )}
              </Button>
              <button
                onClick={() => setShowOnboarding(false)}
                className="mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors font-light"
              >
                Explore first
              </button>
            </div>
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