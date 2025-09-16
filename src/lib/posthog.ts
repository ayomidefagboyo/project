import posthog from 'posthog-js';

// Initialize PostHog
export const initPostHog = () => {
  const posthogApiKey = import.meta.env.VITE_POSTHOG_API_KEY;
  const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

  if (posthogApiKey) {
    try {
      posthog.init(posthogApiKey, {
        api_host: posthogHost,
        loaded: (posthog) => {
          if (import.meta.env.DEV) {
            console.log('PostHog loaded successfully');
          }
        },
      // Enable session recordings for better user insights
      session_recording: {
        // Record only on production to avoid dev noise
        maskAllInputs: true,
        maskInputOptions: {
          password: true,
          email: false,
          tel: true,
        }
      },
      // Capture pageviews automatically
      capture_pageview: true,
      // Respect user privacy
      respect_dnt: true,
      // Persist user identity across sessions
      persistence: 'localStorage+cookie',
      // Custom configuration for SaaS application
      autocapture: {
        // Capture form submissions for conversion tracking
        css_selector_allowlist: [
          '[data-track]',
          'button[type="submit"]',
          'form',
          '.btn-primary',
          '.cta-button'
        ]
      },
      // Feature flags for A/B testing
      bootstrap: {
        featureFlags: {},
      }
    });

      // Enable debug mode in development
      if (import.meta.env.DEV) {
        posthog.debug(true);
      }
    } catch (error) {
      console.error('Failed to initialize PostHog:', error);
    }
  } else if (import.meta.env.DEV) {
    console.warn('PostHog API key not found. Analytics tracking is disabled.');
  }
};

// Track custom events
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (posthog.__loaded) {
    posthog.capture(eventName, properties);
  }
};

// Identify user for personalized analytics
export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  if (posthog.__loaded) {
    posthog.identify(userId, traits);
  }
};

// Track page views manually if needed
export const trackPageView = (pageName?: string, properties?: Record<string, any>) => {
  if (posthog.__loaded) {
    posthog.capture('$pageview', {
      $current_url: window.location.href,
      page_name: pageName,
      ...properties
    });
  }
};

// Set user properties
export const setUserProperties = (properties: Record<string, any>) => {
  if (posthog.__loaded) {
    posthog.people.set(properties);
  }
};

// Track conversion events
export const trackConversion = (conversionType: string, value?: number, properties?: Record<string, any>) => {
  if (posthog.__loaded) {
    posthog.capture('conversion', {
      conversion_type: conversionType,
      value,
      ...properties
    });
  }
};

// Track trial events specifically
export const trackTrialEvent = (action: 'started' | 'expired' | 'upgraded' | 'cancelled', planId?: string, daysRemaining?: number) => {
  trackEvent(`trial_${action}`, {
    plan_id: planId,
    days_remaining: daysRemaining,
    timestamp: new Date().toISOString()
  });
};

// Track subscription events
export const trackSubscriptionEvent = (action: 'created' | 'updated' | 'cancelled' | 'payment_failed', planId: string, value?: number) => {
  trackEvent(`subscription_${action}`, {
    plan_id: planId,
    value,
    timestamp: new Date().toISOString()
  });
};

// Track user journey events
export const trackUserJourney = (stage: 'landing' | 'signup' | 'onboarding' | 'dashboard' | 'upgrade', properties?: Record<string, any>) => {
  trackEvent(`user_journey_${stage}`, {
    ...properties,
    timestamp: new Date().toISOString()
  });
};

// === EXPANDED CUSTOM EVENTS AND UTILITIES ===

// Feature Usage Tracking
export const trackFeatureUsage = (featureName: string, action: 'viewed' | 'used' | 'completed', properties?: Record<string, any>) => {
  trackEvent(`feature_${action}`, {
    feature_name: featureName,
    ...properties,
    timestamp: new Date().toISOString()
  });
};

// Navigation Tracking
export const trackNavigation = (from: string, to: string, method: 'click' | 'url' | 'redirect' = 'click') => {
  trackEvent('navigation', {
    from_page: from,
    to_page: to,
    navigation_method: method,
    timestamp: new Date().toISOString()
  });
};

// Form Interaction Tracking
export const trackFormInteraction = (formName: string, action: 'started' | 'completed' | 'abandoned', fieldCount?: number, properties?: Record<string, any>) => {
  trackEvent(`form_${action}`, {
    form_name: formName,
    field_count: fieldCount,
    ...properties,
    timestamp: new Date().toISOString()
  });
};

// Error Tracking
export const trackError = (errorType: 'api' | 'validation' | 'payment' | 'auth' | 'general', errorMessage: string, context?: Record<string, any>) => {
  trackEvent('error_occurred', {
    error_type: errorType,
    error_message: errorMessage,
    ...context,
    timestamp: new Date().toISOString()
  });
};

// Performance Tracking
export const trackPerformance = (actionName: string, duration: number, success: boolean, properties?: Record<string, any>) => {
  trackEvent('performance_metric', {
    action_name: actionName,
    duration_ms: duration,
    success,
    ...properties,
    timestamp: new Date().toISOString()
  });
};

// Business Intelligence Events
export const trackBusinessEvent = (eventType: 'invoice_created' | 'expense_added' | 'report_generated' | 'vendor_added' | 'payment_processed', value?: number, properties?: Record<string, any>) => {
  trackEvent(`business_${eventType}`, {
    value,
    ...properties,
    timestamp: new Date().toISOString()
  });
};

