// Safe client-side environment variables
// This file provides a safe way to access environment variables on the client
// without directly referencing 'process.env' which can cause errors

interface ClientEnv {
  NODE_ENV: string;
  NEXT_PUBLIC_LIVEKIT_URL: string;
  NEXT_PUBLIC_LOG_LEVEL: string;
}

// Default values to prevent undefined errors
const defaultEnv: ClientEnv = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_LIVEKIT_URL: '',
  NEXT_PUBLIC_LOG_LEVEL: 'WARN',
};

// Safely extract environment variables for client-side use
function getClientEnv(): ClientEnv {
  // On the server, we can access process.env directly
  if (typeof window === 'undefined') {
    return {
      NODE_ENV: process.env.NODE_ENV || defaultEnv.NODE_ENV,
      NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL || defaultEnv.NEXT_PUBLIC_LIVEKIT_URL,
      NEXT_PUBLIC_LOG_LEVEL: process.env.NEXT_PUBLIC_LOG_LEVEL || defaultEnv.NEXT_PUBLIC_LOG_LEVEL,
    };
  } 
  
  // On the client, we need to access window.__ENV 
  // OR directly access NEXT_PUBLIC_ variables which Next.js makes available via process.env on the client
  const windowEnv = (window as any).__ENV || {};
  
  return {
    // Try window.__ENV first, then process.env, then default
    NODE_ENV: 
      windowEnv.NODE_ENV || 
      process.env.NODE_ENV || 
      defaultEnv.NODE_ENV,
    
    NEXT_PUBLIC_LIVEKIT_URL: 
      windowEnv.NEXT_PUBLIC_LIVEKIT_URL || 
      process.env.NEXT_PUBLIC_LIVEKIT_URL || 
      defaultEnv.NEXT_PUBLIC_LIVEKIT_URL,
    
    NEXT_PUBLIC_LOG_LEVEL: 
      windowEnv.NEXT_PUBLIC_LOG_LEVEL || 
      process.env.NEXT_PUBLIC_LOG_LEVEL || 
      defaultEnv.NEXT_PUBLIC_LOG_LEVEL,
  };
}

// Export the environment variables
export const clientEnv = getClientEnv();

// Initialize client-side environment variables
if (typeof window !== 'undefined') {
  // Create or update __ENV object on window
  (window as any).__ENV = (window as any).__ENV || {};
  
  // Directly copy all NEXT_PUBLIC_ variables from process.env
  // Next.js makes these available on client-side
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('NEXT_PUBLIC_')) {
      (window as any).__ENV[key] = process.env[key];
    }
  });
  
  // Explicitly set variables needed by the application
  (window as any).__ENV.NODE_ENV = process.env.NODE_ENV;
  
  // Log all environment variables in development
  if (process.env.NODE_ENV === 'development') {
  }
} 