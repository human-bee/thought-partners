"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, ConnectionState } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';
import { useVideoConferenceContext } from '@/contexts/VideoConferenceContext';
import { clientEnv } from '@/utils/clientEnv';

/**
 * This component handles LiveKit initialization and cleanup separately
 * to avoid circular dependencies and ensure proper resource management.
 */
const LiveKitInitializer = React.memo(() => {
  // Debug logging
  console.log('LiveKitInitializer rendering', new Date().toISOString());
  
  // Get contexts
  const roomContext = useRoomContext();
  const videoConferenceContext = useVideoConferenceContext();
  
  // Refs
  const isUnmountingRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRY_ATTEMPTS = 5;
  
  // Get room from context - in @livekit/components-react, roomContext is the Room instance
  const room = roomContext as Room;
  
  // Function to retry initialization with backoff
  const retryInitialization = () => {
    if (retryCountRef.current >= MAX_RETRY_ATTEMPTS || isUnmountingRef.current) {
      console.error(`LiveKitInitializer: Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached or component unmounting`);
      return;
    }
    
    retryCountRef.current++;
    
    // Exponential backoff with max of 5 seconds
    const delay = Math.min(Math.pow(2, retryCountRef.current) * 200, 5000);
    
    console.log(`LiveKitInitializer: Retry ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS} in ${delay}ms`);
    
    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    // Set up a new retry timeout
    retryTimeoutRef.current = setTimeout(() => {
      if (!isUnmountingRef.current) {
        console.log(`LiveKitInitializer: Retrying initialization attempt ${retryCountRef.current}`);
      }
    }, delay);
  };
  
  // Initialize LiveKit on mount
  useEffect(() => {
    // Clear any existing timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    // We need to check if room is available
    if (!room) {
      console.error('LiveKitInitializer: No room found in room context');
      retryInitialization();
      return;
    }
    
    console.log('LiveKitInitializer: Room context is available, state:', room.state);
    
    // Reset retry counter on successful initialization
    retryCountRef.current = 0;
    
    // Handle connection state changes
    const handleConnectionStateChange = (state: ConnectionState) => {
      console.log('LiveKitInitializer: Connection state changed to', state);
      
      if (state === ConnectionState.Connected) {
        hasConnectedRef.current = true;
        
        // Reset retry counter on successful connection
        retryCountRef.current = 0;
        
        // Notify VideoConferenceContext about connection
        if (videoConferenceContext) {
          videoConferenceContext.onRoomConnected();
        }
      } else if (state === ConnectionState.Reconnecting) {
        // Notify VideoConferenceContext about reconnection attempt
        if (videoConferenceContext) {
          videoConferenceContext.onRoomReconnecting();
        }
      } else if (state === ConnectionState.Disconnected) {
        // Notify VideoConferenceContext about disconnection
        if (videoConferenceContext) {
          videoConferenceContext.onRoomFailed(false);
        }
      }
    };
    
    // Add event listeners
    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
    
    // If room is connected, immediately notify the context
    if (room.state === ConnectionState.Connected && videoConferenceContext) {
      videoConferenceContext.onRoomConnected();
    }
    
    // Make room available globally for debugging
    if (typeof window !== 'undefined' && clientEnv.NODE_ENV === 'development') {
      (window as any).livekit = {
        ...(window as any).livekit,
        room
      };
    }
    
    // Cleanup on unmount
    return () => {
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
      
      // Clear any pending retries
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [room, videoConferenceContext]);
  
  // Set unmounting flag on cleanup
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      
      // Clear any pending retries
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);
  
  return null;
});

export default LiveKitInitializer;