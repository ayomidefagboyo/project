// PostHog disabled for POS - using placeholder implementation
const posthog: any = {
  __loaded: false,
  init: () => {},
  debug: () => {},
  capture: () => {},
  identify: () => {},
  people: { set: () => {} }
};

// Initialize PostHog (disabled for POS)
export const initPostHog = () => {
  console.log('PostHog disabled for POS terminal');
};

// All tracking functions are no-ops for POS
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {};
export const identifyUser = (userId: string, traits?: Record<string, any>) => {};
export const trackPageView = (pageName?: string, properties?: Record<string, any>) => {};
export const setUserProperties = (properties: Record<string, any>) => {};
export const trackConversion = (conversionType: string, value?: number, properties?: Record<string, any>) => {};
export const trackTrialEvent = (action: 'started' | 'expired' | 'upgraded' | 'cancelled', planId?: string, daysRemaining?: number) => {};
export const trackSubscriptionEvent = (action: 'created' | 'updated' | 'cancelled' | 'payment_failed', planId: string, value?: number) => {};
export const trackUserJourney = (stage: 'landing' | 'signup' | 'onboarding' | 'dashboard' | 'upgrade', properties?: Record<string, any>) => {};
export const trackFeatureUsage = (featureName: string, action: 'viewed' | 'used' | 'completed', properties?: Record<string, any>) => {};
export const trackNavigation = (from: string, to: string, method: 'click' | 'url' | 'redirect' = 'click') => {};
export const trackFormInteraction = (formName: string, action: 'started' | 'completed' | 'abandoned', fieldCount?: number, properties?: Record<string, any>) => {};
export const trackError = (errorType: 'api' | 'validation' | 'payment' | 'auth' | 'general', errorMessage: string, context?: Record<string, any>) => {};
export const trackPerformance = (actionName: string, duration: number, success: boolean, properties?: Record<string, any>) => {};
export const trackBusinessEvent = (eventType: 'invoice_created' | 'expense_added' | 'report_generated' | 'vendor_added' | 'payment_processed', value?: number, properties?: Record<string, any>) => {};
export const trackOnboardingStep = (stepName: string, stepNumber: number, action: 'started' | 'completed' | 'skipped', properties?: Record<string, any>) => {};
export const trackSearch = (searchTerm: string, resultCount: number, searchType: 'invoices' | 'vendors' | 'expenses' | 'reports' = 'invoices') => {};
export const trackDocumentEvent = (action: 'uploaded' | 'downloaded' | 'viewed' | 'deleted', documentType: 'invoice' | 'receipt' | 'report' | 'export', size?: number) => {};
export const trackIntegration = (integrationType: 'stripe' | 'email' | 'export' | 'oauth', action: 'connected' | 'disconnected' | 'used' | 'failed', properties?: Record<string, any>) => {};
export const trackSettingsChange = (settingCategory: 'profile' | 'billing' | 'notifications' | 'security' | 'preferences', settingName: string, newValue: string | number | boolean) => {};
export const trackDashboardInteraction = (widgetName: string, action: 'viewed' | 'filtered' | 'exported' | 'drilled_down', filters?: Record<string, any>) => {};
export const trackCollaboration = (action: 'invited_user' | 'user_joined' | 'permission_granted' | 'shared_report', targetUserId?: string, properties?: Record<string, any>) => {};
export const trackSupportEvent = (action: 'help_viewed' | 'tutorial_started' | 'tutorial_completed' | 'support_contacted', helpTopic?: string) => {};
export const trackDeviceInfo = () => {};
export const trackSessionEvent = (action: 'session_start' | 'session_end' | 'idle_start' | 'idle_end' | 'focus_gained' | 'focus_lost') => {};
export const trackExperiment = (experimentName: string, variant: string, action: 'viewed' | 'converted' | 'completed') => {};
export const trackBusinessMetric = (metricName: string, value: number, unit: string, properties?: Record<string, any>) => {};
export const trackNotification = (action: 'sent' | 'opened' | 'clicked' | 'dismissed', notificationType: 'email' | 'push' | 'in_app', properties?: Record<string, any>) => {};
export const trackExportEvent = (exportType: 'csv' | 'pdf' | 'excel', dataType: 'invoices' | 'expenses' | 'reports' | 'dashboard', recordCount: number) => {};
export const trackTimeSpent = (pageName: string, timeSpent: number, engagementLevel: 'low' | 'medium' | 'high') => {};
export const trackEventBatch = (events: Array<{name: string, properties?: Record<string, any>}>) => {};

export default posthog;