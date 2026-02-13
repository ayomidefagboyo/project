/**
 * HTTP client for FastAPI backend communication
 */

import logger from './logger';
import { ApiClientBase } from '../../../../shared/services/apiClientBase';
import { resolveApiBaseUrl } from '../../../../shared/services/urlResolver';

class ApiClient extends ApiClientBase {
  constructor() {
    const resolvedApiBase = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

    super({
      baseUrl: resolvedApiBase.url,
      logger,
      getSessionToken: async () => {
        const { supabase } = await import('./supabase');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        return session?.access_token || null;
      },
      getAdditionalHeaders: async () => {
        try {
          const raw = localStorage.getItem('pos_staff_session');
          if (!raw) return {};
          const parsed = JSON.parse(raw);
          const sessionToken = parsed?.session_token;
          if (!sessionToken || typeof sessionToken !== 'string') return {};
          return {
            'X-POS-Staff-Session': sessionToken
          };
        } catch {
          return {};
        }
      },
    });

    logger.log('=== ApiClient Debug ===');
    logger.log('API Base URL:', resolvedApiBase.url);
    logger.log('API Base Source:', resolvedApiBase.source);
    logger.log('======================');
  }
}

export const apiClient = new ApiClient();
export type { ApiResponse, ApiError } from '../../../../shared/services/apiClientBase';
