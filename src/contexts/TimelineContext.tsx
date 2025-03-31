"use client";

import React, { createContext, useContext, useState, ReactNode, useRef, useCallback } from 'react';

// Define the structure of a timeline note
export interface TimelineNote {
  id: string;
  text: string;
  startTime: number; // timestamp in milliseconds
  endTime: number;   // timestamp in milliseconds
  position: {
    x: number;
    y: number;
  };
}

interface TimelineContextType {
  // Timeline state
  isTimelineActive: boolean;
  setTimelineActive: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Notes management
  timelineNotes: TimelineNote[];
  addTimelineNote: (note: TimelineNote) => void;
  
  // Timeline positioning
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  
  // Timeline scrolling
  autoScroll: boolean;
  setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Timeline reference for scrolling
  timelineRef: React.RefObject<HTMLDivElement>;
  
  // Start time reference for the session
  startTimeRef: React.RefObject<number>;
  
  // Helper function to get current timestamp relative to session start
  getCurrentTimestamp: () => number;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

export function useTimelineContext() {
  const context = useContext(TimelineContext);
  if (context === undefined) {
    throw new Error('useTimelineContext must be used within a TimelineProvider');
  }
  return context;
}

interface TimelineProviderProps {
  children: ReactNode;
}

export function TimelineProvider({ children }: TimelineProviderProps) {
  // Timeline activation state
  const [isTimelineActive, setTimelineActive] = useState(true);
  
  // Timeline notes collection
  const [timelineNotes, setTimelineNotes] = useState<TimelineNote[]>([]);
  
  // Current time position in the timeline (milliseconds from start)
  const [currentTime, setCurrentTime] = useState(0);
  
  // Auto-scroll control
  const [autoScroll, setAutoScroll] = useState(true);
  
  // Reference to the timeline DOM element for scrolling
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Reference to the start time of the session
  const startTimeRef = useRef<number>(Date.now());
  
  // Add a new note to the timeline
  const addTimelineNote = useCallback((note: TimelineNote) => {
    setTimelineNotes(prev => [...prev, note]);
  }, []);
  
  // Get current timestamp relative to session start
  const getCurrentTimestamp = useCallback(() => {
    return Date.now() - startTimeRef.current;
  }, []);

  const value = {
    isTimelineActive,
    setTimelineActive,
    timelineNotes,
    addTimelineNote,
    currentTime,
    setCurrentTime,
    autoScroll,
    setAutoScroll,
    timelineRef,
    startTimeRef,
    getCurrentTimestamp
  };

  return (
    <TimelineContext.Provider value={value}>
      {children}
    </TimelineContext.Provider>
  );
} 