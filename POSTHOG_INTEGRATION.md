# PostHog Analytics Integration

This document outlines the PostHog analytics integration implemented in Compazz for comprehensive user behavior tracking and conversion optimization.

## 📊 Overview

PostHog is integrated to track key user journey events, trial conversions, subscription management, and feature usage across the entire SaaS application.

## 🚀 Setup

### 1. Environment Variables

Add these variables to your `.env` file:

```bash
VITE_POSTHOG_API_KEY=your_posthog_api_key_here
VITE_POSTHOG_HOST=https://app.posthog.com
```

### 2. PostHog Project Configuration

In your PostHog project:
- Enable session recordings for better user insights
- Set up feature flags for A/B testing
- Configure conversion goals for trial-to-paid tracking

## 📈 Events Tracked

### Core User Journey Events

1. **Landing Page Visits**
   - Event: `user_journey_landing`
   - Properties: `path`, `search`, `referrer`

2. **CTA Clicks**
   - Event: `cta_clicked`
   - Properties: `plan_id`, `cta_location`, `is_annual`, `currency`

3. **User Signup**
   - Event: `user_signup`
   - Properties: `user_id`, `company_name`, `has_trial`, `selected_plan`, `signup_method`

4. **Dashboard Access**
   - Event: `user_journey_dashboard`
   - Properties: `user_id`, `accessible_outlets_count`, `can_view_all`, `is_business_owner`

### Trial Management Events

1. **Trial Started**
   - Event: `trial_started`
   - Properties: `plan_id`, `timestamp`

2. **Trial Expired**
   - Event: `trial_expired`
   - Properties: `plan_id`, `days_remaining`, `timestamp`

3. **Trial Upgraded**
   - Event: `trial_upgraded`
   - Properties: `plan_id`, `days_remaining`, `timestamp`

4. **Trial Start Failed**
   - Event: `trial_start_failed`
   - Properties: `user_id`, `plan_id`, `error`

### Subscription Events

1. **Subscription Created**
   - Event: `subscription_created`
   - Properties: `plan_id`, `value`, `timestamp`

2. **Upgrade Attempt**
   - Event: `upgrade_attempt`
   - Properties: `plan_id`, `days_remaining`, `is_expired`, `current_plan`

## 👤 User Identification

User identification happens automatically upon successful signup:

```typescript
identifyUser(user.id, {
  name: formData.name,
  email: formData.email,
  company_name: formData.companyName,
  signup_date: new Date().toISOString(),
  is_trial: isTrial,
  plan_id: selectedPlan
});
```

## 🔧 Technical Implementation

### Key Files

- `src/lib/posthog.ts` - PostHog configuration and utility functions (**EXPANDED**)
- `src/hooks/useAnalytics.ts` - React hooks for easy analytics integration (**NEW**)
- `src/examples/AnalyticsUsageExamples.tsx` - Comprehensive usage examples (**NEW**)
- `src/App.tsx` - PostHog initialization with session tracking
- `src/pages/LandingPage.tsx` - Landing page and CTA tracking
- `src/components/auth/OwnerSignupForm.tsx` - Signup flow tracking with performance metrics
- `src/pages/Dashboard.tsx` - Dashboard usage tracking with device info
- `src/components/TrialExpired.tsx` - Trial conversion tracking

### Utility Functions

#### Core Event Tracking
```typescript
// Track custom events
trackEvent(eventName: string, properties?: Record<string, any>)

// Track user journey stages
trackUserJourney(stage: 'landing' | 'signup' | 'onboarding' | 'dashboard' | 'upgrade', properties?)

// Track trial-specific events
trackTrialEvent(action: 'started' | 'expired' | 'upgraded' | 'cancelled', planId?, daysRemaining?)

// Track subscription events
trackSubscriptionEvent(action: 'created' | 'updated' | 'cancelled' | 'payment_failed', planId, value?)
```

