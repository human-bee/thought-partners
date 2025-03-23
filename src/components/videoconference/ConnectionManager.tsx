import { useCallback, useState, useRef, useEffect } from 'react';
import { Room, RoomEvent, ConnectionState } from 'livekit-client';
import { useVideoConferenceContext } from '@/contexts/VideoConferenceContext';
import { log } from './VideoLogger';
import { getRoomInfo, storeRoomInfo } from './RoomStorage';

interface ConnectionManagerProps {
  onError: (message: string) => void;
  onRecovery: () => void;
}

interface ConnectionManagerState {
  isRefreshingToken: boolean;
  permissionsError: boolean;
  refreshToken: () => Promise<void>;
}

export const useConnectionManager = ({
  onError,
  onRecovery
}: ConnectionManagerProps): ConnectionManagerState => {
  const videoConferenceContext = useVideoConferenceContext();
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [permissionsError, setPermissionsError] = useState(false);
  const [autoReconnectAttempted, setAutoReconnectAttempted] = useState(false);
  const errorCountRef = useRef(0);
  const roomRef = useRef<Room | null>(null);
  const userIdentityRef = useRef<string | null>(null);
  const roomNameRef = useRef<string | null>(null);

  // Store room information whenever it's available
  useEffect(() => {
    if (videoConferenceContext?.room && videoConferenceContext.room.localParticipant) {
      roomRef.current = videoConferenceContext.room;
      userIdentityRef.current = videoConferenceContext.room.localParticipant.identity;
      roomNameRef.current = videoConferenceContext.room.name;
      storeRoomInfo(videoConferenceContext.room.name, videoConferenceContext.room.localParticipant.identity);
    }
  }, [videoConferenceContext?.room]);

  // Setup error handling and connection state monitoring
  useEffect(() => {
    if (videoConferenceContext?.room) {
      const room = videoConferenceContext.room;
      roomRef.current = room;
      
      // Monitor room state changes
      const handleStateChange = (state: ConnectionState) => {
        log.info('Room connection state changed:', state);
        
        if (state === ConnectionState.Connected) {
          // Clear any error messages when we successfully connect
          onRecovery();
          errorCountRef.current = 0;
          
          // Re-store room info on reconnection
          if (room.localParticipant) {
            storeRoomInfo(room.name, room.localParticipant.identity);
          }
        } else if (state === ConnectionState.Disconnected) {
          // Auto reconnect on disconnection
          if (!autoReconnectAttempted && errorCountRef.current <= 3) {
            setAutoReconnectAttempted(true);
            log.info('Connection failed, attempting automatic recovery...');
            
            // Use a direct page reload for simplicity
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }
      };

      const handleError = (error: Error) => {
        log.error('LiveKit room error:', error);
        
        // Increment error counter to prevent too many reconnection attempts
        errorCountRef.current += 1;
        
        if (error.message.includes('Context is closed')) {
          onError('Connection issue detected. Please refresh the page if video is not working.');
          
          // Automatically attempt to refresh token after first context closed error
          if (!autoReconnectAttempted && errorCountRef.current <= 3) {
            setAutoReconnectAttempted(true);
            log.info('Automatically attempting to recover from context closed error...');
            
            // Use a direct page reload for simplicity
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }
      };
      
      // Add event listeners
      room.on(RoomEvent.ConnectionStateChanged, handleStateChange);
      room.on(RoomEvent.MediaDevicesError, handleError);
      
      return () => {
        room.off(RoomEvent.ConnectionStateChanged, handleStateChange);
        room.off(RoomEvent.MediaDevicesError, handleError);
      };
    }
  }, [videoConferenceContext?.room, autoReconnectAttempted, onError, onRecovery]);

  // Global error handler for LiveKit errors
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      // Check if error is potentially related to LiveKit
      if (
        event.error &&
        (event.error.toString().includes('livekit') ||
         event.error.toString().includes('Room') ||
         event.error.toString().includes('Participant') ||
         event.error.toString().includes('Track') ||
         event.error.toString().includes('MediaStream'))
      ) {
        
        log.warn('Detected LiveKit error via window event:', event.error);
        
        // Don't try auto-reconnection too many times
        errorCountRef.current += 1;
        
        if (errorCountRef.current > 5) {
          log.error('Too many LiveKit errors, please refresh the page manually');
          return;
        }
        
        // Handle context closed errors automatically
        if (!autoReconnectAttempted && event.error?.message?.includes('Context is closed')) {  
          setAutoReconnectAttempted(true);
          log.info('Attempting automatic recovery from LiveKit error...');
          
          // Direct page reload for simplicity
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      }
    };
    
    // Add global error handler
    window.addEventListener('error', handleGlobalError);
    
    return () => {
      window.removeEventListener('error', handleGlobalError);
    };
  }, [autoReconnectAttempted, onError]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
        try {
          roomRef.current.disconnect(true);
        } catch (e) {
          log.warn('Error during cleanup:', e);
        }
      }
    };
  }, []);

  // Function to refresh token
  const refreshToken = useCallback(async () => {
    log.info('Starting token refresh process...');
    
    // Get current room info
    const { roomName, identity } = getRoomInfo();
    
    if (!roomName || !identity) {
      log.error('Cannot refresh token: missing identity or room information', { 
        identity, 
        roomName, 
        hasRoomContext: !!videoConferenceContext 
      });
      onError('Cannot reconnect: missing room information. Please refresh the page.');
      return;
    }

    try {
      setIsRefreshingToken(true);
      onError('Reconnecting with new permissions...');

      // Get new token with full permissions
      const response = await fetch('/api/get-token?' + new URLSearchParams({
        room: roomName,
        username: identity,
        video: 'true',
        audio: 'true',
        data: 'true'
      }));

      if (!response.ok) {
        throw new Error(`Failed to get new token: ${response.status}`);
      }

      const { token } = await response.json();

      // Store new token
      sessionStorage.setItem('livekit_token', token);
      
      // Store current room info for recovery
      storeRoomInfo(roomName, identity);

      // Handle reconnection differently based on if we have a room
      if (videoConferenceContext?.room) {
        try {
          log.info('Disconnecting from room to apply new token...');
          await videoConferenceContext.room.disconnect();
          
          // Set token in context
          videoConferenceContext.setToken(token);
          
          log.info('Successfully updated token, room will reconnect automatically');
          setPermissionsError(false);
          
          // Wait briefly then clear the error message
          setTimeout(() => {
            onRecovery();
          }, 3000);
        } catch (error) {
          log.error('Failed to gracefully disconnect room:', error);
          // Fallback to page reload
          window.location.reload();
        }
      } else {
        // No room context - just set the token and let LiveKitRoom handle connection
        videoConferenceContext?.setToken(token);
        log.info('No active room, set new token for connection');
        
        // Wait briefly then clear the error message
        setTimeout(() => {
          onRecovery();
        }, 1000);
      }
    } catch (error) {
      log.error('Token refresh failed:', error);
      onError('Failed to refresh connection. Please try refreshing the page.');
      throw error;
    } finally {
      setIsRefreshingToken(false);
    }
  }, [videoConferenceContext, onError, onRecovery]);

  return {
    isRefreshingToken,
    permissionsError,
    refreshToken
  };
}; 