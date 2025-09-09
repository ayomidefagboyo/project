
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { OutletProvider, useOutlet } from '@/contexts/OutletContext';
import Layout from '@/components/layout/Layout';
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

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthWrapper onAuthSuccess={() => {}} />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
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
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

// Main App Component
const App = () => {
  return (
    <OutletProvider>
      <Router>
        <AppRoutes />
      </Router>
    </OutletProvider>
  );
};

export default App;