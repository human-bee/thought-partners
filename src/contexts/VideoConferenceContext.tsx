"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Room, RoomOptions, RoomEvent, VideoPresets } from 'livekit-client';
import { LiveKitRoom } from '@livekit/components-react';

interface VideoConferenceContextType {
  room: Room | null;
  token: string | null;
  setToken: (token: string | null) => void;
  isConnected: boolean;
  isReconnecting: boolean;
  hasError: boolean;
  onRoomConnected: () => void;
  onRoomDisconnected: () => void;
  onRoomReconnecting: () => void;
  onRoomReconnected: () => void;
  onRoomFailed: (isFailed: boolean) => void;
  onRoomCleanup: () => void;
}

const VideoConferenceContext = createContext<VideoConferenceContextType | null>(null);

export const useVideoConferenceContext = () => {
  const context = useContext(VideoConferenceContext);
  if (!context) {
    throw new Error('useVideoConferenceContext must be used within a VideoConferenceProvider');
  }
  return context;
};

interface VideoConferenceProviderProps {
  children: React.ReactNode;
  serverUrl: string;
  roomOptions?: RoomOptions;
}

export const VideoConferenceProvider: React.FC<VideoConferenceProviderProps> = ({
  children,
  serverUrl,
  roomOptions = {
    adaptiveStream: true,
    dynacast: true,
    publishDefaults: {
      simulcast: true,
      videoSimulcastLayers: [
        VideoPresets.h720.resolution,
        VideoPresets.h360.resolution,
        VideoPresets.h180.resolution,
      ],
      videoCodec: 'vp8',
      dtx: true,
      red: true,
      forceStereo: false,
    },
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
    },
    audioCaptureDefaults: {
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
    },
    stopLocalTrackOnUnpublish: true,
  } as RoomOptions,
}) => {
  // Initialize token from session storage if available
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const storedToken = sessionStorage.getItem('livekit_token');
      if (storedToken) {
        try {
          // Basic JWT structure validation
          const parts = storedToken.split('.');
          if (parts.length === 3) {
            return storedToken;
          }
        } catch (e) {
        }
      }
    }
    return null;
  });

  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const isUnmountingRef = useRef(false);
  const tokenValidationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Validate token whenever it changes
  useEffect(() => {
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length !== 3) {
          setToken(null);
          return;
        }

        // Decode token payload to check expiration
        const payload = JSON.parse(atob(parts[1]));
        if (!payload.exp) {
          setToken(null);
          return;
        }
        
        const expirationTime = payload.exp * 1000; // Convert to milliseconds
        const currentTime = Date.now();
        const timeToExpiry = expirationTime - currentTime;

        // If token is already expired or expiring in less than 10 seconds, don't use it
        if (timeToExpiry <= 10000) {
          setToken(null);
          return;
        }

        // Set up token refresh before expiration
        if (tokenValidationTimeoutRef.current) {
          clearTimeout(tokenValidationTimeoutRef.current);
        }

        // Schedule token refresh for 1 minute before expiration or at half of token lifetime if token is short-lived
        const refreshBuffer = Math.min(60000, timeToExpiry / 2);
        tokenValidationTimeoutRef.current = setTimeout(() => {
          // Call token refresh API or just clear the current token to trigger a re-login
          setToken(null);
        }, Math.max(0, timeToExpiry - refreshBuffer));

        // Store valid token
        sessionStorage.setItem('livekit_token', token);
      } catch (e) {
        setToken(null);
      }
    } else {
      // Clean up session storage when token is cleared
      sessionStorage.removeItem('livekit_token');
    }

    return () => {
      if (tokenValidationTimeoutRef.current) {
        clearTimeout(tokenValidationTimeoutRef.current);
      }
    };
  }, [token]);

  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      if (tokenValidationTimeoutRef.current) {
        clearTimeout(tokenValidationTimeoutRef.current);
      }
    };
  }, []);

  // Set up room event listeners when room is available
  useEffect(() => {
    if (!room) return;

    const handleConnected = () => {
      if (!isUnmountingRef.current) {
        setIsConnected(true);
        setIsReconnecting(false);
        setHasError(false);
      }
    };

    const handleDisconnected = () => {
      if (!isUnmountingRef.current) {
        setIsConnected(false);
        setIsReconnecting(false);
      }
    };

    const handleReconnecting = () => {
      if (!isUnmountingRef.current) {
        setIsReconnecting(true);
      }
    };

    const handleReconnected = () => {
      if (!isUnmountingRef.current) {
        setIsConnected(true);
        setIsReconnecting(false);
        setHasError(false);
      }
    };

    const handleError = (error: Error) => {
      if (!isUnmountingRef.current) {
        setHasError(true);
      }
    };

    // Add event listeners
    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.SignalConnected, handleConnected);
    room.on(RoomEvent.MediaDevicesError, handleError);

    // Clean up event listeners
    return () => {
      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.Reconnecting, handleReconnecting);
      room.off(RoomEvent.Reconnected, handleReconnected);
      room.off(RoomEvent.SignalConnected, handleConnected);
      room.off(RoomEvent.MediaDevicesError, handleError);
    };
  }, [room]);

  const handleRoomConnected = () => {
    // Get room from LiveKit global object
    const livekit = (window as { livekit?: { room?: Room } }).livekit;
    if (livekit?.room) {
      setRoom(livekit.room);
      setIsConnected(true);
      setIsReconnecting(false);
      setHasError(false);
    }
  };

  const handleRoomDisconnected = () => {
    if (!isUnmountingRef.current) {
      setIsConnected(false);
      setIsReconnecting(false);
    }
  };

  const handleRoomReconnecting = () => {
    if (!isUnmountingRef.current) {
      setIsReconnecting(true);
    }
  };

  const handleRoomReconnected = () => {
    if (!isUnmountingRef.current) {
      setIsConnected(true);
      setIsReconnecting(false);
      setHasError(false);
    }
  };

  const handleRoomFailed = (isFailed: boolean) => {
    if (!isUnmountingRef.current) {
      setHasError(isFailed);
      setIsConnected(false);
      setIsReconnecting(false);
    }
  };

  const handleRoomCleanup = () => {
    if (!isUnmountingRef.current) {
      setRoom(null);
      setToken(null);
      setIsConnected(false);
      setIsReconnecting(false);
      setHasError(false);
    }
  };

  // Return VideoConferenceProvider with proper token handling
  return (
    <VideoConferenceContext.Provider
      value={{
        room,
        token,
        setToken,
        isConnected,
        isReconnecting,
        hasError,
        onRoomConnected: handleRoomConnected,
        onRoomDisconnected: handleRoomDisconnected,
        onRoomReconnecting: handleRoomReconnecting,
        onRoomReconnected: handleRoomReconnected,
        onRoomFailed: handleRoomFailed,
        onRoomCleanup: handleRoomCleanup,
      }}
    >
      {token && (
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          options={roomOptions}
          connectOptions={{
            autoSubscribe: true,
            rtcConfig: {
              iceTransportPolicy: 'all',
              // Add more STUN/TURN servers for better connectivity
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
              ],
            },
            // Add longer timeout for peer connections
            peerConnectionTimeout: 60000, // 60 seconds
          }}
          onError={(error) => {
            
            // Enhanced error handling with more detailed logging
            if (error.message.includes('token expired')) {
              setToken(null);
            } else if (error.message.includes('permission')) {
              setToken(null);
            } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
              // For timeouts, we'll set the error but not immediately clear the token
              // This allows retry logic to work in components
            } else if (error.message.includes('connection') || error.message.includes('connect')) {
            } else {
            }
            
            setHasError(true);
          }}
          // Ensure proper disconnect handling to clean up resources
          onConnected={() => {
            setIsConnected(true);
            setIsReconnecting(false);
            setHasError(false);
          }}
          onDisconnected={() => {
            setIsConnected(false);
            setIsReconnecting(false);
          }}
          // Make token explicitly available in room context
          data-token={token}
        >
          {children}
        </LiveKitRoom>
      )}
      {!token && children}
    </VideoConferenceContext.Provider>
  );
}; 