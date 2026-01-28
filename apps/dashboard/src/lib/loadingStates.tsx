/**
 * Loading states and user feedback utilities
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  progress?: number;
  message?: string;
}

export interface AsyncOperationState extends LoadingState {
  isSuccess: boolean;
  data: any;
}

/**
 * Hook for managing loading states in React components
 */
export const useLoadingState = (initialState: Partial<LoadingState> = {}) => {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    error: null,
    progress: undefined,
    message: undefined,
    ...initialState
  });

  const setLoading = useCallback((isLoading: boolean, message?: string) => {
    setState(prev => ({
      ...prev,
      isLoading,
      message,
      error: isLoading ? null : prev.error
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({
      ...prev,
      error,
      isLoading: false
    }));
  }, []);

  const setProgress = useCallback((progress: number) => {
    setState(prev => ({
      ...prev,
      progress
    }));
  }, []);

  const setMessage = useCallback((message: string) => {
    setState(prev => ({
      ...prev,
      message
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      progress: undefined,
      message: undefined
    });
  }, []);

  return {
    ...state,
    setLoading,
    setError,
    setProgress,
    setMessage,
    reset
  };
};

/**
 * Hook for managing async operations with loading states
 */
export const useAsyncOperation = <T = any>(initialState: Partial<AsyncOperationState> = {}) => {
  const [state, setState] = useState<AsyncOperationState>({
    isLoading: false,
    error: null,
    isSuccess: false,
    data: null,
    progress: undefined,
    message: undefined,
    ...initialState
  });

  const execute = useCallback(async (
    operation: () => Promise<T>,
    options: {
      onStart?: (message?: string) => void;
      onProgress?: (progress: number) => void;
      onSuccess?: (data: T) => void;
      onError?: (error: string) => void;
      onFinally?: () => void;
    } = {}
  ) => {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        isSuccess: false,
        message: undefined
      }));

      options.onStart?.('Processing...');

      const result = await operation();

      setState(prev => ({
        ...prev,
        isLoading: false,
        isSuccess: true,
        data: result,
        error: null
      }));

      options.onSuccess?.(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        isSuccess: false
      }));

      options.onError?.(errorMessage);
      throw error;
    } finally {
      options.onFinally?.();
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      isSuccess: false,
      data: null,
      progress: undefined,
      message: undefined
    });
  }, []);

  return {
    ...state,
    execute,
    reset
  };
};

/**
 * Hook for managing multiple async operations
 */
export const useMultipleAsyncOperations = () => {
  const [operations, setOperations] = useState<Record<string, AsyncOperationState>>({});

  const executeOperation = useCallback(async <T = any>(
    operationId: string,
    operation: () => Promise<T>,
    options: {
      onStart?: (message?: string) => void;
      onProgress?: (progress: number) => void;
      onSuccess?: (data: T) => void;
      onError?: (error: string) => void;
    } = {}
  ) => {
    try {
      setOperations(prev => ({
        ...prev,
        [operationId]: {
          isLoading: true,
          error: null,
          isSuccess: false,
          data: null,
          message: 'Processing...'
        }
      }));

      options.onStart?.('Processing...');

      const result = await operation();

      setOperations(prev => ({
        ...prev,
        [operationId]: {
          isLoading: false,
          error: null,
          isSuccess: true,
          data: result,
          message: 'Completed successfully'
        }
      }));

      options.onSuccess?.(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      setOperations(prev => ({
        ...prev,
        [operationId]: {
          isLoading: false,
          error: errorMessage,
          isSuccess: false,
          data: null,
          message: 'Failed'
        }
      }));

      options.onError?.(errorMessage);
      throw error;
    }
  }, []);

  const getOperationState = useCallback((operationId: string): AsyncOperationState => {
    return operations[operationId] || {
      isLoading: false,
      error: null,
      isSuccess: false,
      data: null
    };
  }, [operations]);

  const resetOperation = useCallback((operationId: string) => {
    setOperations(prev => {
      const newOps = { ...prev };
      delete newOps[operationId];
      return newOps;
    });
  }, []);

  const resetAllOperations = useCallback(() => {
    setOperations({});
  }, []);

  const isAnyLoading = Object.values(operations).some(op => op.isLoading);
  const hasAnyError = Object.values(operations).some(op => op.error);

  return {
    operations,
    executeOperation,
    getOperationState,
    resetOperation,
    resetAllOperations,
    isAnyLoading,
    hasAnyError
  };
};

/**
 * Hook for managing form submission states
 */
export const useFormSubmission = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const submit = useCallback(async <T = any>(
    submitFunction: () => Promise<T>,
    options: {
      onSuccess?: (data: T) => void;
      onError?: (error: string) => void;
      successMessage?: string;
    } = {}
  ) => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(false);

      const result = await submitFunction();

      setSubmitSuccess(true);
      options.onSuccess?.(result);

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Submission failed';
      setSubmitError(errorMessage);
      options.onError?.(errorMessage);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsSubmitting(false);
    setSubmitError(null);
    setSubmitSuccess(false);
  }, []);

  return {
    isSubmitting,
    submitError,
    submitSuccess,
    submit,
    reset
  };
};

/**
 * Hook for managing pagination loading states
 */
export const usePaginationLoading = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInitial = useCallback(async <T = any>(
    loadFunction: () => Promise<{ data: T[]; hasMore: boolean }>
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await loadFunction();
      setHasMore(result.hasMore);

      return result.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async <T = any>(
    loadFunction: () => Promise<{ data: T[]; hasMore: boolean }>
  ) => {
    if (!hasMore || isLoadingMore) return [];

    try {
      setIsLoadingMore(true);
      setError(null);

      const result = await loadFunction();
      setHasMore(result.hasMore);

      return result.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load more data';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setIsLoadingMore(false);
    setHasMore(true);
    setError(null);
  }, []);

  return {
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadInitial,
    loadMore,
    reset
  };
};

/**
 * Loading spinner component
 */
export const LoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}> = ({ size = 'md', message, className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center space-y-2">
        <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`} />
        {message && (
          <p className="text-sm text-gray-600">{message}</p>
        )}
      </div>
    </div>
  );
};

/**
 * Progress bar component
 */
export const ProgressBar: React.FC<{
  progress: number;
  message?: string;
  className?: string;
}> = ({ progress, message, className = '' }) => {
  return (
    <div className={`w-full ${className}`}>
      {message && (
        <p className="text-sm text-gray-600 mb-2">{message}</p>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">{Math.round(progress)}%</p>
    </div>
  );
};

/**
 * Error message component
 */
export const ErrorMessage: React.FC<{
  error: string;
  onDismiss?: () => void;
  className?: string;
}> = ({ error, onDismiss, className = '' }) => {
  return (
    <div className={`bg-red-50 border border-red-200 rounded-md p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <button
              onClick={onDismiss}
              className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
            >
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Success message component
 */
export const SuccessMessage: React.FC<{
  message: string;
  onDismiss?: () => void;
  className?: string;
}> = ({ message, onDismiss, className = '' }) => {
  return (
    <div className={`bg-green-50 border border-green-200 rounded-md p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-green-800">{message}</p>
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <button
              onClick={onDismiss}
              className="inline-flex bg-green-50 rounded-md p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-50 focus:ring-green-600"
            >
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default {
  useLoadingState,
  useAsyncOperation,
  useMultipleAsyncOperations,
  useFormSubmission,
  usePaginationLoading,
  LoadingSpinner,
  ProgressBar,
  ErrorMessage,
  SuccessMessage
};



