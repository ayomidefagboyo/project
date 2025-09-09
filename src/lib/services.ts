/**
 * Service exports for FastAPI backend integration
 */

// API Client
export { apiClient } from './apiClient';
export type { ApiResponse, ApiError } from './apiClient';

// Authentication Service
export { authService } from './authService';
export type { 
  AuthUser, 
  LoginCredentials, 
  OwnerSignupCredentials, 
  InviteCredentials, 
  AuthResponse, 
  InviteResponse 
} from './authService';

// Vendor Service
export { vendorService } from './vendorServiceNew';
export type { 
  CreateVendorData, 
  UpdateVendorData, 
  VendorResponse, 
  SingleVendorResponse, 
  VendorSearchResponse 
} from './vendorServiceNew';

// Payment Service
export { paymentService } from './paymentServiceNew';
export type { 
  CreatePaymentData, 
  UpdatePaymentData, 
  PaymentResponse, 
  SinglePaymentResponse, 
  PaymentQueueResponse, 
  PaymentStatsResponse, 
  BulkPaymentUpdate 
} from './paymentServiceNew';

// OCR Service
export { ocrService } from './ocrServiceNew';
export type { 
  OCRExtractedData, 
  OCRProcessingRequest, 
  OCRProcessingResponse, 
  FileUploadResponse, 
  OCRStatsResponse 
} from './ocrServiceNew';

// EOD Service
export { eodService } from './eodService';
export type { 
  EODData, 
  EODReconciliation, 
  EODAnalytics, 
  EODResponse, 
  SingleEODResponse, 
  EODAnalyticsResponse 
} from './eodService';

// Anomaly Service
export { anomalyService } from './anomalyServiceNew';
export type { 
  AnomalyCreateData, 
  AnomalyUpdateData, 
  AnomalyResponse, 
  AnomalyListResponse, 
  AnomalyStatsResponse, 
  AnomalyTrendResponse, 
  AnomalyAlert, 
  AnomalyDashboardSummary, 
  AnomalySearchRequest 
} from './anomalyServiceNew';

// Error Handling
export { ErrorHandler, useErrorHandler, withRetry } from './errorHandler';
export type { ApiError, ErrorContext } from './errorHandler';

// Loading States
export {
  useLoadingState,
  useAsyncOperation,
  useMultipleAsyncOperations,
  useFormSubmission,
  usePaginationLoading,
  LoadingSpinner,
  ProgressBar,
  ErrorMessage,
  SuccessMessage
} from './loadingStates';
export type { LoadingState, AsyncOperationState } from './loadingStates';

// Configuration
export { default as config } from './config';
export type { AppConfig } from './config';

// Legacy services (for backward compatibility during migration)
export { dataService } from './dataService';
export { vendorService as legacyVendorService } from './vendorService';
export { paymentService as legacyPaymentService } from './paymentService';
export { eodService as legacyEodService } from './eodService';
export { ocrService as legacyOcrService } from './ocrService';
export { approvalService } from './approvalService';



