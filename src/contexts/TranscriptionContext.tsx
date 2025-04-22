"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TranscriptionContextType {
  showTranscription: boolean;
  setShowTranscription: React.Dispatch<React.SetStateAction<boolean>>;
  showDebugger: boolean;
  setShowDebugger: React.Dispatch<React.SetStateAction<boolean>>;
}

const TranscriptionContext = createContext<TranscriptionContextType | undefined>(undefined);

export function useTranscriptionContext() {
  const context = useContext(TranscriptionContext);
  if (context === undefined) {
    throw new Error('useTranscriptionContext must be used within a TranscriptionProvider');
  }
  return context;
}

interface TranscriptionProviderProps {
  children: ReactNode;
}

export function TranscriptionProvider({ children }: TranscriptionProviderProps) {
  const [showTranscription, setShowTranscription] = useState(true);
  const [showDebugger, setShowDebugger] = useState(false);

  const value = {
    showTranscription,
    setShowTranscription,
    showDebugger,
    setShowDebugger,
  };

  return (
    <TranscriptionContext.Provider value={value}>
      {children}
    </TranscriptionContext.Provider>
  );
} 