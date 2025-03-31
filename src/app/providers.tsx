"use client";

import React from 'react';
import { TranscriptionProvider } from '@/contexts/TranscriptionContext';
import { TimelineProvider } from '@/contexts/TimelineContext';
import ErrorBoundary from '@/components/ErrorBoundary';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <TranscriptionProvider>
        <TimelineProvider>
          {children}
        </TimelineProvider>
      </TranscriptionProvider>
    </ErrorBoundary>
  );
} 