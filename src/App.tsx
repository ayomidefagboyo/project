import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { OutletProvider, useOutlet } from '@/contexts/OutletContext';
import { initPostHog, trackNavigation, trackSessionEvent } from '@/lib/posthog';
import Layout from '@/components/layout/Layout';
import ScrollToTop from '@/components/ScrollToTop';
import LandingPage from '@/pages/LandingPage';
import About from '@/pages/About';
import Blog from '@/pages/Blog';
import AIRevolutionizingFinance from '@/pages/blog/AIRevolutionizingFinance';
import AutomatedInvoiceProcessing from '@/pages/blog/AutomatedInvoiceProcessing';
import MultiLocationFinance from '@/pages/blog/MultiLocationFinance';
import MobileFirstFinancialManagement from '@/pages/blog/MobileFirstFinancialManagement';
import FinancialAnalyticsRestaurants from '@/pages/blog/FinancialAnalyticsRestaurants';
import FinancialDataSecurity from '@/pages/blog/FinancialDataSecurity';
import FutureEODReporting from '@/pages/blog/FutureEODReporting';
import ROICalculatorGuide from '@/pages/blog/ROICalculatorGuide';
import Dashboard from '@/pages/Dashboard';
import Invoices from '@/pages/invoices/Invoices';
import CreateInvoice from '@/pages/invoices/CreateInvoice';
import InvoiceDetail from '@/pages/invoices/InvoiceDetail';
import Expenses from '@/pages/expenses/Expenses';
import CreateExpense from '@/pages/expenses/CreateExpense';
import DailyReports from '@/pages/reports/DailyReports';
import CreateReport from '@/pages/reports/CreateReport';
import EODDashboard from '@/pages/reports/EODDashboard';
import Vendors from '@/pages/vendors/Vendors';
import AIAssistant from '@/pages/AIAssistant';
import AuditTrail from '@/pages/AuditTrail';
import Settings from '@/pages/Settings';
import AuthWrapper from '@/components/auth/AuthWrapper';

// Calculator imports
import CalculatorLanding from '@/pages/calculators/CalculatorLanding';
import ROICalculator from '@/pages/calculators/ROICalculator';
import BreakEvenCalculator from '@/pages/calculators/BreakEvenCalculator';
import CashFlowCalculator from '@/pages/calculators/CashFlowCalculator';
import ProfitMarginCalculator from '@/pages/calculators/ProfitMarginCalculator';
import InventoryTurnoverCalculator from '@/pages/calculators/InventoryTurnoverCalculator';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, isLoading } = useOutlet();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

// Main App Routes
const AppRoutes = () => {
  const { currentUser } = useOutlet();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<About />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/ai-revolutionizing-finance" element={<AIRevolutionizingFinance />} />
      <Route path="/blog/automated-invoice-processing-roi" element={<AutomatedInvoiceProcessing />} />
      <Route path="/blog/streamline-multi-location-finance" element={<MultiLocationFinance />} />
      {/* Additional blog articles */}
      <Route path="/blog/mobile-first-financial-management" element={<MobileFirstFinancialManagement />} />
      <Route path="/blog/financial-analytics-restaurants" element={<FinancialAnalyticsRestaurants />} />
      <Route path="/blog/financial-data-security" element={<FinancialDataSecurity />} />
      <Route path="/blog/future-eod-reporting" element={<FutureEODReporting />} />

      {/* Calculator-focused blog articles */}
      <Route path="/blog/roi-calculator-guide" element={<ROICalculatorGuide />} />

      {/* Calculator routes - public access for SEO */}
      <Route path="/calculators" element={<CalculatorLanding />} />
      <Route path="/calculators/roi" element={<ROICalculator />} />
      <Route path="/calculators/break-even" element={<BreakEvenCalculator />} />
      <Route path="/calculators/cash-flow" element={<CashFlowCalculator />} />
      <Route path="/calculators/profit-margin" element={<ProfitMarginCalculator />} />
      <Route path="/calculators/inventory-turnover" element={<InventoryTurnoverCalculator />} />

      <Route path="/auth" element={<AuthWrapper onAuthSuccess={() => window.location.href = '/dashboard'} />} />
      
      {/* Protected routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/create" element={<CreateInvoice />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="expenses/create" element={<CreateExpense />} />
        <Route path="daily-reports" element={<DailyReports />} />
        <Route path="daily-reports/create" element={<CreateReport />} />
        <Route path="eod" element={<EODDashboard />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="ai-assistant" element={<AIAssistant />} />
        <Route path="audit-trail" element={<AuditTrail />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      
      {/* Redirect unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// Main App Component
const App = () => {
  // Initialize PostHog analytics
  useEffect(() => {
    initPostHog();

    // Track session start
    trackSessionEvent('session_start');

    // Track page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        trackSessionEvent('focus_gained');
      } else {
        trackSessionEvent('focus_lost');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Track session end on beforeunload
    const handleBeforeUnload = () => {
      trackSessionEvent('session_end');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <HelmetProvider>
      <OutletProvider>
        <Router>
          <ScrollToTop />
          <AppRoutes />
        </Router>
      </OutletProvider>
    </HelmetProvider>
  );
};

export default App;