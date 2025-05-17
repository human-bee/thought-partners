'use client';

import { useEffect } from 'react';
// Import for side effects: registers fact-check agent
import '@/agents/FactCheckAgent'
import '@/agents/YoutubeClipAgent'
import '@/agents/ImageGenAgent'

// Client component for environment initialization and logging
export function EnvInitializer() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Create or update the window.__ENV object
      (window as any).__ENV = (window as any).__ENV || {};
      
      // Explicitly set the LiveKit URL from process.env
      // This makes environment variables available to client components
      (window as any).__ENV.NEXT_PUBLIC_LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || '';
      (window as any).__ENV.NODE_ENV = process.env.NODE_ENV || 'development';
      
      // Log environment initialization in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('Environment initialized in EnvInitializer:', {
          NEXT_PUBLIC_LIVEKIT_URL: (window as any).__ENV.NEXT_PUBLIC_LIVEKIT_URL,
          NODE_ENV: (window as any).__ENV.NODE_ENV
        });
      }
    }
    
    // Set up logging configuration
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      // Set to one of: 'ERROR', 'WARN', 'INFO', 'DEBUG'
      (window as any).LOG_LEVEL = process.env.NEXT_PUBLIC_LOG_LEVEL || 'INFO';
      
      // Optionally disable React's development logs
      if (process.env.NEXT_PUBLIC_DISABLE_REACT_LOGS === 'true') {
        const originalConsoleError = console.error;
        console.error = function() {
          const args = Array.from(arguments);
          if (
            typeof args[0] === 'string' && 
            (args[0].includes('Warning:') || 
             args[0].includes('ReactDOM') || 
             args[0].includes('React'))
          ) {
            return;
          }
          return originalConsoleError.apply(console, args);
        };
      }
    }
  }, []);
  
  return null;
} 