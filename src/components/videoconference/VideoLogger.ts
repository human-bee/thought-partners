import { clientEnv } from '@/utils/clientEnv';

// Add a simple logging utility to control verbosity
export const logLevels = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Default to WARN in development and ERROR in production for minimal logging
const currentLogLevel = clientEnv.NODE_ENV === 'production'
  ? logLevels.ERROR
  : (clientEnv.NEXT_PUBLIC_LOG_LEVEL
      ? logLevels[clientEnv.NEXT_PUBLIC_LOG_LEVEL as keyof typeof logLevels]
      : logLevels.WARN);

export const log = {
  error: (message: string, ...args: unknown[]) => {
    if (currentLogLevel >= logLevels.ERROR) {
      const entry = { timestamp: new Date().toISOString(), level: 'ERROR', message, ...(args.length && { metadata: args }) };
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (currentLogLevel >= logLevels.WARN) {
      const entry = { timestamp: new Date().toISOString(), level: 'WARN', message, ...(args.length && { metadata: args }) };
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (currentLogLevel >= logLevels.INFO) {
      const entry = { timestamp: new Date().toISOString(), level: 'INFO', message, ...(args.length && { metadata: args }) };
    }
  },
  debug: (message: string, ...args: unknown[]) => {
    if (currentLogLevel >= logLevels.DEBUG) {
      const entry = { timestamp: new Date().toISOString(), level: 'DEBUG', message, ...(args.length && { metadata: args }) };
    }
  },
}; 