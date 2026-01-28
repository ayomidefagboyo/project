/**
 * EXAMPLE: How to use PostHog Analytics Hooks in Components
 *
 * This file demonstrates the proper usage of all analytics tracking hooks
 * and utility functions available in the Compazz application.
 *
 * Copy these patterns into your actual components as needed.
 */

import React, { useState, useEffect } from 'react';
import {
  useAnalytics,
  usePageTracking,
  useFormTracking,
  useFeatureTracking,
  useBusinessTracking,
  useSearchTracking,
  useExportTracking,
  useDashboardTracking,
  useNavigationTracking,
  useErrorTracking
} from '@/hooks/useAnalytics';

// EXAMPLE 1: Simple Page Component with Auto-tracking
const ExampleDashboard: React.FC = () => {
  // This automatically tracks page visits, time spent, and provides all tracking functions
  const analytics = useAnalytics('example_dashboard');

  useEffect(() => {
    // Track dashboard widgets viewed
    analytics.trackWidgetInteraction('revenue_chart', 'viewed');
    analytics.trackWidgetInteraction('expense_summary', 'viewed');
  }, []);

  const handleExportClick = () => {
    // Track export action
    analytics.trackDataExport('csv', 'dashboard', 150);
  };

  const handleWidgetFilter = (filterType: string, filterValue: string) => {
    // Track dashboard interactions
    analytics.trackDashboardFilter(filterType, filterValue, ['revenue_chart', 'expense_summary']);
  };

  return (
    <div>
      <h1>Dashboard</h1>
      <button onClick={handleExportClick}>Export Data</button>
      <button onClick={() => handleWidgetFilter('date_range', 'last_30_days')}>
        Filter Last 30 Days
      </button>
    </div>
  );
};

// EXAMPLE 2: Form Component with Comprehensive Tracking
const ExampleInvoiceForm: React.FC = () => {
  const [formData, setFormData] = useState({
    vendorName: '',
    amount: 0,
    description: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form-specific tracking
  const {
    trackFormStart,
    trackFormComplete,
    trackFormAbandon,
    trackFormError
  } = useFormTracking('invoice_creation');

  // Business event tracking
  const { trackInvoiceCreated } = useBusinessTracking();

  // Error tracking
  const { trackValidationError, trackApiError } = useErrorTracking();

  useEffect(() => {
    // Track form start when component mounts
    trackFormStart(3); // 3 fields in the form
  }, [trackFormStart]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const newErrors: Record<string, string> = {};
    if (!formData.vendorName) {
      newErrors.vendorName = 'Vendor name is required';
      trackValidationError('invoice_creation', 'vendorName', 'Required field missing');
    }
    if (formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
      trackValidationError('invoice_creation', 'amount', 'Invalid amount');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      trackFormError('validation', 'Form validation failed', Object.keys(newErrors)[0]);
      return;
    }

    try {
      // Simulate API call
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      // Track successful completion
      trackFormComplete({
        vendor_name: formData.vendorName,
        amount: formData.amount
      });

      // Track business event
      trackInvoiceCreated(formData.amount, {
        vendor_name: formData.vendorName,
        has_description: !!formData.description
      });

    } catch (error) {
      // Track API error
      trackApiError('/api/invoices', 500, error instanceof Error ? error.message : 'Unknown error', formData);
    }
  };

  const handleAbandon = () => {
    trackFormAbandon('user_navigation', {
      fields_completed: Object.values(formData).filter(Boolean).length
    });
  };

  // Track form abandonment on page leave
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (Object.values(formData).some(Boolean)) {
        handleAbandon();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [formData]);

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.vendorName}
        onChange={(e) => setFormData(prev => ({ ...prev, vendorName: e.target.value }))}
        placeholder="Vendor Name"
      />
      {errors.vendorName && <span>{errors.vendorName}</span>}

      <input
        type="number"
        value={formData.amount}
        onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
        placeholder="Amount"
      />
      {errors.amount && <span>{errors.amount}</span>}

      <textarea
        value={formData.description}
        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
        placeholder="Description (optional)"
      />

      <button type="submit">Create Invoice</button>
      <button type="button" onClick={handleAbandon}>Cancel</button>
    </form>
  );
};

