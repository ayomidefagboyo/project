import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  CreditCard, 
  TrendingUp, 
  BarChart3, 
  ChevronDown, 
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
  payment_status?: string | null;
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

interface DashboardExpenseStatsResponse {
  total_expenses: number;
  total_count: number;
  approved_amount: number;
  pending_amount: number;
  pending_count: number;
}

interface MetricChange {
  value: number;
  isPositive: boolean;
  displayLabel?: string;
  comparisonLabel?: string;
}

interface DashboardFinancialSummary {
  operatingExpenses: number;
  inventoryCost: number;
  paidProcurement: number;
  netProfit: number;
}

interface DashboardOverviewResponse {
  outlet_ids: string[];
  date_range: {
    from: string;
    to: string;
    previous_from: string;
    previous_to: string;
  };
  sales_summary: {
    revenue: number;
    transaction_count: number;
    average_transaction_value: number;
    previous_revenue: number;
  };
  payment_breakdown: Record<string, number>;
  top_products: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  recent_transactions: Array<{
    id: string;
    transaction_number: string;
    outlet_id: string;
    total_amount: number;
    payment_method: string;
    transaction_date: string;
    cashier_name: string;
    item_count: number;
  }>;
  recent_activity?: Array<{
    id: string;
    outlet_id: string;
    user_id?: string | null;
    user_name?: string | null;
    action: string;
    entity_type?: string | null;
    entity_id?: string | null;
    details: string;
    timestamp: string;
  }>;
  inventory_alerts: {
    low_stock_count: number;
    out_of_stock_count: number;
    expiring_count: number;
    low_stock_items: Array<{
      id: string;
      name: string;
      outlet_id: string;
      quantity_on_hand: number;
      reorder_level: number;
    }>;
    expiring_items: Array<{
      id: string;
      name: string;
      outlet_id: string;
      expiry_date: string;
      days_to_expiry: number;
    }>;
  };
  compazz_insights: {
    highlights: string[];
    recommendations: string[];
    anomaly_count: number;
  };
}