#### Extended Event Tracking Functions
```typescript
// Feature Usage Tracking
trackFeatureUsage(featureName: string, action: 'viewed' | 'used' | 'completed', properties?)

// Navigation Tracking
trackNavigation(from: string, to: string, method: 'click' | 'url' | 'redirect')

// Form Interaction Tracking
trackFormInteraction(formName: string, action: 'started' | 'completed' | 'abandoned', fieldCount?, properties?)

// Error Tracking
trackError(errorType: 'api' | 'validation' | 'payment' | 'auth' | 'general', errorMessage: string, context?)

// Performance Tracking
trackPerformance(actionName: string, duration: number, success: boolean, properties?)

// Business Intelligence Events
trackBusinessEvent(eventType: 'invoice_created' | 'expense_added' | 'report_generated' | 'vendor_added' | 'payment_processed', value?, properties?)

// Search and Discovery
trackSearch(searchTerm: string, resultCount: number, searchType: 'invoices' | 'vendors' | 'expenses' | 'reports')

// Document Events
trackDocumentEvent(action: 'uploaded' | 'downloaded' | 'viewed' | 'deleted', documentType: 'invoice' | 'receipt' | 'report' | 'export', size?)

// Dashboard Interactions
trackDashboardInteraction(widgetName: string, action: 'viewed' | 'filtered' | 'exported' | 'drilled_down', filters?)

// Settings Changes
trackSettingsChange(settingCategory: 'profile' | 'billing' | 'notifications' | 'security' | 'preferences', settingName: string, newValue: any)

// Export Events
trackExportEvent(exportType: 'csv' | 'pdf' | 'excel', dataType: 'invoices' | 'expenses' | 'reports' | 'dashboard', recordCount: number)

// Time Tracking
trackTimeSpent(pageName: string, timeSpent: number, engagementLevel: 'low' | 'medium' | 'high')

// Device Information
trackDeviceInfo() // Automatically captures device and browser details

// Session Events
trackSessionEvent(action: 'session_start' | 'session_end' | 'idle_start' | 'idle_end' | 'focus_gained' | 'focus_lost')

// Business Metrics
trackBusinessMetric(metricName: string, value: number, unit: string, properties?)

// Batch Events
trackEventBatch(events: Array<{name: string, properties?: Record<string, any>}>)
```

#### React Hooks for Easy Integration
```typescript
// Comprehensive analytics hook
const analytics = useAnalytics('page_name')

// Automatic page tracking with time spent
usePageTracking('page_name', properties?)

// Form interaction tracking
const { trackFormStart, trackFormComplete, trackFormAbandon, trackFormError } = useFormTracking('form_name')

// Feature usage tracking
const { trackFeature, trackFeatureClick, trackFeatureView } = useFeatureTracking()

// Business event tracking
const { trackInvoiceCreated, trackExpenseAdded, trackVendorAdded, trackReportGenerated, trackPaymentProcessed } = useBusinessTracking()

// Search interaction tracking
const { trackSearchQuery, trackSearchFilter, trackSearchSort } = useSearchTracking()

// Export and download tracking
const { trackDataExport, trackDocumentDownload, trackDocumentUpload } = useExportTracking()

// Dashboard interaction tracking
const { trackWidgetInteraction, trackDashboardFilter, trackDashboardRefresh } = useDashboardTracking()

// Navigation tracking
const { trackPageNavigation, trackBreadcrumbClick, trackMenuClick } = useNavigationTracking()

// Error tracking
const { trackApiError, trackValidationError, trackJavaScriptError } = useErrorTracking()
```

## 📊 Analytics Dashboards

### Key Metrics to Monitor

1. **Conversion Funnel**
   - Landing page visits → Signups → Trial starts → Paid conversions

2. **Trial Performance**
   - Trial completion rate
   - Days to conversion
   - Plan selection preferences

3. **User Engagement**
   - Dashboard usage patterns
   - Feature adoption rates
   - Session duration and frequency

4. **Revenue Analytics**
   - Monthly recurring revenue (MRR)
   - Customer lifetime value (CLV)
   - Churn rate by cohort

### Recommended PostHog Insights

1. **Conversion Rate by Plan**
   ```sql
   SELECT properties.plan_id,
          COUNT(*) as signups,
          COUNT(CASE WHEN events.event = 'subscription_created' THEN 1 END) as conversions
   FROM events
   WHERE event IN ('user_signup', 'subscription_created')
   GROUP BY properties.plan_id
   ```

2. **Trial-to-Paid Conversion Timeline**
   - Track time between `trial_started` and `trial_upgraded` events
   - Identify optimal trial length and intervention points

3. **Feature Usage Correlation**
   - Correlate dashboard feature usage with conversion likelihood
   - Identify high-value features for onboarding focus

## 🔒 Privacy Considerations

- **GDPR Compliance**: PostHog is GDPR-compliant with data processing agreements
- **Data Masking**: Sensitive form inputs are automatically masked in session recordings
- **User Consent**: Respects "Do Not Track" browser settings
- **Data Retention**: Configure appropriate data retention policies in PostHog settings

## 🚨 Error Handling

The integration includes comprehensive error handling:

- Graceful degradation when PostHog is unavailable
- Console warnings in development when API key is missing
- No blocking of user experience if analytics fail

## 🔍 Debugging

### Development Mode

- PostHog debug mode is automatically enabled in development
- Console logs show all tracked events and properties
- Session recordings are disabled in development to avoid noise

### Verification

1. Check browser developer tools for PostHog network requests
2. Verify events appear in PostHog's Live Events feed
3. Test user identification in PostHog's Persons tab

## 📋 Next Steps

1. **Set up PostHog project** with the provided API key
2. **Configure conversion goals** for trial-to-paid tracking
3. **Create dashboards** for key metrics monitoring
4. **Set up alerts** for significant conversion rate changes
5. **Implement A/B tests** using PostHog feature flags

## 🤝 Support

- PostHog Documentation: https://posthog.com/docs
- PostHog Community: https://posthog.com/slack
- Integration Issues: Check browser console and PostHog debug logs