import { useState, useEffect } from 'react';

/**
 * Hook to determine if the code is running on the client-side or server-side.
 * Returns true if running on the client, false during SSR.
 * This is useful for conditionally rendering components that use browser APIs.
 */
export function useIsClient() {
  // Initialize state as false (assuming server-side)
  const [isClient, setIsClient] = useState(false);

  // After initial render, set to true if window is defined
  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
} 