import { clientEnv } from '@/utils/clientEnv';

// Add a simple logging utility to control verbosity
export const logLevels = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Set this to logLevels.ERROR in production
const currentLogLevel = clientEnv.NODE_ENV === 'production' 
  ? logLevels.ERROR 
  : (clientEnv.NEXT_PUBLIC_LOG_LEVEL ? 
      logLevels[clientEnv.NEXT_PUBLIC_LOG_LEVEL as keyof typeof logLevels] : 
      logLevels.INFO);

export const log = {
  error: (message: string, ...args: unknown[]) => {
    if (currentLogLevel >= logLevels.ERROR) console.error(message, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    if (currentLogLevel >= logLevels.WARN) console.warn(message, ...args);
  },
  info: (message: string, ...args: unknown[]) => {
    if (currentLogLevel >= logLevels.INFO) console.log(message, ...args);
  },
  debug: (message: string, ...args: unknown[]) => {
    if (currentLogLevel >= logLevels.DEBUG) console.log(message, ...args);
  },
}; 