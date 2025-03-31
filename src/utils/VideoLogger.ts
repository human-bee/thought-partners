/**
 * VideoLogger - A simple logging utility that provides consistent logging across the application.
 * This allows for easy enabling/disabling of different log levels in different environments.
 */

const isDebugMode = process.env.NODE_ENV === 'development';

export const VideoLogger = {
  /**
   * Log debug messages - only displayed in development mode
   */
  debug: (message: string, ...args: any[]) => {
    if (isDebugMode) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Log informational messages
   */
  info: (message: string, ...args: any[]) => {
    console.info(`[INFO] ${message}`, ...args);
  },

  /**
   * Log warning messages
   */
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  /**
   * Log error messages
   */
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  }
}; 