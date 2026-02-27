import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
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
  ArrowRight
} from 'lucide-react';
import DashboardCard from '@/components/dashboard/DashboardCard';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { eodService } from '@/lib/eodServiceNew';
import { currencyService } from '@/lib/currencyService';
import { apiClient } from '@/lib/apiClient';
import { AuditEntry, DashboardView } from '@/types';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { supabase } from '@/lib/supabase';
import { stripeService } from '@/lib/stripeService';
import { authService } from '@/lib/auth';
import TrialExpired from '@/components/TrialExpired';
import CompanyOnboarding from '@/components/onboarding/CompanyOnboarding';
import { trackUserJourney, trackTrialEvent, trackFeatureUsage, trackDeviceInfo } from '@/lib/posthog';

interface DashboardInvoiceItem {
  id: string;
}

interface DashboardInvoice {
  id: string;
  outlet_id: string;
  invoice_number: string;
  vendor_id?: string | null;
  customer_id?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  status?: string | null;
  total?: number | null;
  created_at?: string | null;
  invoice_items?: DashboardInvoiceItem[];
}

interface DashboardInvoicesResponse {
  items: DashboardInvoice[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

interface DashboardAuditEntryResponse {
  items: Array<{
    id: string;
    outlet_id: string;
    user_id: string;
    user_name: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details: string;
    timestamp: string;
  }>;
  total: number;
  page: number;
  size: number;
  pages: number;
}

interface MetricChange {
  value: number;
  isPositive: boolean;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    currentOutlet,
    userOutlets,
    canViewAllOutlets,
    getAccessibleOutlets,
    isBusinessOwner,
    refreshData,
    loadOutletData
  } = useOutlet();

  // Multi-store dashboard state
  const [dashboardView, setDashboardView] = useState<DashboardView>({
    scope: 'outlet_specific',
    selectedOutlets: [],
    dateRange: {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    }
  });

  const [dashboardInvoices, setDashboardInvoices] = useState<DashboardInvoice[]>([]);
  const [recentActivities, setRecentActivities] = useState<AuditEntry[]>([]);
  const [eodStats, setEodStats] = useState<any>(null);
  const [invoiceStatsSummary, setInvoiceStatsSummary] = useState({
    total: 0,
    unpaidCount: 0,
    unpaidAmount: 0,
    paidCount: 0,
  });
  const [salesChange, setSalesChange] = useState<MetricChange | undefined>(undefined);
  const [expenseChange, setExpenseChange] = useState<MetricChange | undefined>(undefined);
  const [profitChange, setProfitChange] = useState<MetricChange | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState('this_month');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [isOutletSelectorOpen, setIsOutletSelectorOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCompanyOnboarding, setShowCompanyOnboarding] = useState(false);
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [outletName, setOutletName] = useState('');
  const [businessType, setBusinessType] = useState<'supermarket' | 'restaurant' | 'lounge' | 'retail' | 'cafe'>('retail');
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isOutletSelectorOpen && !target.closest('[data-dropdown="outlet-selector"]')) {
        setIsOutletSelectorOpen(false);
      }
      if (showCustomDatePicker && !target.closest('[data-dropdown="date-picker"]')) {
        setShowCustomDatePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOutletSelectorOpen, showCustomDatePicker]);

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
      const defaultOutletId =
        currentOutlet?.id && accessibleOutlets.includes(currentOutlet.id)
          ? currentOutlet.id
          : accessibleOutlets[0] || null;

      setDashboardView(prev => {
        const hasValidSelection =
          prev.selectedOutlets.length > 0 &&
          prev.selectedOutlets.every((outletId) => accessibleOutlets.includes(outletId));

        if (hasValidSelection) {
          return prev;
        }

        return {
          ...prev,
          scope: 'outlet_specific',
          selectedOutlets: defaultOutletId ? [defaultOutletId] : []
        };
      });

      // Track dashboard access and device info (only for users with outlets)
      try {
        trackUserJourney('dashboard', {
          user_id: currentUser.id,
          accessible_outlets_count: accessibleOutlets.length,
          can_view_all: canViewAllOutlets(),
          is_business_owner: isBusinessOwner
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
  }, [currentUser, currentOutlet?.id, userOutlets.length, canViewAllOutlets]);

  // Date range calculation helper
  const getDateRange = (range: string) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    switch (range) {
      case 'today':
        return { from: today, to: today, label: 'Today' };

      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        return { from: yesterdayStr, to: yesterdayStr, label: 'Yesterday' };

      case 'last_7_days':
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return { from: sevenDaysAgo.toISOString().split('T')[0], to: today, label: 'Last 7 days' };

      case 'last_30_days':
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return { from: thirtyDaysAgo.toISOString().split('T')[0], to: today, label: 'Last 30 days' };

      case 'this_month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: monthStart.toISOString().split('T')[0], to: today, label: 'This month' };

      case 'last_month':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          from: lastMonthStart.toISOString().split('T')[0],
          to: lastMonthEnd.toISOString().split('T')[0],
          label: 'Last month'
        };

      case 'this_quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        return { from: quarterStart.toISOString().split('T')[0], to: today, label: 'This quarter' };

      case 'custom':
        return {
          from: customDateFrom || today,
          to: customDateTo || today,
          label: 'Custom range'
        };

      default:
        const defaultMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: defaultMonthStart.toISOString().split('T')[0], to: today, label: 'This month' };
    }
  };

  const currentDateRange = getDateRange(selectedDateRange);

  const getPreviousDateRange = (from: string, to: string) => {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return { from, to };
    }

    const daySpan = Math.max(
      0,
      Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const prevTo = new Date(fromDate);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - daySpan);

    return {
      from: prevFrom.toISOString().slice(0, 10),
      to: prevTo.toISOString().slice(0, 10),
    };
  };

  const normalizeMoney = (value: unknown): number => {
    const amount = Number(value || 0);
    return Number.isFinite(amount) ? amount : 0;
  };

  const buildPercentChange = (
    current: number,
    previous: number,
    lowerIsBetter: boolean = false
  ): MetricChange | undefined => {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return undefined;
    if (current === 0 && previous === 0) return { value: 0, isPositive: true };
    if (previous === 0) return { value: 100, isPositive: !lowerIsBetter };

    const raw = ((current - previous) / Math.abs(previous)) * 100;
    const rounded = Math.round(Math.abs(raw) * 10) / 10;

    return {
      value: rounded,
      isPositive: lowerIsBetter ? raw <= 0 : raw >= 0,
    };
  };

  const aggregateEodStats = (statsList: any[]) => {
    const reportsByStatus: Record<string, number> = {};
    const salesByPaymentMethod: Record<string, number> = {};
    const monthlyByMonth = new Map<string, { month: string; sales: number; expenses: number; profit: number }>();

    let totalReports = 0;
    let totalSales = 0;
    let totalExpenses = 0;
    let netProfit = 0;
    let cashVariance = 0;

    for (const stats of statsList) {
      totalReports += Number(stats?.total_reports || 0);
      totalSales += Number(stats?.total_sales || 0);
      totalExpenses += Number(stats?.total_expenses || 0);
      netProfit += Number(stats?.net_profit || 0);
      cashVariance += Number(stats?.cash_variance || 0);

      Object.entries(stats?.reports_by_status || {}).forEach(([status, count]) => {
        reportsByStatus[status] = (reportsByStatus[status] || 0) + Number(count || 0);
      });

      Object.entries(stats?.sales_by_payment_method || {}).forEach(([method, amount]) => {
        salesByPaymentMethod[method] = (salesByPaymentMethod[method] || 0) + Number(amount || 0);
      });

      for (const trend of stats?.monthly_trends || []) {
        const key = String(trend?.month || '');
        if (!key) continue;
        const existing = monthlyByMonth.get(key) || { month: key, sales: 0, expenses: 0, profit: 0 };
        existing.sales += Number(trend?.sales || 0);
        existing.expenses += Number(trend?.expenses || 0);
        existing.profit += Number(trend?.profit || 0);
        monthlyByMonth.set(key, existing);
      }
    }

    const monthly_trends = Array.from(monthlyByMonth.values()).sort((a, b) => a.month.localeCompare(b.month));

    return {
      total_reports: totalReports,
      total_sales: totalSales,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      average_daily_sales: totalReports > 0 ? totalSales / totalReports : 0,
      cash_variance: cashVariance,
      reports_by_status: reportsByStatus,
      sales_by_payment_method: salesByPaymentMethod,
      monthly_trends,
    };
  };

  // Helper function to get date range label for button display
  const getDateRangeLabel = (range: string, customFrom: string, customTo: string): string => {
    switch (range) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'last_7_days':
        return 'Last 7 days';
      case 'last_30_days':
        return 'Last 30 days';
      case 'this_month':
        return 'This month';
      case 'last_month':
        return 'Last month';
      case 'this_quarter':
        return 'This quarter';
      case 'custom':
        if (customFrom && customTo) {
          return `${customFrom} to ${customTo}`;
        }
        return 'Custom range';
      default:
        return 'Select date range';
    }
  };

  // Handle date range selection without triggering loading
  const handleDateRangeSelect = (range: string) => {
    setSelectedDateRange(range);
    if (range !== 'custom') {
      setShowCustomDatePicker(false);
    }
    // Don't close dropdown for custom to allow date input
  };

  const updateInvoiceSummaryFromList = (invoices: DashboardInvoice[]) => {
    const summary = invoices.reduce(
      (acc, invoice) => {
        const totalAmount = normalizeMoney(invoice.total);
        const status = String(invoice.status || '').toLowerCase();

        acc.total += 1;
        if (status === 'paid') {
          acc.paidCount += 1;
        } else {
          acc.unpaidCount += 1;
          acc.unpaidAmount += totalAmount;
        }
        return acc;
      },
      { total: 0, unpaidCount: 0, unpaidAmount: 0, paidCount: 0 }
    );

    setInvoiceStatsSummary(summary);
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const outletIds = dashboardView.selectedOutlets;
      if (outletIds.length === 0) {
        setDashboardInvoices([]);
        setRecentActivities([]);
        setEodStats(null);
        setSalesChange(undefined);
        setExpenseChange(undefined);
        setProfitChange(undefined);
        setInvoiceStatsSummary({ total: 0, unpaidCount: 0, unpaidAmount: 0, paidCount: 0 });
        setLoading(false);
        return;
      }

      // Load real vendor invoices from backend invoices endpoint.
      try {
        const invoiceResponses = await Promise.all(
          outletIds.map((outletId) =>
            apiClient.get<DashboardInvoicesResponse>('/invoices/', {
              outlet_id: outletId,
              invoice_type: 'vendor',
              page: 1,
              size: 200,
              date_from: currentDateRange.from,
              date_to: currentDateRange.to,
            })
          )
        );

        const loadedInvoices = invoiceResponses
          .filter((response) => !response.error && response.data)
          .flatMap((response) => response.data?.items || []);

        const sortedInvoices = [...loadedInvoices].sort((left, right) => {
          const leftTs = new Date(String(left.created_at || left.issue_date || '')).getTime();
          const rightTs = new Date(String(right.created_at || right.issue_date || '')).getTime();
          return rightTs - leftTs;
        });

        setDashboardInvoices(sortedInvoices);
        updateInvoiceSummaryFromList(sortedInvoices);
      } catch (invoiceError) {
        console.warn('Failed to load dashboard invoices:', invoiceError);
        setDashboardInvoices([]);
        setInvoiceStatsSummary({ total: 0, unpaidCount: 0, unpaidAmount: 0, paidCount: 0 });
      }

      // Load audit entries for live activity feed.
      try {
        const activityResponses = await Promise.all(
          outletIds.map((outletId) =>
            apiClient.get<DashboardAuditEntryResponse>('/audit/', {
              outlet_id: outletId,
              page: 1,
              size: 30,
              date_from: currentDateRange.from,
              date_to: currentDateRange.to,
            })
          )
        );

        const mappedActivities: AuditEntry[] = activityResponses
          .filter((response) => !response.error && response.data)
          .flatMap((response) => response.data?.items || [])
          .map((entry) => ({
            id: String(entry.id || ''),
            outletId: String(entry.outlet_id || ''),
            userId: String(entry.user_id || ''),
            userName: String(entry.user_name || 'Unknown'),
            action: String(entry.action || ''),
            entityType: (String(entry.entity_type || 'report') as AuditEntry['entityType']),
            entityId: String(entry.entity_id || ''),
            details: String(entry.details || ''),
            timestamp: String(entry.timestamp || ''),
          }))
          .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
          .slice(0, 8);

        setRecentActivities(mappedActivities);
      } catch (activityError) {
        console.warn('Failed to load dashboard activity feed:', activityError);
        setRecentActivities([]);
      }

      // Load EOD statistics for current and previous period.
      try {
        const previousRange = getPreviousDateRange(currentDateRange.from, currentDateRange.to);

        const [currentStatsResponses, previousStatsResponses] = await Promise.all([
          Promise.all(
            outletIds.map((outletId) =>
              eodService.getEODStats(currentDateRange.from, currentDateRange.to, outletId)
            )
          ),
          Promise.all(
            outletIds.map((outletId) =>
              eodService.getEODStats(previousRange.from, previousRange.to, outletId)
            )
          ),
        ]);

        const aggregateStatsResponse = (responses: Array<{ data: any | null; error: string | null }>) => {
          const validStats = responses
            .filter((response) => !response.error && response.data)
            .map((response) => response.data as NonNullable<typeof response.data>);
          if (!validStats.length) return null;
          if (validStats.length === 1) return validStats[0];
          return aggregateEodStats(validStats);
        };

        const currentStats = aggregateStatsResponse(currentStatsResponses);
        const previousStats = aggregateStatsResponse(previousStatsResponses);

        setEodStats(currentStats);
        const currentSales = normalizeMoney(currentStats?.total_sales);
        const previousSales = normalizeMoney(previousStats?.total_sales);
        const currentExpenses = normalizeMoney(currentStats?.total_expenses);
        const previousExpenses = normalizeMoney(previousStats?.total_expenses);
        const currentProfit = normalizeMoney(currentStats?.net_profit);
        const previousProfit = normalizeMoney(previousStats?.net_profit);

        setSalesChange(buildPercentChange(currentSales, previousSales, false));
        setExpenseChange(buildPercentChange(currentExpenses, previousExpenses, true));
        setProfitChange(buildPercentChange(currentProfit, previousProfit, false));
      } catch (eodError) {
        console.warn('Error loading EOD stats:', eodError);
        setEodStats(null);
        setSalesChange(undefined);
        setExpenseChange(undefined);
        setProfitChange(undefined);
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
  }, [dashboardView.selectedOutlets, selectedDateRange, customDateFrom, customDateTo]);

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
        if (isBusinessOwner && !currentUser.outletId) {
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
    const totalExpenses = dashboardInvoices.reduce(
      (sum, invoice) => sum + normalizeMoney(invoice.total),
      0
    );
    const pendingInvoices = dashboardInvoices.filter((invoice) => {
      const status = String(invoice.status || '').toLowerCase();
      return status !== 'paid';
    }).length;
    const approvedInvoices = dashboardInvoices.filter((invoice) => {
      const status = String(invoice.status || '').toLowerCase();
      return status === 'paid';
    }).length;
    
    return {
      totalExpenses,
      pendingInvoices,
      approvedInvoices,
      totalInvoices: dashboardInvoices.length
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
          startDate: currentDateRange.from,
          endDate: currentDateRange.to
        },
        metrics: {
          totalSales: eodStats?.total_sales || 0,
          totalExpenses: eodStats?.total_expenses || metrics.totalExpenses,
          netProfit: eodStats?.net_profit || 0,
          pendingInvoices: metrics.pendingInvoices,
          approvedInvoices: metrics.approvedInvoices,
          totalInvoices: metrics.totalInvoices
        },
        invoices: dashboardInvoices.map((invoice) => ({
          id: invoice.id,
          vendor: invoice.vendor_id ? `Vendor ${String(invoice.vendor_id).slice(0, 8)}` : 'N/A',
          amount: normalizeMoney(invoice.total),
          status: invoice.status || 'Unknown',
          date: invoice.created_at || invoice.issue_date || '',
          outlet: userOutlets.find((outlet) => outlet.id === invoice.outlet_id)?.name
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

  const invoicesRequiringAttention = useMemo(() => {
    const unpaid = dashboardInvoices.filter((invoice) => {
      const status = String(invoice.status || '').toLowerCase();
      return status !== 'paid';
    });
    return (unpaid.length > 0 ? unpaid : dashboardInvoices).slice(0, 6);
  }, [dashboardInvoices]);

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

      {/* Company Onboarding - Full Screen */}
      {showCompanyOnboarding ? (
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
      ) : (
        <>
          {/* Onboarding Popup */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Compact Dashboard Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            {/* Title and Info */}
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Overview of your business performance
                  {canViewAllOutlets() && (
                    <span className="ml-2">• Viewing data for {selectedOutletNames.length} location{selectedOutletNames.length !== 1 ? 's' : ''}</span>
                  )}
                </p>
                {canViewAllOutlets() && (
                  <div className="flex items-center gap-2 mt-2">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 break-words">
                      {selectedOutletNames.length > 0 ? selectedOutletNames.join(', ') : 'All locations'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Controls Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 lg:gap-6 w-full lg:w-auto">
              {/* Custom Date Range Selector */}
              <div className="relative w-full sm:w-auto" data-dropdown="date-picker">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2 w-full sm:w-auto justify-between"
                  onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
                >
                  <Calendar className="w-4 h-4" />
                  <span>{getDateRangeLabel(selectedDateRange, customDateFrom, customDateTo)}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showCustomDatePicker ? 'rotate-180' : ''}`} />
                </Button>

                {showCustomDatePicker && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-20">
                    <div className="p-4">
                      <div className="space-y-3">
                        {/* Quick Date Options */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Quick Select</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { value: 'today', label: 'Today' },
                              { value: 'yesterday', label: 'Yesterday' },
                              { value: 'last_7_days', label: 'Last 7 days' },
                              { value: 'last_30_days', label: 'Last 30 days' },
                              { value: 'this_month', label: 'This month' },
                              { value: 'last_month', label: 'Last month' },
                              { value: 'this_quarter', label: 'This quarter' },
                              { value: 'custom', label: 'Custom range' }
                            ].map(option => (
                              <button
                                key={option.value}
                                onClick={() => handleDateRangeSelect(option.value)}
                                className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                                  selectedDateRange === option.value
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Date Inputs */}
                        {selectedDateRange === 'custom' && (
                          <div className="space-y-3 border-t border-gray-200 dark:border-gray-600 pt-3">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Custom Range</h4>
                            <div className="space-y-2">
                              <div>
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">From</label>
                                <input
                                  type="date"
                                  value={customDateFrom}
                                  onChange={(e) => setCustomDateFrom(e.target.value)}
                                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">To</label>
                                <input
                                  type="date"
                                  value={customDateTo}
                                  onChange={(e) => setCustomDateTo(e.target.value)}
                                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Apply Button */}
                        <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-600">
                          <Button
                            size="sm"
                            onClick={() => setShowCustomDatePicker(false)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                {canViewAllOutlets() && (
                  <div className="relative w-full sm:w-auto" data-dropdown="outlet-selector">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-2 w-full sm:w-auto justify-between"
                      onClick={() => setIsOutletSelectorOpen(!isOutletSelectorOpen)}
                    >
                      <Filter className="w-4 h-4" />
                      <span>Filter</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${isOutletSelectorOpen ? 'rotate-180' : ''}`} />
                    </Button>

                    {isOutletSelectorOpen && (
                      <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-10">
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
                )}

                <FeatureGate
                  userId={currentUser?.id || ''}
                  feature="advancedAnalytics"
                  fallback={
                    <Button
                      size="sm"
                      className="flex items-center space-x-2 bg-gray-400 cursor-not-allowed"
                      disabled
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span>Export Report (Pro)</span>
                    </Button>
                  }
                >
                  <Button
                    size="sm"
                    className="flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 w-full sm:w-auto justify-center"
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

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <DashboardCard
            title="Total Sales"
            value={eodStats ? currencyService.formatCurrency(eodStats.total_sales) : currencyService.formatCurrency(0)}
            icon={<TrendingUp className="w-5 h-5" />}
            subtitle={currentDateRange.label}
            change={salesChange}
            onClick={() => navigate('/dashboard/daily-reports')}
          />
          <DashboardCard
            title="Total Expenses"
            value={eodStats ? currencyService.formatCurrency(eodStats.total_expenses) : currencyService.formatCurrency(metrics.totalExpenses)}
            icon={<CreditCard className="w-5 h-5" />}
            subtitle={currentDateRange.label}
            change={expenseChange}
            onClick={() => navigate('/dashboard/expenses')}
          />
          <DashboardCard
            title="Unpaid Invoices"
            value={invoiceStatsSummary.unpaidCount}
            icon={<AlertTriangle className="w-5 h-5" />}
            subtitle={`${currencyService.formatCurrency(invoiceStatsSummary.unpaidAmount)} outstanding`}
            onClick={() => navigate('/dashboard/invoices')}
          />
          <DashboardCard
            title="Net Profit"
            value={eodStats ? currencyService.formatCurrency(eodStats.net_profit) : currencyService.formatCurrency(0)}
            icon={<BarChart3 className="w-5 h-5" />}
            subtitle={currentDateRange.label}
            change={profitChange}
            onClick={() => navigate('/dashboard/daily-reports')}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Recent Vendor Invoices */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
              <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Invoices</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Latest vendor invoices requiring attention
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2 w-full sm:w-auto justify-center"
                    onClick={() => navigate('/dashboard/invoices')}
                  >
                    <span>View all</span>
                  </Button>
                </div>
              </div>
              
              <div className="p-4 sm:p-6">
                {invoicesRequiringAttention.length > 0 ? (
                  <div className="space-y-3">
                    {invoicesRequiringAttention.map((invoice) => {
                      const status = String(invoice.status || 'unknown');
                      const normalizedStatus = status.toLowerCase();
                      const isPaid = normalizedStatus === 'paid';
                      const totalAmount = normalizeMoney(invoice.total);
                      const issueDate = invoice.issue_date || invoice.created_at;
                      const outletName =
                        userOutlets.find((outlet) => outlet.id === invoice.outlet_id)?.name || 'Outlet';
                      const itemCount = Array.isArray(invoice.invoice_items) ? invoice.invoice_items.length : 0;

                      return (
                        <button
                          key={invoice.id}
                          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                          onClick={() => navigate('/dashboard/invoices')}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {invoice.invoice_number || invoice.id}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {outletName} • {itemCount} item{itemCount === 1 ? '' : 's'}
                              </p>
                            </div>
                            <span
                              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              }`}
                            >
                              {status}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {currencyService.formatCurrency(totalAmount)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {issueDate ? new Date(issueDate).toLocaleDateString() : 'No issue date'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Live updates</p>
                </div>
              </div>
              
              <RecentActivity
                activities={recentActivities}
                onViewAll={() => navigate('/dashboard/audit-trail')}
              />
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-8">Outlet Performance</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {dashboardView.selectedOutlets.length > 0 ? (
                  dashboardView.selectedOutlets.map(outletId => {
                    const outlet = userOutlets.find(o => o.id === outletId);
                    if (!outlet) return null;

                    const outletInvoices = dashboardInvoices.filter((invoice) => invoice.outlet_id === outletId);
                    const outletExpenses = outletInvoices.reduce(
                      (sum, invoice) => sum + normalizeMoney(invoice.total),
                      0
                    );
                    const outletPending = outletInvoices.filter((invoice) => {
                      const status = String(invoice.status || '').toLowerCase();
                      return status !== 'paid';
                    }).length;

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
                              {currencyService.formatCurrency(outletExpenses)}
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
        </>
      )}
    </div>
  );
};

export default Dashboard;
