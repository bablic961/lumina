'use client';

import { useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { SocketProvider } from '@/components/providers/SocketProvider';
import { ServiceWorkerProvider } from '@/components/providers/ServiceWorkerProvider';
import { Toaster } from '@/components/ui/Toaster';
import { Lightbox } from '@/components/ui/Lightbox';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SocketProvider>
            {children}
            <Toaster />
            <Lightbox />
            <ServiceWorkerProvider />
          </SocketProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