const DASHBOARD_INVOICE_PAGE_SIZE = 100;
const EMPTY_FINANCIAL_SUMMARY: DashboardFinancialSummary = {
  operatingExpenses: 0,
  inventoryCost: 0,
  paidProcurement: 0,
  netProfit: 0,
};

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
  const [financialSummary, setFinancialSummary] = useState<DashboardFinancialSummary>(EMPTY_FINANCIAL_SUMMARY);
  const [operatingExpensesByOutlet, setOperatingExpensesByOutlet] = useState<Record<string, number>>({});
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
  const [appliedCustomDateFrom, setAppliedCustomDateFrom] = useState('');
  const [appliedCustomDateTo, setAppliedCustomDateTo] = useState('');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [isOutletSelectorOpen, setIsOutletSelectorOpen] = useState(false);
  const [outletSelectionDraft, setOutletSelectionDraft] = useState<string[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCompanyOnboarding, setShowCompanyOnboarding] = useState(false);
  const [showTrialExpired, setShowTrialExpired] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [outletName, setOutletName] = useState('');
  const [businessType, setBusinessType] = useState<'supermarket' | 'restaurant' | 'lounge' | 'retail' | 'cafe'>('retail');
  const [dashboardOverview, setDashboardOverview] = useState<DashboardOverviewResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dashboardOverviewCacheRef = useRef<Record<string, DashboardOverviewResponse>>({});

  const syncOverviewState = (overview: DashboardOverviewResponse) => {
    setDashboardOverview(overview);
    setDashboardInvoices([]);
    setRecentActivities(
      (overview.recent_activity || []).map((entry) => ({
        id: entry.id,
        outletId: entry.outlet_id,
        userId: String(entry.user_id || ''),
        userName: String(entry.user_name || 'System'),
        action: String(entry.action || 'view'),
        entityType: String(entry.entity_type || 'sales') as AuditEntry['entityType'],
        entityId: String(entry.entity_id || ''),
        details: String(entry.details || ''),
        timestamp: String(entry.timestamp || ''),
      }))
    );
    setEodStats({
      total_sales: overview.sales_summary.revenue,
    });
    setInvoiceStatsSummary({ total: 0, unpaidCount: 0, unpaidAmount: 0, paidCount: 0 });
    setOperatingExpensesByOutlet({});
    setFinancialSummary({
      operatingExpenses: 0,
      inventoryCost: 0,
      paidProcurement: 0,
      netProfit: overview.sales_summary.revenue,
    });
    setSalesChange(
      buildPercentChange(
        overview.sales_summary.revenue,
        overview.sales_summary.previous_revenue,
        false
      )
    );
    setExpenseChange(undefined);
    setProfitChange(undefined);
  };

  const toggleOutletSelector = () => {
    if (!isOutletSelectorOpen) {
      setOutletSelectionDraft([...dashboardView.selectedOutlets]);
    }
    setIsOutletSelectorOpen((previous) => !previous);
  };

  const handleOutletDraftToggle = (outletId: string, checked: boolean) => {
    setOutletSelectionDraft((previous) => {
      if (checked) {
        return previous.includes(outletId) ? previous : [...previous, outletId];
      }
      return previous.filter((id) => id !== outletId);
    });
  };

  const applyOutletSelection = () => {
    setDashboardView((previous) => ({
      ...previous,
      selectedOutlets: [...outletSelectionDraft],
    }));
    setIsOutletSelectorOpen(false);
  };

  const selectedOutletsUnchanged =
    outletSelectionDraft.length === dashboardView.selectedOutlets.length &&
    outletSelectionDraft.every((outletId) => dashboardView.selectedOutlets.includes(outletId));
  
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
          from: appliedCustomDateFrom || today,
          to: appliedCustomDateTo || today,
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
    if (current === 0 && previous === 0) {
      return { value: 0, isPositive: true, displayLabel: '0%', comparisonLabel: 'no change' };
    }
    if (previous === 0) {
      return {
        value: 0,
        isPositive: !lowerIsBetter,
        displayLabel: current === 0 ? '0%' : 'New',
        comparisonLabel: 'no prior baseline',
      };
    }

    const raw = ((current - previous) / Math.abs(previous)) * 100;
    const rounded = Math.round(Math.abs(raw) * 10) / 10;

    return {
      value: rounded,
      isPositive: lowerIsBetter ? raw <= 0 : raw >= 0,
      comparisonLabel: 'vs prior period',
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

  const fetchVendorInvoicesForOutlet = async (outletId: string, dateFrom: string, dateTo: string) => {
    let page = 1;
    let totalPages = 1;
    const collected: DashboardInvoice[] = [];

    while (page <= totalPages) {
      const response = await apiClient.get<DashboardInvoicesResponse>('/invoices/', {
        outlet_id: outletId,
        invoice_type: 'vendor',
        page,
        size: DASHBOARD_INVOICE_PAGE_SIZE,
        date_from: dateFrom,
        date_to: dateTo,
      });

      if (response.error || !response.data) {
        throw new Error(response.error || 'Failed to load dashboard invoices');
      }

      const pageItems = Array.isArray(response.data.items) ? response.data.items : [];
      collected.push(...pageItems);
      totalPages = Math.max(1, Number(response.data.pages || 1));
      page += 1;
    }

    return collected;
  };

  const fetchOperatingExpenseTotalsByOutlet = async (
    outletIds: string[],
    dateFrom: string,
    dateTo: string
  ): Promise<Record<string, number>> => {
    const responses = await Promise.all(
      outletIds.map((outletId) =>
        apiClient.get<DashboardExpenseStatsResponse>('/expenses/stats/summary', {
          outlet_id: outletId,
          date_from: dateFrom,
          date_to: dateTo,
        })
      )
    );

    return outletIds.reduce<Record<string, number>>((accumulator, outletId, index) => {
      const response = responses[index];
      accumulator[outletId] =
        !response?.error && response?.data
          ? normalizeMoney(response.data.total_expenses)
          : 0;
      return accumulator;
    }, {});
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
        const paymentStatus = String(invoice.payment_status || invoice.status || '').toLowerCase();

        acc.total += 1;
        if (paymentStatus === 'paid') {
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
      setError(null);

      const outletIds = dashboardView.selectedOutlets;
      if (outletIds.length === 0) {
        setDashboardOverview(null);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }
      const cacheKey = `${[...outletIds].sort().join(',')}|${currentDateRange.from}|${currentDateRange.to}`;
      const cachedOverview = dashboardOverviewCacheRef.current[cacheKey];

      if (cachedOverview) {
        syncOverviewState(cachedOverview);
        setLoading(false);
        setIsRefreshing(true);
      } else {
        setLoading(true);
        setIsRefreshing(false);
      }

      const response = await apiClient.get<DashboardOverviewResponse>('/reports/dashboard-overview', {
        outlet_ids: outletIds.join(','),
        date_from: currentDateRange.from,
        date_to: currentDateRange.to,
      });

      if (response.error || !response.data) {
        throw new Error(response.error || 'Failed to load dashboard overview');
      }

      dashboardOverviewCacheRef.current[cacheKey] = response.data;
      syncOverviewState(response.data);

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (dashboardView.selectedOutlets.length > 0) {
      loadDashboardData();
    }
  }, [dashboardView.selectedOutlets, selectedDateRange, appliedCustomDateFrom, appliedCustomDateTo]);

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
    return {
      operatingExpenses: financialSummary.operatingExpenses,
      inventoryCost: financialSummary.inventoryCost,
      paidProcurement: financialSummary.paidProcurement,
      netProfit: financialSummary.netProfit,
      pendingInvoices: invoiceStatsSummary.unpaidCount,
      approvedInvoices: invoiceStatsSummary.paidCount,
      totalInvoices: invoiceStatsSummary.total,
    };
  };

  const metrics = calculateMetrics();

  // Export report functionality
  const handleExportReport = () => {
    try {
      if (!dashboardOverview) {
        return;
      }

      const reportData = {
        generatedAt: new Date().toISOString(),
        outlets: selectedOutletNames,
        dateRange: {
          startDate: currentDateRange.from,
          endDate: currentDateRange.to
        },
        metrics: {
          totalSales: dashboardOverview.sales_summary.revenue || 0,
          transactionCount: dashboardOverview.sales_summary.transaction_count || 0,
          averageTransactionValue: dashboardOverview.sales_summary.average_transaction_value || 0,
          lowStockCount: dashboardOverview.inventory_alerts.low_stock_count || 0,
          expiringCount: dashboardOverview.inventory_alerts.expiring_count || 0,
        },
        topProducts: dashboardOverview.top_products,
        recentTransactions: dashboardOverview.recent_transactions,
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
      ['Transaction Count', data.metrics.transactionCount.toString(), data.outlets.join('; ')],
      ['Average Transaction Value', `$${data.metrics.averageTransactionValue.toLocaleString()}`, data.outlets.join('; ')],
      ['Low Stock Items', data.metrics.lowStockCount.toString(), data.outlets.join('; ')],
      ['Expiring Soon Items', data.metrics.expiringCount.toString(), data.outlets.join('; ')],
      [''], // Empty row
      ['Top Products', '', ''],
      ['Name', 'Units', 'Revenue']
    ];

    data.topProducts.forEach((product: any) => {
      rows.push([
        product.name || 'N/A',
        String(product.quantity || 0),
        `$${(product.revenue || 0).toLocaleString()}`
      ]);
    });

    rows.push([''], ['Recent Transactions', '', ''], ['Transaction #', 'Amount', 'Payment', 'Cashier', 'Date']);

    data.recentTransactions.forEach((transaction: any) => {
      rows.push([
        transaction.transaction_number || transaction.id || 'N/A',
        `$${(transaction.total_amount || 0).toLocaleString()}`,
        transaction.payment_method || 'N/A',
        transaction.cashier_name || 'Unknown',
        transaction.transaction_date ? new Date(transaction.transaction_date).toLocaleDateString() : 'N/A',
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
  const resolvedOutletCount =
    selectedOutletNames.length > 0
      ? selectedOutletNames.length
      : dashboardView.selectedOutlets.length > 0
      ? dashboardView.selectedOutlets.length
      : currentOutlet
      ? 1
      : 0;
  const selectedOutletSummary =
    selectedOutletNames.length > 0
      ? selectedOutletNames.join(', ')
      : currentOutlet?.name || 'All locations';

  const overviewSales = dashboardOverview?.sales_summary.revenue || 0;
  const overviewTransactionCount = dashboardOverview?.sales_summary.transaction_count || 0;
  const overviewAverageTransaction = dashboardOverview?.sales_summary.average_transaction_value || 0;
  const overviewInventoryAlertCount =
    (dashboardOverview?.inventory_alerts.low_stock_count || 0) +
    (dashboardOverview?.inventory_alerts.out_of_stock_count || 0) +
    (dashboardOverview?.inventory_alerts.expiring_count || 0);

  const unpaidInvoices = dashboardInvoices.filter((invoice) => {
    const paymentStatus = String(invoice.payment_status || invoice.status || '').toLowerCase();
    return paymentStatus !== 'paid';
  });
  const invoicesRequiringAttention =
    (unpaidInvoices.length > 0 ? unpaidInvoices : dashboardInvoices).slice(0, 6);

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
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 sm:gap-4">
            <p
              className="text-sm text-gray-500 dark:text-gray-400 truncate"
              title={`Overview of your business performance • Viewing data for ${resolvedOutletCount} location${resolvedOutletCount === 1 ? '' : 's'} • ${selectedOutletSummary}`}
            >
              Overview of your business performance • Viewing data for {resolvedOutletCount} location{resolvedOutletCount === 1 ? '' : 's'} • {selectedOutletSummary}
            </p>

            {/* Controls Row */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full xl:w-auto">
              {/* Custom Date Range Selector */}
              <div className="relative" data-dropdown="date-picker">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                  onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
                >
                  <Calendar className="w-4 h-4" />
                  <span>{getDateRangeLabel(selectedDateRange, appliedCustomDateFrom, appliedCustomDateTo)}</span>
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
                            onClick={() => {
                              setAppliedCustomDateFrom(customDateFrom);
                              setAppliedCustomDateTo(customDateTo);
                              setShowCustomDatePicker(false);
                            }}
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
              <div className="flex flex-wrap items-center gap-2">
                {canViewAllOutlets() && (
                  <div className="relative" data-dropdown="outlet-selector">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-2"
                      onClick={toggleOutletSelector}
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
                                checked={outletSelectionDraft.includes(outlet.id)}
                                onChange={(e) => {
                                  handleOutletDraftToggle(outlet.id, e.target.checked);
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
                          <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setIsOutletSelectorOpen(false);
                                  setOutletSelectionDraft([...dashboardView.selectedOutlets]);
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={applyOutletSelection}
                                disabled={outletSelectionDraft.length === 0 || selectedOutletsUnchanged}
                              >
                                Apply
                              </Button>
                            </div>
                          </div>
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
                    className="flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 justify-center"
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
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <DashboardCard
            title="Revenue"
            value={currencyService.formatCurrency(overviewSales)}
            icon={<TrendingUp className="w-5 h-5" />}
            subtitle={`${currentDateRange.label}${isRefreshing ? ' • refreshing' : ''}`}
            change={salesChange}
            onClick={() => navigate('/dashboard/daily-reports')}
          />
          <DashboardCard
            title="Transactions"
            value={overviewTransactionCount.toLocaleString()}
            icon={<Activity className="w-5 h-5" />}
            subtitle="Completed sales in range"
          />
          <DashboardCard
            title="Average Sale"
            value={currencyService.formatCurrency(overviewAverageTransaction)}
            icon={<CreditCard className="w-5 h-5" />}
            subtitle="Average transaction value"
          />
          <DashboardCard
            title="Inventory Alerts"
            value={overviewInventoryAlertCount}
            icon={<AlertTriangle className="w-5 h-5" />}
            subtitle={`${dashboardOverview?.inventory_alerts.low_stock_count || 0} low stock • ${dashboardOverview?.inventory_alerts.expiring_count || 0} expiring`}
            onClick={() => navigate('/dashboard/products')}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Sales Summary</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Today's total revenue, transactions, and average transaction value for the selected period.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Revenue</p>
                    <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                      {currencyService.formatCurrency(overviewSales)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Transactions</p>
                    <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                      {overviewTransactionCount.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Average</p>
                    <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                      {currencyService.formatCurrency(overviewAverageTransaction)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Top Products</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Best-selling items for the selected date range.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/products')}>
                    View catalog
                  </Button>
                </div>
                <div className="mt-5 space-y-3">
                  {(dashboardOverview?.top_products || []).length > 0 ? (
                    (dashboardOverview?.top_products || []).map((product, index) => (
                      <div key={`${product.name}-${index}`} className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{product.quantity.toLocaleString()} units sold</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {currencyService.formatCurrency(product.revenue)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No product sales recorded for this range.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Latest audited actions across the selected outlet scope.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/audit-trail')}>
                  View all
                </Button>
              </div>
              <div className="mt-5">
                <RecentActivity activities={recentActivities} />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Inventory Alerts</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Low-stock and expiring product warnings.</p>
              <div className="mt-5 space-y-3">
                {(dashboardOverview?.inventory_alerts.low_stock_items || []).map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {item.quantity_on_hand} on hand • reorder at {item.reorder_level}
                    </p>
                  </div>
                ))}
                {(dashboardOverview?.inventory_alerts.expiring_items || []).map((item) => (
                  <div key={item.id} className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10 p-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Expires in {item.days_to_expiry} day{item.days_to_expiry === 1 ? '' : 's'}
                    </p>
                  </div>
                ))}
                {overviewInventoryAlertCount === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No current inventory alerts for this range.</p>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Compazz Insights</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">AI-style operational trends, anomalies, and recommendations.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/ai-assistant')}>
                  Open
                </Button>
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Highlights</p>
                  <div className="space-y-2">
                    {(dashboardOverview?.compazz_insights.highlights || []).map((insight, index) => (
                      <div key={index} className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-3 text-sm text-gray-700 dark:text-gray-200">
                        {insight}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Recommended Actions</p>
                  <ul className="space-y-2">
                    {(dashboardOverview?.compazz_insights.recommendations || []).map((recommendation, index) => (
                      <li key={index} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3 text-sm text-gray-700 dark:text-gray-200">
                        {recommendation}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
