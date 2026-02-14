type UrlSource = 'env' | 'local_fallback' | 'prod_fallback';

const DEFAULT_LOCAL_API_BASE_URL = 'http://127.0.0.1:8002/api/v1';
const DEFAULT_PROD_API_BASE_URL = 'https://compazz-backend.onrender.com/api/v1';

const DEFAULT_LOCAL_DASHBOARD_URL = 'http://localhost:5173';
const DEFAULT_PROD_DASHBOARD_URL = 'https://compazz.app';

const DEFAULT_LOCAL_POS_URL = 'http://localhost:5174';
const DEFAULT_PROD_POS_URL = 'https://pos.compazz.app';

const normalizeUrl = (value: string): string => value.trim().replace(/\/+$/, '');

const getHostnameFromUrl = (value: string): string => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const getRuntimeHostname = (): string => {
  if (typeof window === 'undefined') return '';
  return (window.location.hostname || '').toLowerCase();
};

const isLocalHostname = (hostname: string): boolean => {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');
};

const isKnownProductionHostname = (hostname: string): boolean => {
  return hostname === 'compazz.app' || hostname === 'www.compazz.app' || hostname === 'pos.compazz.app';
};

const isLoopbackHostname = (hostname: string): boolean => {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
};

const isLoopbackApiUrl = (url: string): boolean => {
  const hostname = getHostnameFromUrl(url);
  return isLoopbackHostname(hostname);
};

export function resolveApiBaseUrl(envValue?: string): { url: string; source: UrlSource } {
  const runtimeHostname = getRuntimeHostname();

  if (envValue && envValue.trim().length > 0) {
    const normalizedEnvUrl = normalizeUrl(envValue);

    // Guardrail: never allow non-local hosts to talk to a loopback backend URL.
    if (runtimeHostname && !isLocalHostname(runtimeHostname) && isLoopbackApiUrl(normalizedEnvUrl)) {
      return { url: DEFAULT_PROD_API_BASE_URL, source: 'prod_fallback' };
    }

    return { url: normalizedEnvUrl, source: 'env' };
  }

  if (isLocalHostname(runtimeHostname)) {
    return { url: DEFAULT_LOCAL_API_BASE_URL, source: 'local_fallback' };
  }

  if (isKnownProductionHostname(runtimeHostname)) {
    return { url: DEFAULT_PROD_API_BASE_URL, source: 'prod_fallback' };
  }

  return { url: DEFAULT_PROD_API_BASE_URL, source: 'prod_fallback' };
}

export function resolveDashboardAppUrl(envValue?: string): string {
  if (envValue && envValue.trim().length > 0) {
    return normalizeUrl(envValue);
  }
  return isLocalHostname(getRuntimeHostname()) ? DEFAULT_LOCAL_DASHBOARD_URL : DEFAULT_PROD_DASHBOARD_URL;
}

export function resolvePosAppUrl(envValue?: string): string {
  if (envValue && envValue.trim().length > 0) {
    return normalizeUrl(envValue);
  }
  return isLocalHostname(getRuntimeHostname()) ? DEFAULT_LOCAL_POS_URL : DEFAULT_PROD_POS_URL;
}
