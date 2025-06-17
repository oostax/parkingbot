"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { useEffect } from "react";

// Create a Session Provider that also handles auto-refresh of the session
export function SessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Set up an interval to refresh the session periodically
    const refreshInterval = setInterval(() => {
      // This will trigger a jwt callback with trigger="update"
      fetch('/api/auth/session');
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(refreshInterval);
  }, []);

  return (
    <NextAuthSessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={true}>
      {children}
    </NextAuthSessionProvider>
  );
} 