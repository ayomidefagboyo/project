# Frontend-Backend Integration Migration Guide

This guide explains how to migrate from direct Supabase calls to the new FastAPI backend integration.

## 🚀 Quick Start

### 1. Environment Setup

Copy the environment template and configure your FastAPI backend URL:

```bash
cp .env.example .env
```

Update `.env` with your FastAPI backend URL:
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### 2. Import New Services

Replace old service imports with new ones:

```typescript
// OLD - Direct Supabase
import { supabase } from './lib/supabase';
import { vendorService } from './lib/vendorService';

// NEW - FastAPI Backend
import { vendorService, authService, paymentService } from './lib/services';
```

## 📋 Service Migration

### Authentication Service

```typescript
// OLD
import { authService } from './lib/auth';

// NEW
import { authService } from './lib/services';

// Usage remains the same
const result = await authService.signIn(credentials);
```

### Vendor Service

```typescript
// OLD
import { vendorService } from './lib/vendorService';

// NEW
import { vendorService } from './lib/services';

// Usage remains the same
const vendors = await vendorService.getVendors(outletId);
```

### Payment Service

```typescript
// OLD
import { paymentService } from './lib/paymentService';

// NEW
import { paymentService } from './lib/services';

// Usage remains the same
const payments = await paymentService.getPayments(outletId);
```

### EOD Service

```typescript
// OLD
import { eodService } from './lib/eodService';

// NEW
import { eodService } from './lib/services';

// Usage remains the same
const reports = await eodService.getEODReports();
```

### OCR Service

```typescript
// OLD
import { ocrService } from './lib/ocrService';

// NEW
import { ocrService } from './lib/services';

// Usage remains the same
const result = await ocrService.uploadAndProcessFile(file);
```

### Anomaly Service

```typescript
// NEW - No old service exists
import { anomalyService } from './lib/services';

// Usage
const anomalies = await anomalyService.getAnomalies();
```

## 🔧 Component Updates

### 1. Add Error Handling

```typescript
import { useErrorHandler, ErrorMessage } from './lib/services';

const MyComponent = () => {
  const { handleError, getUserFriendlyMessage } = useErrorHandler();
  const [error, setError] = useState<string | null>(null);

  const handleApiCall = async () => {
    try {
      const result = await vendorService.getVendors(outletId);
      // Handle success
    } catch (error) {
      const apiError = handleError(error, { operation: 'getVendors' });
      setError(getUserFriendlyMessage(apiError));
    }
  };

  return (
    <div>
      {error && <ErrorMessage error={error} onDismiss={() => setError(null)} />}
      {/* Rest of component */}
    </div>
  );
};
```

### 2. Add Loading States

```typescript
import { useLoadingState, LoadingSpinner } from './lib/services';

const MyComponent = () => {
  const { isLoading, setLoading, error, setError } = useLoadingState();

  const handleApiCall = async () => {
    setLoading(true);
    try {
      const result = await vendorService.getVendors(outletId);
      // Handle success
    } catch (error) {
      setError('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading vendors..." />;
  }

  return (
    <div>
      {/* Component content */}
    </div>
  );
};
```

### 3. Add Form Submission Handling

```typescript
import { useFormSubmission, SuccessMessage } from './lib/services';

const MyForm = () => {
  const { isSubmitting, submitError, submitSuccess, submit } = useFormSubmission();

  const handleSubmit = async (formData) => {
    await submit(
      () => vendorService.createVendor(formData),
      {
        onSuccess: () => {
          // Handle success
        },
        onError: (error) => {
          // Handle error
        }
      }
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      {submitError && <ErrorMessage error={submitError} />}
      {submitSuccess && <SuccessMessage message="Vendor created successfully!" />}
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Vendor'}
      </button>
    </form>
  );
};
```

## 🔄 Migration Steps

### Step 1: Update Imports

1. Replace all service imports with new ones from `./lib/services`
2. Add error handling and loading state imports where needed

### Step 2: Add Error Handling

1. Import `useErrorHandler` and `ErrorMessage` component
2. Wrap API calls with try-catch blocks
3. Display user-friendly error messages

### Step 3: Add Loading States

1. Import `useLoadingState` and `LoadingSpinner` component
2. Add loading states to async operations
3. Show loading indicators during API calls

### Step 4: Test Integration

1. Start your FastAPI backend
2. Update environment variables
3. Test all functionality

## 🎯 Key Benefits

- **Centralized API Management**: All API calls go through a single client
- **Better Error Handling**: Consistent error handling across the app
- **Loading States**: Built-in loading state management
- **Type Safety**: Full TypeScript support for all API responses
- **Retry Logic**: Automatic retry for failed requests
- **Authentication**: Automatic JWT token handling

## 🚨 Breaking Changes

1. **Service Imports**: Must use new service imports
2. **Error Handling**: Old error handling patterns need updating
3. **Loading States**: Need to add loading state management
4. **Environment Variables**: Need to configure FastAPI backend URL

## 📚 API Endpoints

The new services connect to these FastAPI endpoints:

- **Authentication**: `/auth/*`
- **Vendors**: `/vendors/*`
- **Payments**: `/payments/*`
- **OCR**: `/ocr/*`
- **EOD Reports**: `/eod/*`
- **Anomalies**: `/anomalies/*`

## 🔍 Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure FastAPI backend has CORS configured
2. **Authentication Errors**: Check JWT token handling
3. **Network Errors**: Verify backend URL in environment variables
4. **Type Errors**: Ensure all types are imported correctly

### Debug Mode

Enable debug mode in your environment:
```env
VITE_DEBUG=true
```

This will log all API requests and responses to the console.

## 📞 Support

If you encounter issues during migration:

1. Check the browser console for errors
2. Verify FastAPI backend is running
3. Check environment variable configuration
4. Review the API documentation in FastAPI Swagger UI

## 🎉 Next Steps

After migration:

1. Remove old service files
2. Update tests to use new services
3. Add comprehensive error boundaries
4. Implement offline support
5. Add performance monitoring



