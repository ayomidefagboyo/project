/**
 * HTTP client for FastAPI backend communication
 */

import logger from './logger';
import { ApiClientBase } from '../../../../shared/services/apiClientBase';

class ApiClient extends ApiClientBase {
  constructor() {
    const envUrl = import.meta.env.VITE_API_BASE_URL;

    if (!envUrl) {
      throw new Error('VITE_API_BASE_URL environment variable is required');
    }

    super({
      baseUrl: envUrl,
      logger,
      getSessionToken: async () => {
        const { supabase } = await import('./supabase');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        return session?.access_token || null;
      },
    });

    logger.log('=== ApiClient Debug ===');
    logger.log('API Base URL:', envUrl);
    logger.log('======================');
  }
}

export const apiClient = new ApiClient();
export type { ApiResponse, ApiError } from '../../../../shared/services/apiClientBase';