// Onboarding Flow Tracking
export const trackOnboardingStep = (stepName: string, stepNumber: number, action: 'started' | 'completed' | 'skipped', properties?: Record<string, any>) => {
  trackEvent(`onboarding_${action}`, {
    step_name: stepName,
    step_number: stepNumber,
    ...properties,
    timestamp: new Date().toISOString()
  });
};

// Search and Discovery
export const trackSearch = (searchTerm: string, resultCount: number, searchType: 'invoices' | 'vendors' | 'expenses' | 'reports' = 'invoices') => {
  trackEvent('search_performed', {
    search_term: searchTerm,
    result_count: resultCount,
    search_type: searchType,
    timestamp: new Date().toISOString()
  });
};

// File and Document Events
export const trackDocumentEvent = (action: 'uploaded' | 'downloaded' | 'viewed' | 'deleted', documentType: 'invoice' | 'receipt' | 'report' | 'export', size?: number) => {
  trackEvent(`document_${action}`, {
    document_type: documentType,
    file_size_bytes: size,
    timestamp: new Date().toISOString()
  });
};

// Integration and API Events
export const trackIntegration = (integrationType: 'stripe' | 'email' | 'export' | 'oauth', action: 'connected' | 'disconnected' | 'used' | 'failed', properties?: Record<string, any>) => {
  trackEvent(`integration_${action}`, {
    integration_type: integrationType,
    ...properties,
    timestamp: new Date().toISOString()
  });
};

// User Settings and Preferences
export const trackSettingsChange = (settingCategory: 'profile' | 'billing' | 'notifications' | 'security' | 'preferences', settingName: string, newValue: string | number | boolean) => {
  trackEvent('settings_changed', {
    category: settingCategory,
    setting_name: settingName,
    new_value: newValue,
    timestamp: new Date().toISOString()
  });
};

// Dashboard and Analytics Events
export const trackDashboardInteraction = (widgetName: string, action: 'viewed' | 'filtered' | 'exported' | 'drilled_down', filters?: Record<string, any>) => {
  trackEvent('dashboard_interaction', {
    widget_name: widgetName,
    action,
    filters,
    timestamp: new Date().toISOString()
  });
};

// Collaboration Events
export const trackCollaboration = (action: 'invited_user' | 'user_joined' | 'permission_granted' | 'shared_report', targetUserId?: string, properties?: Record<string, any>) => {
  trackEvent(`collaboration_${action}`, {
    target_user_id: targetUserId,
    ...properties,
    timestamp: new Date().toISOString()
  });
};

// Support and Help Events
export const trackSupportEvent = (action: 'help_viewed' | 'tutorial_started' | 'tutorial_completed' | 'support_contacted', helpTopic?: string) => {
  trackEvent(`support_${action}`, {
    help_topic: helpTopic,
    timestamp: new Date().toISOString()
  });
};

// Mobile and Device Events
export const trackDeviceInfo = () => {
  const deviceInfo = {
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    user_agent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    is_mobile: /Mobi|Android/i.test(navigator.userAgent),
    is_tablet: /Tablet|iPad/i.test(navigator.userAgent),
    timestamp: new Date().toISOString()
  };

  setUserProperties(deviceInfo);
  trackEvent('device_info_captured', deviceInfo);
};

// Session and Engagement
export const trackSessionEvent = (action: 'session_start' | 'session_end' | 'idle_start' | 'idle_end' | 'focus_gained' | 'focus_lost') => {
  trackEvent(`session_${action}`, {
    url: window.location.href,
    timestamp: new Date().toISOString()
  });
};

// A/B Testing and Experiments
export const trackExperiment = (experimentName: string, variant: string, action: 'viewed' | 'converted' | 'completed') => {
  trackEvent(`experiment_${action}`, {
    experiment_name: experimentName,
    variant,
    timestamp: new Date().toISOString()
  });
};

// Custom Business Metrics
export const trackBusinessMetric = (metricName: string, value: number, unit: string, properties?: Record<string, any>) => {
  trackEvent('business_metric', {
    metric_name: metricName,
    value,
    unit,
    ...properties,
    timestamp: new Date().toISOString()
  });
};

// Notification Events
export const trackNotification = (action: 'sent' | 'opened' | 'clicked' | 'dismissed', notificationType: 'email' | 'push' | 'in_app', properties?: Record<string, any>) => {
  trackEvent(`notification_${action}`, {
    notification_type: notificationType,
    ...properties,
    timestamp: new Date().toISOString()
  });
};

// Export and Reporting Events
export const trackExportEvent = (exportType: 'csv' | 'pdf' | 'excel', dataType: 'invoices' | 'expenses' | 'reports' | 'dashboard', recordCount: number) => {
  trackEvent('data_exported', {
    export_type: exportType,
    data_type: dataType,
    record_count: recordCount,
    timestamp: new Date().toISOString()
  });
};

// Time-based Events (for engagement analysis)
export const trackTimeSpent = (pageName: string, timeSpent: number, engagementLevel: 'low' | 'medium' | 'high') => {
  trackEvent('time_spent', {
    page_name: pageName,
    time_spent_seconds: timeSpent,
    engagement_level: engagementLevel,
    timestamp: new Date().toISOString()
  });
};

// Batch Event Tracking (for multiple related events)
export const trackEventBatch = (events: Array<{name: string, properties?: Record<string, any>}>) => {
  events.forEach(event => {
    trackEvent(event.name, {
      ...event.properties,
      batch_timestamp: new Date().toISOString()
    });
  });
};

export default posthog;