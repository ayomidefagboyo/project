export interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface ApiError {
  message: string;
  status: number;
  details?: unknown;
}

interface LoggerLike {
  error?: (message: string, ...args: unknown[]) => void;
  warn?: (message: string, ...args: unknown[]) => void;
  debug?: (message: string, ...args: unknown[]) => void;
}

interface ApiClientBaseOptions {
  baseUrl: string;
  getSessionToken: () => Promise<string | null>;
  logger?: LoggerLike;
}

export class ApiClientBase {
  private readonly baseUrl: string;
  private readonly getSessionToken: () => Promise<string | null>;
  private readonly logger?: LoggerLike;
  private token: string | null = null;

  constructor(options: ApiClientBaseOptions) {
    this.baseUrl = options.baseUrl;
    this.getSessionToken = options.getSessionToken;
    this.logger = options.logger;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async getStoredToken(): Promise<string | null> {
    if (this.token) return this.token;

    const customToken = localStorage.getItem('auth_token');
    if (customToken) return customToken;

    try {
      return await this.getSessionToken();
    } catch (error) {
      this.logger?.error?.('Error getting session token:', error);
      return null;
    }
  }

  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = await this.getStoredToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      this.logger?.debug?.('Auth token added to headers');
    } else {
      this.logger?.debug?.('No auth token available');
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const status = response.status;

    try {
      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: data.detail || data.message || `HTTP ${status}`,
          status,
        };
      }

      return {
        data,
        error: null,
        status,
      };
    } catch (error) {
      return {
        data: null,
        error: `Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status,
      };
    }
  }

  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
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
        status: 0,
      };
    }
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
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
        status: 0,
      };
    }
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
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
        status: 0,
      };
    }
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
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
        status: 0,
      };
    }
  }

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
        status: 0,
      };
    }
  }

  async uploadFile<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    try {
      const headers: HeadersInit = {};
      const token = await this.getStoredToken();
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
        status: 0,
      };
    }
  }

  isAuthenticated(): boolean {
    return !!(this.token || localStorage.getItem('auth_token'));
  }

  clearAuth(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }
}
