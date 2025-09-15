import { useCallback, useEffect, useRef } from 'react';
import {
  trackEvent,
  trackFeatureUsage,
  trackNavigation,
  trackFormInteraction,
  trackError,
  trackPerformance,
  trackBusinessEvent,
  trackOnboardingStep,
  trackSearch,
  trackDocumentEvent,
  trackDashboardInteraction,
  trackTimeSpent,
  trackBusinessMetric,
  trackExportEvent
} from '@/lib/posthog';

// Hook for tracking page visits and time spent
export const usePageTracking = (pageName: string, properties?: Record<string, any>) => {
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Track page view
    trackEvent('page_view', {
      page_name: pageName,
      ...properties,
      timestamp: new Date().toISOString()
    });

    // Reset start time when page changes
    startTimeRef.current = Date.now();

    return () => {
      // Track time spent on page
      const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (timeSpent > 5) { // Only track if spent more than 5 seconds
        const engagementLevel = timeSpent < 30 ? 'low' : timeSpent < 120 ? 'medium' : 'high';
        trackTimeSpent(pageName, timeSpent, engagementLevel);
      }
    };
  }, [pageName, properties]);
};

// Hook for tracking form interactions
export const useFormTracking = (formName: string) => {
  const startTimeRef = useRef<number | null>(null);
  const fieldCountRef = useRef<number>(0);

  const trackFormStart = useCallback((fieldCount: number = 0) => {
    startTimeRef.current = Date.now();
    fieldCountRef.current = fieldCount;
    trackFormInteraction(formName, 'started', fieldCount);
  }, [formName]);

  const trackFormComplete = useCallback((properties?: Record<string, any>) => {
    const duration = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    trackFormInteraction(formName, 'completed', fieldCountRef.current, {
      duration_ms: duration,
      ...properties
    });
    trackPerformance(`${formName}_completion`, duration, true, properties);
  }, [formName]);

  const trackFormAbandon = useCallback((reason?: string, properties?: Record<string, any>) => {
    const duration = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    trackFormInteraction(formName, 'abandoned', fieldCountRef.current, {
      reason,
      duration_ms: duration,
      ...properties
    });
    trackPerformance(`${formName}_abandon`, duration, false, { reason, ...properties });
  }, [formName]);

  const trackFormError = useCallback((errorType: string, errorMessage: string, fieldName?: string) => {
    trackError('validation', errorMessage, {
      form: formName,
      error_type: errorType,
      field: fieldName
    });
    trackFormAbandon('validation_error', {
      error_type: errorType,
      error_message: errorMessage,
      field: fieldName
    });
  }, [formName, trackFormAbandon]);

  return {
    trackFormStart,
    trackFormComplete,
    trackFormAbandon,
    trackFormError
  };
};

// Hook for tracking feature usage
export const useFeatureTracking = () => {
  const trackFeature = useCallback((featureName: string, action: 'viewed' | 'used' | 'completed', properties?: Record<string, any>) => {
    trackFeatureUsage(featureName, action, properties);
  }, []);

  const trackFeatureClick = useCallback((featureName: string, elementId?: string, properties?: Record<string, any>) => {
    trackFeatureUsage(featureName, 'used', {
      element_id: elementId,
      interaction_type: 'click',
      ...properties
    });
  }, []);

  const trackFeatureView = useCallback((featureName: string, viewDuration?: number, properties?: Record<string, any>) => {
    trackFeatureUsage(featureName, 'viewed', {
      view_duration_ms: viewDuration,
      ...properties
    });
  }, []);

  return {
    trackFeature,
    trackFeatureClick,
    trackFeatureView
  };
};

// Hook for tracking business events
export const useBusinessTracking = () => {
  const trackInvoiceCreated = useCallback((amount: number, properties?: Record<string, any>) => {
    trackBusinessEvent('invoice_created', amount, properties);
    trackBusinessMetric('invoice_value', amount, 'currency', properties);
  }, []);

  const trackExpenseAdded = useCallback((amount: number, category: string, properties?: Record<string, any>) => {
    trackBusinessEvent('expense_added', amount, {
      category,
      ...properties
    });
    trackBusinessMetric('expense_value', amount, 'currency', { category, ...properties });
  }, []);

  const trackVendorAdded = useCallback((vendorName: string, properties?: Record<string, any>) => {
    trackBusinessEvent('vendor_added', undefined, {
      vendor_name: vendorName,
      ...properties
    });
  }, []);

  const trackReportGenerated = useCallback((reportType: string, recordCount: number, properties?: Record<string, any>) => {
    trackBusinessEvent('report_generated', undefined, {
      report_type: reportType,
      record_count: recordCount,
      ...properties
    });
  }, []);

  const trackPaymentProcessed = useCallback((amount: number, method: string, properties?: Record<string, any>) => {
    trackBusinessEvent('payment_processed', amount, {
      payment_method: method,
      ...properties
    });
    trackBusinessMetric('payment_value', amount, 'currency', { method, ...properties });
  }, []);

  return {
    trackInvoiceCreated,
    trackExpenseAdded,
    trackVendorAdded,
    trackReportGenerated,
    trackPaymentProcessed
  };
};

// Hook for tracking search interactions
export const useSearchTracking = () => {
  const trackSearchQuery = useCallback((searchTerm: string, resultCount: number, searchType: 'invoices' | 'vendors' | 'expenses' | 'reports' = 'invoices') => {
    trackSearch(searchTerm, resultCount, searchType);
  }, []);

  const trackSearchFilter = useCallback((filterType: string, filterValue: string, resultCount: number) => {
    trackEvent('search_filtered', {
      filter_type: filterType,
      filter_value: filterValue,
      result_count: resultCount,
      timestamp: new Date().toISOString()
    });
  }, []);

  const trackSearchSort = useCallback((sortField: string, sortDirection: 'asc' | 'desc') => {
    trackEvent('search_sorted', {
      sort_field: sortField,
      sort_direction: sortDirection,
      timestamp: new Date().toISOString()
    });
  }, []);

  return {
    trackSearchQuery,
    trackSearchFilter,
    trackSearchSort
  };
};