// EXAMPLE 3: Search Component with Advanced Tracking
const ExampleSearchComponent: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const {
    trackSearchQuery,
    trackSearchFilter,
    trackSearchSort
  } = useSearchTracking();

  const { trackFeatureClick } = useFeatureTracking();

  const handleSearch = async (term: string) => {
    try {
      const response = await fetch(`/api/search?q=${term}`);
      const data = await response.json();

      setResults(data);
      trackSearchQuery(term, data.length, 'invoices');

    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleFilter = (filterType: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
    trackSearchFilter(filterType, value, results.length);
  };

  const handleSort = (field: string, direction: 'asc' | 'desc') => {
    trackSearchSort(field, direction);
    // Sort results...
  };

  const handleResultClick = (resultId: string, position: number) => {
    trackFeatureClick('search_result_click', resultId, {
      search_term: searchTerm,
      result_position: position,
      total_results: results.length
    });
  };

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchTerm)}
        placeholder="Search invoices..."
      />

      <select onChange={(e) => handleFilter('status', e.target.value)}>
        <option value="">All Statuses</option>
        <option value="paid">Paid</option>
        <option value="pending">Pending</option>
        <option value="overdue">Overdue</option>
      </select>

      <button onClick={() => handleSort('date', 'desc')}>
        Sort by Date (Newest)
      </button>

      {results.map((result, index) => (
        <div
          key={result.id}
          onClick={() => handleResultClick(result.id, index)}
          style={{ cursor: 'pointer', padding: '10px', border: '1px solid #ccc', margin: '5px 0' }}
        >
          {result.title}
        </div>
      ))}
    </div>
  );
};

// EXAMPLE 4: Navigation Component with Menu Tracking
const ExampleNavigation: React.FC = () => {
  const {
    trackPageNavigation,
    trackBreadcrumbClick,
    trackMenuClick
  } = useNavigationTracking();

  const handleMenuClick = (menuItem: string, path: string) => {
    trackMenuClick(menuItem, 'sidebar');
    trackPageNavigation(path, 'click');
    // Navigate to path...
  };

  const handleBreadcrumbClick = (breadcrumb: string, position: number) => {
    trackBreadcrumbClick(breadcrumb, position, 3); // assuming 3 total breadcrumbs
    // Navigate to breadcrumb path...
  };

  return (
    <nav>
      {/* Sidebar Menu */}
      <ul>
        <li onClick={() => handleMenuClick('dashboard', '/dashboard')}>Dashboard</li>
        <li onClick={() => handleMenuClick('invoices', '/invoices')}>Invoices</li>
        <li onClick={() => handleMenuClick('expenses', '/expenses')}>Expenses</li>
        <li onClick={() => handleMenuClick('reports', '/reports')}>Reports</li>
      </ul>

      {/* Breadcrumbs */}
      <div>
        <span onClick={() => handleBreadcrumbClick('Home', 0)}>Home</span>
        <span> / </span>
        <span onClick={() => handleBreadcrumbClick('Invoices', 1)}>Invoices</span>
        <span> / </span>
        <span onClick={() => handleBreadcrumbClick('Create', 2)}>Create</span>
      </div>
    </nav>
  );
};

// EXAMPLE 5: Feature Usage Tracking in Interactive Components
const ExampleDashboardWidget: React.FC<{ widgetName: string }> = ({ widgetName }) => {
  const { trackFeatureView, trackFeatureClick } = useFeatureTracking();
  const [viewStartTime] = useState(Date.now());

  useEffect(() => {
    // Track when widget comes into view
    trackFeatureView(widgetName);

    return () => {
      // Track view duration when component unmounts
      const viewDuration = Date.now() - viewStartTime;
      trackFeatureView(widgetName, viewDuration, {
        engagement_level: viewDuration > 10000 ? 'high' : viewDuration > 3000 ? 'medium' : 'low'
      });
    };
  }, [widgetName, viewStartTime, trackFeatureView]);

  const handleInteraction = (action: string, elementId: string) => {
    trackFeatureClick(`${widgetName}_${action}`, elementId, {
      widget_name: widgetName,
      action
    });
  };

  return (
    <div>
      <h3>{widgetName}</h3>
      <button onClick={() => handleInteraction('refresh', 'refresh-btn')}>
        Refresh
      </button>
      <button onClick={() => handleInteraction('expand', 'expand-btn')}>
        Expand
      </button>
      <button onClick={() => handleInteraction('settings', 'settings-btn')}>
        Settings
      </button>
    </div>
  );
};

// EXAMPLE 6: Performance Tracking for Heavy Operations
const ExampleDataProcessor: React.FC = () => {
  const { trackPerformance } = useAnalytics();

  const handleHeavyOperation = async () => {
    const startTime = Date.now();

    try {
      // Simulate heavy operation
      await new Promise(resolve => setTimeout(resolve, 2000));

      const duration = Date.now() - startTime;
      trackPerformance('data_processing', duration, true, {
        operation_type: 'bulk_import',
        records_processed: 1000
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      trackPerformance('data_processing', duration, false, {
        operation_type: 'bulk_import',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  return (
    <button onClick={handleHeavyOperation}>
      Process Data
    </button>
  );
};

// Export examples for reference
export {
  ExampleDashboard,
  ExampleInvoiceForm,
  ExampleSearchComponent,
  ExampleNavigation,
  ExampleDashboardWidget,
  ExampleDataProcessor
};

export default ExampleDashboard;