/**
 * HTTP client for FastAPI backend communication
 */

import logger from './logger';
import { ApiClientBase } from '../../../../shared/services/apiClientBase';
import { resolveApiBaseUrl } from '../../../../shared/services/urlResolver';

const STAFF_SESSION_STORAGE_KEY = 'pos_staff_session';

const clearExpiredStaffSession = () => {
  try {
    localStorage.removeItem(STAFF_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pos-staff-session-expired'));
  }
};

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
          const raw = localStorage.getItem(STAFF_SESSION_STORAGE_KEY);
          if (!raw) return {};
          const parsed = JSON.parse(raw);
          const sessionToken = parsed?.session_token;
          if (!sessionToken || typeof sessionToken !== 'string') {
            return {};
          }

          const expiresAtRaw = parsed?.expires_at;
          if (typeof expiresAtRaw === 'string' && expiresAtRaw.trim().length > 0) {
            const expiryTs = new Date(expiresAtRaw).getTime();
            if (!Number.isNaN(expiryTs) && expiryTs <= Date.now()) {
              clearExpiredStaffSession();
              return {};
            }
          }

          return {
            'X-POS-Staff-Session': sessionToken.trim()
          };
        } catch {
          clearExpiredStaffSession();
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