// Hook for tracking exports and downloads
export const useExportTracking = () => {
  const trackDataExport = useCallback((exportType: 'csv' | 'pdf' | 'excel', dataType: 'invoices' | 'expenses' | 'reports' | 'dashboard', recordCount: number) => {
    trackExportEvent(exportType, dataType, recordCount);
  }, []);

  const trackDocumentDownload = useCallback((documentType: 'invoice' | 'receipt' | 'report' | 'export', documentId: string, fileSize?: number) => {
    trackDocumentEvent('downloaded', documentType, fileSize);
    trackEvent('document_downloaded', {
      document_id: documentId,
      document_type: documentType,
      file_size: fileSize,
      timestamp: new Date().toISOString()
    });
  }, []);

  const trackDocumentUpload = useCallback((documentType: 'invoice' | 'receipt' | 'report' | 'export', fileSize: number, uploadDuration?: number) => {
    trackDocumentEvent('uploaded', documentType, fileSize);
    if (uploadDuration) {
      trackPerformance('document_upload', uploadDuration, true, {
        document_type: documentType,
        file_size: fileSize
      });
    }
  }, []);

  return {
    trackDataExport,
    trackDocumentDownload,
    trackDocumentUpload
  };
};

// Hook for tracking dashboard interactions
export const useDashboardTracking = () => {
  const trackWidgetInteraction = useCallback((widgetName: string, action: 'viewed' | 'filtered' | 'exported' | 'drilled_down', filters?: Record<string, any>) => {
    trackDashboardInteraction(widgetName, action, filters);
  }, []);

  const trackDashboardFilter = useCallback((filterType: string, filterValue: string | string[], widgetsAffected: string[]) => {
    trackEvent('dashboard_filtered', {
      filter_type: filterType,
      filter_value: filterValue,
      widgets_affected: widgetsAffected,
      timestamp: new Date().toISOString()
    });
  }, []);

  const trackDashboardRefresh = useCallback((refreshType: 'manual' | 'auto' | 'real_time', widgetsRefreshed: string[]) => {
    trackEvent('dashboard_refreshed', {
      refresh_type: refreshType,
      widgets_refreshed: widgetsRefreshed,
      timestamp: new Date().toISOString()
    });
  }, []);

  return {
    trackWidgetInteraction,
    trackDashboardFilter,
    trackDashboardRefresh
  };
};

// Hook for tracking navigation patterns
export const useNavigationTracking = () => {
  const previousPageRef = useRef<string>('');

  const trackPageNavigation = useCallback((toPage: string, method: 'click' | 'url' | 'redirect' = 'click') => {
    const fromPage = previousPageRef.current || window.location.pathname;
    trackNavigation(fromPage, toPage, method);
    previousPageRef.current = toPage;
  }, []);

  const trackBreadcrumbClick = useCallback((breadcrumbText: string, position: number, totalBreadcrumbs: number) => {
    trackEvent('breadcrumb_clicked', {
      breadcrumb_text: breadcrumbText,
      position,
      total_breadcrumbs: totalBreadcrumbs,
      timestamp: new Date().toISOString()
    });
  }, []);

  const trackMenuClick = useCallback((menuItem: string, menuType: 'sidebar' | 'header' | 'dropdown' | 'context') => {
    trackEvent('menu_clicked', {
      menu_item: menuItem,
      menu_type: menuType,
      timestamp: new Date().toISOString()
    });
  }, []);

  return {
    trackPageNavigation,
    trackBreadcrumbClick,
    trackMenuClick
  };
};

// Hook for tracking errors with context
export const useErrorTracking = () => {
  const trackApiError = useCallback((endpoint: string, status: number, errorMessage: string, requestData?: any) => {
    trackError('api', errorMessage, {
      endpoint,
      status_code: status,
      request_data: requestData ? JSON.stringify(requestData) : undefined
    });
  }, []);

  const trackValidationError = useCallback((formName: string, fieldName: string, errorMessage: string) => {
    trackError('validation', errorMessage, {
      form: formName,
      field: fieldName
    });
  }, []);

  const trackJavaScriptError = useCallback((errorMessage: string, fileName?: string, lineNumber?: number) => {
    trackError('general', errorMessage, {
      file_name: fileName,
      line_number: lineNumber,
      stack_trace: new Error().stack
    });
  }, []);

  return {
    trackApiError,
    trackValidationError,
    trackJavaScriptError
  };
};

// Combined hook for comprehensive tracking
export const useAnalytics = (pageName?: string) => {
  const featureTracking = useFeatureTracking();
  const businessTracking = useBusinessTracking();
  const searchTracking = useSearchTracking();
  const exportTracking = useExportTracking();
  const dashboardTracking = useDashboardTracking();
  const navigationTracking = useNavigationTracking();
  const errorTracking = useErrorTracking();

  // Auto-track page if pageName provided
  usePageTracking(pageName || '', {});

  return {
    ...featureTracking,
    ...businessTracking,
    ...searchTracking,
    ...exportTracking,
    ...dashboardTracking,
    ...navigationTracking,
    ...errorTracking,

    // Direct access to tracking functions
    trackEvent,
    trackFeatureUsage,
    trackNavigation,
    trackFormInteraction,
    trackError,
    trackPerformance,
    trackBusinessEvent,
    trackOnboardingStep
  };
};