import { useEffect, useRef, memo } from 'react';
import { Room, RoomEvent, ConnectionState } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';

// Add render counter
let renderCount = 0;

/**
 * This component handles LiveKit initialization and cleanup separately
 * to avoid circular dependencies and ensure proper resource management.
 * Wrap with memo to prevent unnecessary rerenders.
 */
const LiveKitInitializer = memo(function LiveKitInitializer() {
  // Debug: Track renders
  const renderCountRef = useRef(0);
  renderCount++;
  renderCountRef.current++;
  
  console.time(`LiveKitInitializer render ${renderCountRef.current}`);
  
  const roomContext = useRoomContext();
  const initializationAttemptedRef = useRef(false);
  const permissionsCheckedRef = useRef(false);
  
  // Debug: Check if roomContext changes causing rerenders
  const prevRoomContextRef = useRef(roomContext);
  useEffect(() => {
    if (prevRoomContextRef.current !== roomContext) {
      console.log('LiveKitInitializer: roomContext changed');
      prevRoomContextRef.current = roomContext;
    }
  }, [roomContext]);
  
  // Debug: Log unmounting
  useEffect(() => {
    return () => {
      console.log(`LiveKitInitializer unmounting: render count was ${renderCountRef.current}`);
    };
  }, []);
  
  // Handle room initialization and cleanup with proper dependency tracking
  useEffect(() => {
    // Skip if no room or already initialized
    if (!roomContext?.room || initializationAttemptedRef.current) return;
    
    // Store reference to the room to avoid dependency issues
    const room = roomContext.room;
    initializationAttemptedRef.current = true;
    
    // Validate token permissions with minimal rerenders
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
        
        const hasRequiredPermissions = 
          permissions?.canPublish && 
          permissions?.canPublishAudio && 
          permissions?.canPublishVideo;
        
        if (!hasRequiredPermissions) {
          console.error('LiveKitInitializer: Insufficient permissions detected. Token is missing critical publishing permissions.');
          
          // Store info for reconnect if permissions are insufficient
          sessionStorage.setItem('livekit_needs_new_token', 'true');
        } else {
          // Clear flag if permissions are good
          sessionStorage.removeItem('livekit_needs_new_token');
        }
      } catch (e) {
        console.warn('LiveKitInitializer: Error checking permissions:', e);
      }
    };
    
    // Initialize in the right sequence
    const initialize = async () => {
      try {
        // Skip automatic audio initialization since it's causing issues
        // We'll let the audio be initialized when a user explicitly unmutes or enables devices
        
        // Only validate permissions
        setTimeout(validatePermissions, 500);
      } catch (err) {
        console.warn('LiveKitInitializer: Initialization error:', err);
      }
    };
    
    // Clean disconnect function
    const cleanupRoom = () => {
      try {
        if (room.state !== 'disconnected') {
          room.disconnect(true);
        }
      } catch (err) {
        console.warn('LiveKitInitializer: Error during room cleanup:', err);
      }
    };

    // Define all event handlers
    const handleDisconnect = () => {
      // Do nothing on disconnect to avoid audio context errors
    };

    const handleReconnect = () => {
      initialize();
    };

    // Connection state handler
    const handleConnectionStateChange = (state: ConnectionState) => {
      if (state === ConnectionState.Connected) {
        // Check permissions when connection is established
        setTimeout(() => {
          initialize();
        }, 1000); // Increase delay to ensure connection is stable
      } else if (state === ConnectionState.Reconnecting) {
        // Reset flags to ensure proper reinitialization
        permissionsCheckedRef.current = false;
      } else if (state === ConnectionState.Disconnected || state === ConnectionState.Failed) {
        // Reset initialization flags to allow proper reconnection
        permissionsCheckedRef.current = false;
        initializationAttemptedRef.current = false;
      }
    };
    
    // Register all event handlers
    room.on(RoomEvent.Disconnected, handleDisconnect);
    room.on(RoomEvent.Reconnected, handleReconnect);
    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
    
    // Run initialize on existing connection
    if (room.state === ConnectionState.Connected) {
      initialize();
    }
    
    // Clean up when component unmounts - avoids any closure issues
    return () => {
      room.off(RoomEvent.Disconnected, handleDisconnect);
      room.off(RoomEvent.Reconnected, handleReconnect);
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
      cleanupRoom();
    };
  }, [roomContext?.room]); // Only depend on roomContext.room existence
  
  console.timeEnd(`LiveKitInitializer render ${renderCountRef.current}`);
  
  // This component doesn't render anything
  return null;
});

export default LiveKitInitializer; 