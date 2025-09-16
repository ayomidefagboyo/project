/**
 * HTTP client for FastAPI backend communication
 */

import { logger } from './logger';

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface ApiError {
  message: string;
  status: number;
  details?: any;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    // Use localhost in development if no backend URL is set
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    const defaultUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:8000/api/v1'
      : 'https://compazz-backend.onrender.com/api/v1';

    this.baseUrl = envUrl || defaultUrl;

    // Enhanced debugging for production issues
    console.log('=== ApiClient Debug ===');
    console.log('Environment VITE_API_BASE_URL:', envUrl);
    console.log('Default URL (fallback):', defaultUrl);
    console.log('Final baseUrl:', this.baseUrl);
    console.log('Current hostname:', window.location.hostname);
    console.log('All env vars:', import.meta.env);
    console.log('======================');

    // Safety check for placeholder URLs
    if (this.baseUrl.includes('your-render-backend-url')) {
      console.error('⚠️ PLACEHOLDER URL DETECTED! Using fallback...');
      this.baseUrl = 'https://compazz-backend.onrender.com/api/v1';
      console.log('Fixed baseUrl:', this.baseUrl);
    }
  }

  /**
   * Set authentication token
   */
  setToken(token: string | null) {
    this.token = token;
  }

  /**
   * Get authentication token from localStorage or Supabase session
   */
  private async getStoredToken(): Promise<string | null> {
    if (this.token) return this.token;

    // First try localStorage for custom tokens
    const customToken = localStorage.getItem('auth_token');
    if (customToken) return customToken;

    // Fallback to Supabase session token
    try {
      const { supabase } = await import('./supabase');
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      console.error('Error getting Supabase session:', error);
      return null;
    }
  }

  /**
   * Get headers for API requests
   */
  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = await this.getStoredToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      console.log('🔐 Auth token found and added to headers');
    } else {
      console.warn('⚠️ No auth token found in localStorage or Supabase session');
    }

    return headers;
  }

  /**
   * Handle API response
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const status = response.status;
    
    try {
      const data = await response.json();
      
      if (!response.ok) {
        return {
          data: null,
          error: data.detail || data.message || `HTTP ${status}`,
          status
        };
      }

      return {
        data,
        error: null,
        status
      };
    } catch (error) {
      return {
        data: null,
        error: `Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status
      };
    }
  }

  /**
   * Make GET request
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    try {
      const url = new URL(`${this.baseUrl}${endpoint}`);
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
          }
        });
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      return await this.handleResponse<T>(response);
    } catch (error) {
      return {
        data: null,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 0
      };
    }
  }

  /**
   * Make POST request
   */
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined,
      });

      return await this.handleResponse<T>(response);
    } catch (error) {
      return {
        data: null,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 0
      };
    }
  }

  /**
   * Make PUT request
   */
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: await this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined,
      });

      return await this.handleResponse<T>(response);
    } catch (error) {
      return {
        data: null,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 0
      };
    }
  }

  /**
   * Make PATCH request
   */
  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PATCH',
        headers: await this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined,
      });

      return await this.handleResponse<T>(response);
    } catch (error) {
      return {
        data: null,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 0
      };
    }
  }

  /**
   * Make DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: await this.getHeaders(),
      });

      return await this.handleResponse<T>(response);
    } catch (error) {
      return {
        data: null,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 0
      };
    }
  }

  /**
   * Upload file with FormData
   */
  async uploadFile<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    try {
      const headers: HeadersInit = {};
      const token = this.getStoredToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      return await this.handleResponse<T>(response);
    } catch (error) {
      return {
        data: null,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 0
      };
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getStoredToken();
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export types
export type { ApiResponse, ApiError };




