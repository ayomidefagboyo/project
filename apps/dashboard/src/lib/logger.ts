/**
 * Production-safe logging utility
 * Only logs in development, completely silent in production
 */

export const logger = {
  error: (message: string, ...args: any[]) => {
    if (import.meta.env.DEV) {
      console.error(message, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (import.meta.env.DEV) {
      console.warn(message, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    if (import.meta.env.DEV) {
      console.info(message, ...args);
    }
  },
  log: (message: string, ...args: any[]) => {
    if (import.meta.env.DEV) {
      console.log(message, ...args);
    }
  },
  debug: (message: string, ...args: any[]) => {
    if (import.meta.env.DEV) {
      console.debug(message, ...args);
    }
  }
};

// Export as default for convenience
export default logger;