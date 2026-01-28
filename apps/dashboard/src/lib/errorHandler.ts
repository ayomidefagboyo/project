import React from 'react';

/**
 * Error handling utilities for API responses
 */

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: any;
  timestamp?: string;
}

export interface ErrorContext {
  operation: string;
  endpoint?: string;
  method?: string;
  data?: any;
  userId?: string;
  outletId?: string;
}

export class ErrorHandler {
  /**
   * Handle API errors with proper logging and user-friendly messages
   */
  static handleApiError(
    error: any,
    context: ErrorContext,
    fallbackMessage: string = 'An unexpected error occurred'
  ): ApiError {
    console.error(`API Error in ${context.operation}:`, {
      error,
      context,
      timestamp: new Date().toISOString()
    });

    // Network errors
    if (error.status === 0 || !error.status) {
      return {
        message: 'Network error. Please check your connection and try again.',
        status: 0,
        code: 'NETWORK_ERROR',
        timestamp: new Date().toISOString()
      };
    }

    // Authentication errors
    if (error.status === 401) {
      return {
        message: 'Your session has expired. Please sign in again.',
        status: 401,
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString()
      };
    }

    // Forbidden errors
    if (error.status === 403) {
      return {
        message: 'You do not have permission to perform this action.',
        status: 403,
        code: 'FORBIDDEN',
        timestamp: new Date().toISOString()
      };
    }

    // Not found errors
    if (error.status === 404) {
      return {
        message: 'The requested resource was not found.',
        status: 404,
        code: 'NOT_FOUND',
        timestamp: new Date().toISOString()
      };
    }

    // Validation errors
    if (error.status === 422) {
      const validationErrors = this.extractValidationErrors(error.details);
      return {
        message: validationErrors.length > 0 
          ? `Validation failed: ${validationErrors.join(', ')}`
          : 'Please check your input and try again.',
        status: 422,
        code: 'VALIDATION_ERROR',
        details: error.details,
        timestamp: new Date().toISOString()
      };
    }

    // Server errors
    if (error.status >= 500) {
      return {
        message: 'Server error. Please try again later or contact support.',
        status: error.status,
        code: 'SERVER_ERROR',
        timestamp: new Date().toISOString()
      };
    }

    // Default error handling
    return {
      message: error.message || fallbackMessage,
      status: error.status || 500,
      code: error.code || 'UNKNOWN_ERROR',
      details: error.details,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract validation errors from API response
   */
  private static extractValidationErrors(details: any): string[] {
    if (!details) return [];

    const errors: string[] = [];

    if (Array.isArray(details)) {
      details.forEach((error: any) => {
        if (error.msg) {
          errors.push(error.msg);
        } else if (error.message) {
          errors.push(error.message);
        }
      });
    } else if (typeof details === 'object') {
      Object.entries(details).forEach(([field, messages]) => {
        if (Array.isArray(messages)) {
          messages.forEach((msg: any) => {
            errors.push(`${field}: ${msg}`);
          });
        } else {
          errors.push(`${field}: ${messages}`);
        }
      });
    }

    return errors;
  }

  /**
   * Get user-friendly error message
   */
  static getUserFriendlyMessage(error: ApiError): string {
    // Common error messages
    const commonMessages: Record<string, string> = {
      'NETWORK_ERROR': 'Please check your internet connection and try again.',
      'UNAUTHORIZED': 'Your session has expired. Please sign in again.',
      'FORBIDDEN': 'You do not have permission to perform this action.',
      'NOT_FOUND': 'The requested item was not found.',
      'VALIDATION_ERROR': 'Please check your input and try again.',
      'SERVER_ERROR': 'Something went wrong on our end. Please try again later.',
      'TIMEOUT': 'The request timed out. Please try again.',
      'RATE_LIMITED': 'Too many requests. Please wait a moment and try again.'
    };

    return commonMessages[error.code || ''] || error.message || 'An unexpected error occurred';
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: ApiError): boolean {
    const retryableCodes = ['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR'];
    const retryableStatuses = [0, 408, 429, 500, 502, 503, 504];

    return retryableCodes.includes(error.code || '') || 
           retryableStatuses.includes(error.status);
  }

  /**
   * Get retry delay in milliseconds
   */
  static getRetryDelay(attempt: number, baseDelay: number = 1000): number {
    // Exponential backoff with jitter
    const delay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * delay;
    return Math.min(delay + jitter, 30000); // Max 30 seconds
  }

  /**
   * Log error for monitoring
   */
  static logError(error: ApiError, context: ErrorContext): void {
    // In production, this would send to a monitoring service
    console.error('Error logged:', {
      error,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });
  }

  /**
   * Handle authentication errors
   */
  static handleAuthError(error: ApiError): void {
    if (error.status === 401) {
      // Clear stored token
      localStorage.removeItem('auth_token');
      
      // Redirect to login
      window.location.href = '/login';
    }
  }

  /**
   * Create error boundary for React components
   */
  static createErrorBoundary(componentName: string) {
    return (error: Error, errorInfo: any) => {
      console.error(`Error in ${componentName}:`, {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString()
      });
    };
  }
}

/**
 * Hook for handling API errors in React components
 */
export const useErrorHandler = () => {
  const [error, setError] = React.useState<string | null>(null);

  const clearError = () => {
    setError(null);
  };

  const handleError = (
    error: any,
    context: ErrorContext,
    fallbackMessage?: string
  ): ApiError => {
    const apiError = ErrorHandler.handleApiError(error, context, fallbackMessage);
    
    // Set error state for UI display
    setError(apiError.message);
    
    // Log error
    ErrorHandler.logError(apiError, context);
    
    // Handle auth errors
    if (apiError.status === 401) {
      ErrorHandler.handleAuthError(apiError);
    }
    
    return apiError;
  };

  const getUserFriendlyMessage = (error: ApiError): string => {
    return ErrorHandler.getUserFriendlyMessage(error);
  };

  const isRetryable = (error: ApiError): boolean => {
    return ErrorHandler.isRetryable(error);
  };

  return {
    error,
    setError,
    clearError,
    handleError,
    getUserFriendlyMessage,
    isRetryable
  };
};

/**
 * Retry utility for failed API calls
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      const apiError = ErrorHandler.handleApiError(
        error,
        { operation: 'retry_operation' },
        'Operation failed'
      );

      if (!ErrorHandler.isRetryable(apiError) || attempt === maxRetries) {
        throw error;
      }

      const delay = ErrorHandler.getRetryDelay(attempt, baseDelay);
      console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

export default ErrorHandler;



