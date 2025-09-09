/**
 * Production-safe logging utility
 * Only logs in development mode to prevent sensitive data exposure
 */

const isDevelopment = import.meta.env.VITE_APP_ENV === 'development' || import.meta.env.VITE_DEBUG === 'true';

export const logger = {
  info: (message: string, data?: any) => {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, data);
    }
  },
  
  error: (message: string, error?: any) => {
    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, error);
    }
  },
  
  warn: (message: string, data?: any) => {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, data);
    }
  },
  
  debug: (message: string, data?: any) => {
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, data);
    }
  }
};

// Production-safe console replacement
export const safeConsole = {
  log: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(message, ...args);
    }
  },
  
  error: (message: string, ...args: any[]) => {
    // Always log errors, but sanitize sensitive data
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        const sanitized = { ...arg };
        // Remove sensitive fields
        delete sanitized.password;
        delete sanitized.token;
        delete sanitized.apiKey;
        delete sanitized.secret;
        return sanitized;
      }
      return arg;
    });
    console.error(message, ...sanitizedArgs);
  }
};
