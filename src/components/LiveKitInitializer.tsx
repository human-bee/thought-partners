import { useEffect, useRef } from 'react';
import { Room, RoomEvent, ConnectionState } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';

/**
 * This component handles LiveKit initialization and cleanup separately
 * to avoid circular dependencies and ensure proper resource management.
 */
export default function LiveKitInitializer() {
  const roomContext = useRoomContext();
  const initializationAttemptedRef = useRef(false);
  const permissionsCheckedRef = useRef(false);
  
  // Handle room initialization and cleanup
  useEffect(() => {
    if (!roomContext?.room || initializationAttemptedRef.current) return;
    
    initializationAttemptedRef.current = true;
    const room = roomContext.room;
    
    console.log('LiveKitInitializer: Initializing room');
    
    // Validate token permissions
    const validatePermissions = () => {
      if (permissionsCheckedRef.current) return;
      permissionsCheckedRef.current = true;
      
      try {
        const participant = room.localParticipant;
        if (!participant) {
          console.error('LiveKitInitializer: No local participant found, cannot validate permissions');
          return;
        }
        
        // Check for required permissions
        const permissions = participant.permissions;
        console.log('LiveKitInitializer: Participant permissions:', permissions);
        
        const hasRequiredPermissions = 
          permissions?.canPublish && 
          permissions?.canPublishAudio && 
          permissions?.canPublishVideo;
        
        if (!hasRequiredPermissions) {
          console.error('LiveKitInitializer: Insufficient permissions detected. Token is missing critical publishing permissions.');
          console.error('LiveKitInitializer: Please refresh token with canPublish, canPublishAudio, and canPublishVideo.');
          
          // Store info for reconnect if permissions are insufficient
          sessionStorage.setItem('livekit_needs_new_token', 'true');
        } else {
          console.log('LiveKitInitializer: Token has required publishing permissions');
          // Clear flag if permissions are good
          sessionStorage.removeItem('livekit_needs_new_token');
        }
      } catch (e) {
        console.warn('LiveKitInitializer: Error checking permissions:', e);
      }
    };
    
    // Initialize in the right sequence
    const initialize = async () => {
      console.log('LiveKitInitializer: Starting initialization sequence');
      
      try {
        // Skip automatic audio initialization since it's causing issues
        // We'll let the audio be initialized when a user explicitly unmutes or enables devices
        console.log('LiveKitInitializer: Skipping audio initialization to prevent context issues');
        
        // Only validate permissions
        setTimeout(validatePermissions, 500);
        
      } catch (err) {
        console.warn('LiveKitInitializer: Initialization error:', err);
      }
    };
    
    // Register clean disconnect on unmount
    const cleanupRoom = () => {
      try {
        if (room.state !== 'disconnected') {
          console.log('LiveKitInitializer: Properly disconnecting room on cleanup');
          room.disconnect(true);
        }
      } catch (err) {
        console.warn('LiveKitInitializer: Error during room cleanup:', err);
      }
    };

    // Setup listeners for reconnection
    const handleDisconnect = () => {
      console.log('LiveKitInitializer: Room disconnected');
      // Do nothing on disconnect to avoid audio context errors
    };

    // Connection state handler
    const handleConnectionStateChange = (state: ConnectionState) => {
      console.log('LiveKitInitializer: Connection state changed:', state);
      
      if (state === ConnectionState.Connected) {
        // Check permissions when connection is established
        setTimeout(() => {
          initialize();
        }, 1000); // Increase delay to ensure connection is stable
      } else if (state === ConnectionState.Reconnecting) {
        console.log('LiveKitInitializer: Reconnecting, will reinitialize after reconnection');
        // Reset flags to ensure proper reinitialization
        permissionsCheckedRef.current = false;
      } else if (state === ConnectionState.Disconnected || state === ConnectionState.Failed) {
        console.warn('LiveKitInitializer: Connection lost or failed');
        // Reset initialization flags to allow proper reconnection
        permissionsCheckedRef.current = false;
        initializationAttemptedRef.current = false;
      }
    };
    
    // Register event handlers
    room.on(RoomEvent.Disconnected, handleDisconnect);
    room.on(RoomEvent.Reconnected, initialize);
    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
    
    // Run initialize on existing connection
    if (room.state === ConnectionState.Connected) {
      initialize();
    }
    
    // Clean up when component unmounts
    return () => {
      room.off(RoomEvent.Disconnected, handleDisconnect);
      room.off(RoomEvent.Reconnected, initialize);
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
      cleanupRoom();
    };
  }, [roomContext?.room]);
  
  // This component doesn't render anything
  return null;
} 