'use client';

import { ActivationProvider } from '@/context/ActivationContext.jsx';
import AppShell from '@/components/AppShell.jsx';
// Initialize Firebase early to ensure it's available for API calls
import '@/lib/firebase';
// Initialize error handler to filter third-party errors (GoDaddy, etc.)
import '@/lib/errorHandler';

export default function Providers({ children }) {
  return (
    <ActivationProvider>
      <AppShell>{children}</AppShell>
    </ActivationProvider>
  );
}

