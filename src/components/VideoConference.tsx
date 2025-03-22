import {
  RoomAudioRenderer,
  VideoConference as LiveKitVideoConference,
  useConnectionState,
  ConnectionState,
  useRoomContext,
  ControlBar,
  useTracks,
  useLocalParticipant,
  Track,
  TrackReferenceOrPlaceholder,
  LocalUserChoices,
  MediaDeviceMenu,
  LayoutContextProvider,
  ParticipantTile
} from '@livekit/components-react';
import { Room, RoomEvent, LocalTrackPublication, Participant, Track as LKTrack, VideoPresets, ConnectionState as RoomConnectionState } from 'livekit-client';
import '@livekit/components-styles';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useConnectionState as useVideoConferenceConnectionState, useRoomContext as useVideoConferenceRoomContext, useLocalParticipant as useVideoConferenceLocalParticipant } from '@/contexts/VideoConferenceContext';

// Safe component to wrap LiveKit's VideoConference component
const SafeVideoConference = () => {
  // Use try-catch to prevent any potential rendering errors
  try {
    return (
      <div className="flex-1 overflow-y-auto">
        <LiveKitVideoConference />
      </div>
    );
  } catch (error) {
    console.error('Error rendering LiveKit VideoConference:', error);
    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center">
        <div className="text-center p-4 bg-gray-800 rounded-lg">
          <p className="mb-4">Failed to display video. Please reload the page.</p>
        </div>
      </div>
    );
  }
};

// Interface for media device info
interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: string;
}

export default function VideoConference() {
  const connectionState = useVideoConferenceConnectionState();
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const roomContext = useVideoConferenceRoomContext();
  const { localParticipant } = useVideoConferenceLocalParticipant();
  
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false); 
  const [permissionsError, setPermissionsError] = useState(false);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [autoReconnectAttempted, setAutoReconnectAttempted] = useState(false);
  
  // Manually track devices instead of using potentially problematic hook
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  
  // Pre-define reference to break circular dependency
  const changeVideoDeviceRef = useRef<(deviceId: string) => Promise<void>>();
  // Add reference for refreshToken to break circular dependency
  const refreshTokenRef = useRef<() => Promise<void>>();
  
  const userIdentityRef = useRef<string | null>(null);
  const roomNameRef = useRef<string | null>(null);
  const errorCountRef = useRef(0);
  
  // Add persistent storage for room info
  const storeRoomInfo = useCallback((roomName: string, identity: string) => {
    try {
      // Store in session storage
      sessionStorage.setItem('livekit_room_name', roomName);
      sessionStorage.setItem('livekit_identity', identity);
      // Update refs
      userIdentityRef.current = identity;
      roomNameRef.current = roomName;
      console.log(`Stored room info: room=${roomName}, identity=${identity}`);
    } catch (e) {
      console.warn('Failed to store room info:', e);
    }
  }, []);

  // Add retrieval function for room info
  const getRoomInfo = useCallback(() => {
    try {
      // Try refs first
      let roomName = roomNameRef.current;
      let identity = userIdentityRef.current;

      // Try session storage if refs are empty
      if (!roomName) {
        roomName = sessionStorage.getItem('livekit_room_name');
      }
      if (!identity) {
        identity = sessionStorage.getItem('livekit_identity');
      }

      // Try room context as last resort
      if (!roomName && roomContext?.room) {
        roomName = roomContext.room.name;
      }
      if (!identity && roomContext?.room?.localParticipant) {
        identity = roomContext.room.localParticipant.identity;
      }

      return { roomName: roomName || null, identity: identity || null };
    } catch (e) {
      console.warn('Failed to retrieve room info:', e);
      return { roomName: null, identity: null };
    }
  }, [roomContext?.room]);
  
  // Immediately capture room info on mount - add at the very beginning of the component
  useEffect(() => {
    console.log('Component mounted - attempting early room info capture');
    
    // Attempt to get session storage token info if available
    try {
      const storedToken = sessionStorage.getItem('livekit_token');
      if (storedToken) {
        console.log('Found stored token in session storage');
        // Try to decode token to extract room and identity (simplified jwt decode)
        try {
          const tokenParts = storedToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            if (payload.video?.room && payload.sub) {
              console.log('Successfully extracted room info from token:', payload.video.room, payload.sub);
              roomNameRef.current = payload.video.room;
              userIdentityRef.current = payload.sub;
            }
          }
        } catch (e) {
          console.warn('Could not decode token:', e);
        }
      }
    } catch (e) {
      console.warn('Error checking session storage:', e);
    }
    
    // Set up a periodic check for room context until it's available
    const checkInterval = setInterval(() => {
      if (roomContext?.room && roomContext.room.localParticipant) {
        console.log('Room context became available via interval check');
        userIdentityRef.current = roomContext.room.localParticipant.identity;
        roomNameRef.current = roomContext.room.name;
        clearInterval(checkInterval);
      }
    }, 500);
    
    // Clear interval on unmount
    return () => clearInterval(checkInterval);
  }, []);

  // Add immediate context monitor after room context or localParticipant changes
  useEffect(() => {
    if (roomContext?.room || localParticipant) {
      console.log('Room context or participant changed:', !!roomContext?.room, !!localParticipant);
      
      if (roomContext?.room?.localParticipant) {
        userIdentityRef.current = roomContext.room.localParticipant.identity;
        roomNameRef.current = roomContext.room.name;
        console.log(`Room info updated from context: room=${roomNameRef.current}, identity=${userIdentityRef.current}`);
      } else if (localParticipant) {
        userIdentityRef.current = localParticipant.identity;
        if (roomContext?.room) {
          roomNameRef.current = roomContext.room.name;
        }
        console.log(`Room info updated from localParticipant: identity=${userIdentityRef.current}, room=${roomNameRef.current}`);
      }
      
      // If room context available, check permissions directly
      if (roomContext?.room?.localParticipant?.permissions) {
        const perms = roomContext.room.localParticipant.permissions;
        console.log('Current participant permissions:', JSON.stringify(perms));
        
        if (!perms.canPublish || !perms.canPublishVideo) {
          console.warn('Insufficient permissions detected early, planning refresh');
          setPermissionsError(true);
        }
      }
    }
  }, [roomContext?.room, localParticipant]);
  
  // Fetch available devices manually
  const fetchDevices = useCallback(async () => {
    try {
      // Request permission first to ensure labels are populated
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch (err) {
        console.log('Initial permission request may have been denied, continuing...');
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.substring(0, 8)}...`,
          kind: device.kind
        }));
        
      const audioDevices = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.substring(0, 8)}...`,
          kind: device.kind
        }));
      
      console.log('Available devices updated:', videoDevices.length, 'video,', audioDevices.length, 'audio');
      // Log specific iPhone/Mac device details for debugging
      const iosDevices = videoDevices.filter(d => d.label.includes('iPhone') || d.label.includes('iPad'));
      if (iosDevices.length > 0) {
        console.log('iOS devices found:', iosDevices.map(d => d.label));
      }
      
      setVideoInputs(videoDevices);
      setAudioInputs(audioDevices);
      
    } catch (error) {
      console.error('Error enumerating devices:', error);
    }
  }, []);
  
  // Listen for device changes with improved logging
  useEffect(() => {
    fetchDevices();
    
    // Update device list when devices change
    const handleDeviceChange = () => {
      console.log('Device change detected - refreshing device list');
      fetchDevices();
    };
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [fetchDevices]);
  
  // Change video device with better error handling
  const changeVideoDevice = useCallback(async (deviceId: string) => {
    try {
      if (!localParticipant) return;
      
      // Stop any existing tracks first
      if (cameraEnabled) {
        await localParticipant.setCameraEnabled(false);
      }
      
      console.log('Attempting to change camera to:', deviceId);
      
      // Try to get media stream first to ensure device is available
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { deviceId: { exact: deviceId } } 
      });
      
      // Use the selected device
      await localParticipant.setCameraEnabled(true, {
        deviceId: deviceId
      });
      
      setCameraEnabled(true);
      setConnectionError(null);
      setPermissionsError(false);
      setShowDeviceSelector(false);
    } catch (error) {
      console.error('Error changing camera device:', error);
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Permission')) {
          setConnectionError('Camera permission denied. Please allow camera access in your browser settings.');
        } else if (error.message.includes('insufficient permissions')) {
          setConnectionError('Your token lacks permissions to publish video. Please refresh and try again.');
          setPermissionsError(true);
          // Use the ref to call refreshToken to avoid circular dependency
          if (refreshTokenRef.current) {
            refreshTokenRef.current();
          }
        } else {
          setConnectionError(`Failed to switch camera: ${error.message}`);
        }
      } else {
        setConnectionError('Failed to switch camera. Please try again.');
      }
    }
  }, [localParticipant, cameraEnabled]);
  
  // Modify the refreshToken function to use the new helpers
  const refreshToken = useCallback(async () => {
    try {
      console.log('Starting token refresh process...');
      
      // Get room info using our new helper
      const { roomName, identity } = getRoomInfo();
      
      if (!identity || !roomName) {
        console.error('Cannot refresh token: missing identity or room information', { 
          identity, 
          roomName,
          hasRoomContext: !!roomContext?.room
        });
        
        setConnectionError('Cannot reconnect: missing identity or room information. Please refresh the page manually.');
        return;
      }
      
      // Set state to show loading
      setIsRefreshingToken(true);
      console.log(`Refreshing token for room=${roomName}, identity=${identity}`);
      
      // Get a new token with explicit publishing permissions
      const response = await fetch('/api/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          identity,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token refresh API returned error:', response.status, errorText);
        throw new Error(`API error: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.token) {
        console.error('Token refresh API returned invalid data:', data);
        throw new Error('API did not return a valid token');
      }
      
      console.log('Successfully obtained new token with proper permissions');
      
      // Store the new token
      sessionStorage.setItem('livekit_token', data.token);
      
      // Store room info again to ensure persistence
      storeRoomInfo(roomName, identity);
      
      // Show success message
      setConnectionError('New token obtained successfully. Please click "Refresh Page" button to reload with new permissions.');
      
    } catch (error) {
      console.error('Error refreshing token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setConnectionError(`Failed to get a new token: ${errorMessage}. Please refresh the page manually.`);
    } finally {
      setIsRefreshingToken(false);
    }
  }, [roomContext?.room, getRoomInfo, storeRoomInfo]);

  // Store the refreshToken function in the ref to break circular dependency
  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);
  
  // Set reference to the function to break circular dependency
  useEffect(() => {
    changeVideoDeviceRef.current = changeVideoDevice;
  }, [changeVideoDevice]);
  
  // Handle iOS handoff specifically - now uses the function reference
  const handleiOSHandoff = useCallback(async () => {
    try {
      // Force a refresh of available devices
      await fetchDevices();
      
      // Look for iOS devices in the list
      const iosDevices = videoInputs.filter(d => 
        d.label.includes('iPhone') || 
        d.label.includes('iPad') || 
        d.label.includes('Continuity')
      );
      
      if (iosDevices.length > 0) {
        // Use the first iOS device found
        const deviceId = iosDevices[0].deviceId;
        console.log('Using iOS device:', iosDevices[0].label);
        
        // Use the reference to avoid circular dependency
        if (changeVideoDeviceRef.current) {
          await changeVideoDeviceRef.current(deviceId);
        } else {
          throw new Error("Video device change function not initialized");
        }
        
        return true;
      } else {
        console.log('No iOS devices found');
        return false;
      }
    } catch (error) {
      console.error('iOS handoff failed:', error);
      setConnectionError('iOS handoff failed. Please try selecting your device manually.');
      return false;
    }
  }, [videoInputs, fetchDevices]); // Removed changeVideoDevice dependency
  
  // Update the room effect to use the new storage helpers
  useEffect(() => {
    if (roomContext?.room) {
      const room = roomContext.room; // Store reference to avoid null checks
      roomRef.current = room;
      
      // Store room information using our new helper
      if (room.localParticipant) {
        storeRoomInfo(room.name, room.localParticipant.identity);
      }
      
      const handleError = (error: Error) => {
        console.error('LiveKit room error:', error);
        
        // Increment error counter to prevent too many reconnection attempts
        errorCountRef.current += 1;
        
        if (error.message.includes('Context is closed')) {
          setConnectionError('Connection issue detected. Please refresh the page if video is not working.');
          setNeedsReconnect(true);
          
          // Automatically attempt to refresh token after first context closed error
          if (!autoReconnectAttempted && errorCountRef.current <= 3) {
            setAutoReconnectAttempted(true);
            console.log('Automatically attempting to recover from context closed error...');
            // Use a direct page reload instead of the refreshToken to avoid circular dependency
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }
      };
      
      // Store handler references for cleanup
      const handleConnectionStateChange = (state: RoomConnectionState) => {
        if (state === 'disconnected' || state === 'failed') {
          setNeedsReconnect(true);
          
          // Auto reconnect on disconnection
          if (state === 'failed' && !autoReconnectAttempted && errorCountRef.current <= 3) {
            setAutoReconnectAttempted(true);
            console.log('Connection failed, attempting automatic recovery...');
            // Use a direct page reload instead of the refreshToken to avoid circular dependency
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }
      };

      // Add event listeners
      room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
      room.on(RoomEvent.MediaDevicesError, handleError);
      
      // Clean up when component unmounts
      return () => {
        room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
        room.off(RoomEvent.MediaDevicesError, handleError);
        
        // Clean up room if still connected
        if (room.state !== 'disconnected') {
          room.disconnect();
        }
      };
    }
  }, [roomContext?.room, autoReconnectAttempted, storeRoomInfo]);

  // Reset counters when component remounts
  useEffect(() => {
    errorCountRef.current = 0;
    setAutoReconnectAttempted(false);
    
    // Clean up on unmount
    return () => {
      if (roomRef.current && roomRef.current.isConnected) {
        try {
          roomRef.current.disconnect(true);
        } catch (e) {
          console.warn('Error during cleanup:', e);
        }
      }
    };
  }, []);
  
  // Enable camera function with better error handling and permission checking
  const enableCamera = useCallback(async () => {
    try {
      // If localParticipant is not available, try to wait for it
      if (!localParticipant) {
        console.warn('localParticipant not immediately available, attempting to wait...');
        setConnectionError('Connecting to video system, please wait...');
        
        // Check if we have room context at least
        if (roomContext?.room) {
          console.log('Room context is available, attempting to reconnect or refresh participant...');
          
          // Try to ensure room is connected
          if (roomContext.room.state !== ConnectionState.Connected) {
            try {
              console.log('Room not connected, attempting to reconnect...');
              await roomContext.room.reconnect();
              console.log('Room reconnection completed');
              
              // Small delay to let participant info update
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
              console.warn('Room reconnection failed:', e);
            }
          }
          
          // Even if we have room but no participant, wait a moment and try again
          if (!roomContext.room.localParticipant) {
            console.log('Still no localParticipant, refreshing page may be needed...');
            setConnectionError('Connection issue detected. Please refresh the page and try again.');
            return;
          } else {
            // We found localParticipant through roomContext
            console.log('Found localParticipant through roomContext');
            // Continue with the roomContext's localParticipant
            const participant = roomContext.room.localParticipant;
            
            // The rest of the function will use this participant instead
            // Start camera enable with this participant
            console.log('Starting camera enable sequence with recovered participant...');
            
            // Log available room information
            console.log('Room info before enabling camera:', {
              hasRoomContext: true,
              contextIdentity: participant.identity,
              hasPermissions: !!participant.permissions
            });
            
            // Validate participant permissions first - do a comprehensive check
            let permissionsValid = true;
            
            if (participant.permissions) {
              const permissions = participant.permissions;
              console.log('Camera enable - current permissions:', JSON.stringify(permissions));
              
              // Check all relevant publishing permissions
              if (!permissions.canPublish) {
                console.error('Token missing general publish permission');
                permissionsValid = false;
              }
              
              if (!permissions.canPublishVideo) {
                console.error('Token missing video publish permission');
                permissionsValid = false;
              }
              
              // Check for valid video sources
              if (permissions.canPublishSources && 
                  !permissions.canPublishSources.includes('camera')) {
                console.error('Token missing camera as permitted source');
                permissionsValid = false;
              }
            } else {
              console.warn('Cannot determine permissions - permissions object not available');
              // Continue anyway as permissions might be implicit
            }
            
            if (!permissionsValid) {
              console.error('Token has insufficient permissions to publish video');
              throw new Error('insufficient permissions');
            }
            
            // First check if we have browser permissions - this helps with iOS/macOS handoff
            console.log('Requesting camera permissions...');
            try {
              await navigator.mediaDevices.getUserMedia({ video: true });
              console.log('Camera permissions granted by browser');
            } catch (mediaError) {
              console.error('Browser media permission error:', mediaError);
              throw mediaError;
            }
            
            // Update device list after permissions are granted
            console.log('Updating device list...');
            await fetchDevices();
            
            // Ensure audio context is ready before enabling camera
            try {
              if (roomContext?.room) {
                await roomContext.room.connectAudio();
                console.log('Audio context connected');
              }
            } catch (e) {
              console.warn('Audio context connection warning (non-fatal):', e);
              // Continue despite error
            }
            
            console.log('Enabling camera on recovered participant...');
            try {
              await participant.setCameraEnabled(true);
              console.log('Camera enabled successfully');
              setCameraEnabled(true);
              setConnectionError(null);
            } catch (cameraError) {
              console.error('Error in setCameraEnabled call:', cameraError);
              throw cameraError;
            }
            
            return; // Exit function as we've handled everything with the recovered participant
          }
        } else {
          console.error('No room context available, cannot proceed with camera');
          setConnectionError('Video system not connected. Please refresh the page and try again.');
          return;
        }
      }
      
      // Normal flow continues here when localParticipant is available immediately
      console.log('Starting camera enable sequence...');
      
      // Log available room information
      console.log('Room info before enabling camera:', {
        hasRoomContext: !!roomContext?.room,
        storedIdentity: userIdentityRef.current,
        storedRoomName: roomNameRef.current,
        contextIdentity: roomContext?.room?.localParticipant?.identity,
        hasPermissions: !!localParticipant.permissions
      });
      
      // Validate participant permissions first - do a comprehensive check
      let permissionsValid = true;
      
      if (localParticipant.permissions) {
        const permissions = localParticipant.permissions;
        console.log('Camera enable - current permissions:', JSON.stringify(permissions));
        
        // Check all relevant publishing permissions
        if (!permissions.canPublish) {
          console.error('Token missing general publish permission');
          permissionsValid = false;
        }
        
        if (!permissions.canPublishVideo) {
          console.error('Token missing video publish permission');
          permissionsValid = false;
        }
        
        // Check for valid video sources
        if (permissions.canPublishSources && 
            !permissions.canPublishSources.includes('camera')) {
          console.error('Token missing camera as permitted source');
          permissionsValid = false;
        }
      } else {
        console.warn('Cannot determine permissions - permissions object not available');
        // Continue anyway as permissions might be implicit
      }
      
      if (!permissionsValid) {
        console.error('Token has insufficient permissions to publish video');
        throw new Error('insufficient permissions');
      }
      
      // First check if we have browser permissions - this helps with iOS/macOS handoff
      console.log('Requesting camera permissions...');
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        console.log('Camera permissions granted by browser');
      } catch (mediaError) {
        console.error('Browser media permission error:', mediaError);
        throw mediaError;
      }
      
      // Small delay to allow permissions to be fully processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update device list after permissions are granted
      console.log('Updating device list...');
      await fetchDevices();
      
      // Another small delay before enabling camera
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Ensure audio context is ready before enabling camera
      try {
        if (roomContext?.room) {
          await roomContext.room.connectAudio();
          console.log('Audio context connected');
        }
      } catch (e) {
        console.warn('Audio context connection warning (non-fatal):', e);
        // Continue despite error
      }
      
      console.log('Enabling camera...');
      try {
        await localParticipant.setCameraEnabled(true);
        console.log('Camera enabled successfully');
        setCameraEnabled(true);
        setConnectionError(null);
      } catch (cameraError) {
        console.error('Error in setCameraEnabled call:', cameraError);
        
        // Check if this is a permissions error
        if (cameraError instanceof Error && 
            (cameraError.message.includes('permission') || 
             cameraError.message.includes('Permission'))) {
          throw new Error('insufficient permissions');
        }
        throw cameraError;
      }
    } catch (error) {
      console.error('Error enabling camera:', error);
      
      // Try to provide more detailed error information
      if (error instanceof Error) {
        console.error('Specific error:', error.message);
        
        if (error.message.toLowerCase().includes('permission')) {
          if (error.message.toLowerCase().includes('denied') || 
              error.message.toLowerCase().includes('not allowed')) {
            // Browser permission denied
            setConnectionError('Camera permission denied by browser. Please allow camera access in your browser settings.');
          } else {
            // Likely a LiveKit permission issue
            setConnectionError('Your token lacks permissions to publish video. Click "Reconnect with New Token" to obtain proper permissions.');
            setPermissionsError(true);
            
            // Remove auto-refresh token and just log what would have happened
            console.log('Permission error detected. Would normally refresh token automatically, but waiting for user action instead.');
            /* Commented out automatic refresh
            setTimeout(() => {
              if (refreshTokenRef.current) {
                refreshTokenRef.current();
              } else {
                console.error('RefreshToken function not available for auto-refresh');
                // Fallback to page reload
                sessionStorage.setItem('livekit_needs_new_token', 'true');
                window.location.reload();
              }
            }, 1000); // Slight delay to allow UI to update
            */
          }
        } else if (error.message.includes('insufficient permissions')) {
          setConnectionError('Your token lacks permissions to publish video. Click "Reconnect with New Token" to obtain proper permissions.');
          setPermissionsError(true);
          
          // Remove auto-refresh token with delay
          console.log('Insufficient permissions detected. Would normally refresh token automatically, but waiting for user action instead.');
          /* Commented out automatic refresh
          setTimeout(() => {
            if (refreshTokenRef.current) {
              refreshTokenRef.current();
            } else {
              console.error('RefreshToken function not available for auto-refresh');
              // Fallback to page reload
              sessionStorage.setItem('livekit_needs_new_token', 'true');
              window.location.reload();
            }
          }, 1000);
          */
        } else if (
          // iOS-specific errors
          error.message.includes('NotReadableError') || 
          error.message.includes('NotAllowedError') ||
          error.message.includes('NotFoundError')
        ) {
          setConnectionError('Camera access error. If using an iPhone, ensure Continuity Camera is enabled.');
          // Try iOS handoff automatically
          handleiOSHandoff().catch(e => console.error('iOS handoff failed:', e));
        } else {
          setConnectionError(`Failed to enable camera: ${error.message}`);
        }
      } else {
        setConnectionError('Failed to enable camera. Please check your permissions and ensure your camera is connected.');
      }
    }
  }, [localParticipant, fetchDevices, roomContext?.room, handleiOSHandoff]);
  
  // Toggle camera function with better error handling
  const toggleCamera = useCallback(async () => {
    try {
      if (!localParticipant) return;
      
      const enabled = !cameraEnabled;
      
      if (enabled) {
        // First check if we have permissions - this helps with iOS/macOS handoff
        await navigator.mediaDevices.getUserMedia({ video: true });
        
        // Update device list after permissions are granted
        await fetchDevices();
      }
      
      await localParticipant.setCameraEnabled(enabled);
      setCameraEnabled(enabled);
      if (enabled) setConnectionError(null);
    } catch (error) {
      console.error('Error toggling camera:', error);
      setConnectionError('Failed to toggle camera. Please check your device permissions.');
    }
  }, [localParticipant, cameraEnabled, fetchDevices]);
  
  // Toggle microphone function with better error handling
  const toggleMicrophone = useCallback(async () => {
    try {
      if (!localParticipant) return;
      
      const enabled = !micEnabled;
      
      if (enabled) {
        // First check if we have permissions - this helps with iOS/macOS handoff
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Update device list after permissions are granted
        await fetchDevices();
      }
      
      await localParticipant.setMicrophoneEnabled(enabled);
      setMicEnabled(enabled);
    } catch (error) {
      console.error('Error toggling microphone:', error);
      setConnectionError('Failed to toggle microphone. Please check your device permissions.');
    }
  }, [localParticipant, micEnabled, fetchDevices]);

  // Monitor camera and microphone state
  useEffect(() => {
    if (!localParticipant) return;
    
    const updateDeviceState = () => {
      setCameraEnabled(localParticipant.isCameraEnabled);
      setMicEnabled(localParticipant.isMicrophoneEnabled);
    };
    
    // Initial state
    updateDeviceState();
    
    // Subscribe to track events
    const handleTrackPublished = () => {
      updateDeviceState();
    };
    
    const handleTrackUnpublished = () => {
      updateDeviceState();
    };
    
    localParticipant.on('trackPublished', handleTrackPublished);
    localParticipant.on('trackUnpublished', handleTrackUnpublished);
    
    return () => {
      // Check if localParticipant still exists before removing listeners
      if (localParticipant) {
        localParticipant.off('trackPublished', handleTrackPublished);
        localParticipant.off('trackUnpublished', handleTrackUnpublished);
      }
    };
  }, [localParticipant]);

  // Auto-enable camera on component mount
  useEffect(() => {
    // Small delay to ensure room is fully connected
    const timer = setTimeout(() => {
      if (localParticipant && !cameraEnabled && !micEnabled) {
        enableCamera().catch(err => {
          console.error('Auto-enable camera failed:', err);
        });
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [localParticipant, cameraEnabled, micEnabled, enableCamera]);

  useEffect(() => {
    if (connectionState === ConnectionState.Failed) {
      setConnectionError('Failed to connect to video conference. Please check your connection and try again.');
    }
  }, [connectionState]);

  // Toggle device selector
  const toggleDeviceSelector = useCallback(() => {
    setShowDeviceSelector(prev => !prev);
  }, []);

  // Handle clicks within this component
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Global error handler for LiveKit errors - capture errors that might occur outside Room context
  useEffect(() => {
    const handleGlobalError = async (event: ErrorEvent) => {
      // Filter for LiveKit-related errors
      if (event.error?.message?.includes('Context is closed') || 
          event.error?.message?.includes('insufficient permissions') ||
          event.error?.message?.includes('Failed to execute') ||
          event.error?.stack?.includes('livekit-client_esm_mjs')) {
        
        console.warn('Detected LiveKit error via window event:', event.error);
        
        // Don't try auto-reconnection too many times
        errorCountRef.current += 1;
        
        if (errorCountRef.current > 5) {
          console.error('Too many LiveKit errors, please refresh the page manually');
          return;
        }
        
        // Handle context closed errors automatically by attempting token refresh
        if (!autoReconnectAttempted && 
           (event.error?.message?.includes('Context is closed') || 
            event.error?.message?.includes('insufficient permissions'))) {
          
          setAutoReconnectAttempted(true);
          console.log('Attempting automatic recovery from LiveKit error...');
          
          // Try several recovery strategies in sequence
          try {
            // 1. First try to reconnect audio context if available
            if (roomContext?.room) {
              console.log('Attempting to reset audio context...');
              try {
                // Force recreation of audio context if possible
                await roomContext.room.disconnectAudio();
                await new Promise(resolve => setTimeout(resolve, 500));
                await roomContext.room.connectAudio();
                console.log('Successfully reset audio context');
                
                // Wait to see if that fixed it
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // If we're still connected, don't proceed to more drastic measures
                if (roomContext.room.state === 'connected') {
                  console.log('Room still connected after audio reset, recovery may have succeeded');
                  return;
                }
              } catch (e) {
                console.warn('Error resetting audio context:', e);
                // Continue to next recovery strategy
              }
              
              // 2. Try to reconnect to the room
              try {
                console.log('Attempting room reconnection...');
                await roomContext.room.reconnect();
                console.log('Room reconnection successful');
                return;
              } catch (e) {
                console.warn('Room reconnection failed:', e);
                // Continue to final strategy
              }
            }
          } catch (e) {
            console.warn('Recovery attempts failed:', e);
          }
          
          // 3. If all else fails, reload the page
          console.log('All recovery attempts failed, but NOT automatically reloading page to allow error inspection');
          setConnectionError('LiveKit error detected. Please check console for details and refresh manually when ready.');
          /* Commented out automatic reload
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          */
        }
      }
    };
    
    window.addEventListener('error', handleGlobalError);
    
    return () => {
      window.removeEventListener('error', handleGlobalError);
    };
  }, [autoReconnectAttempted, roomContext?.room]);

  // Store room and identity information as soon as they're available
  useEffect(() => {
    if (roomContext?.room && roomContext.room.localParticipant) {
      // Save these for possible token refresh later
      userIdentityRef.current = roomContext.room.localParticipant.identity;
      roomNameRef.current = roomContext.room.name;
      
      console.log(`Room information captured: room=${roomContext.room.name}, identity=${roomContext.room.localParticipant.identity}`);
    }
  }, [roomContext?.room]);
  
  // Render component
  return (
    <div className="flex flex-col h-full bg-gray-900 text-white" onClick={handleContainerClick}>
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {!cameraEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
            <div className="text-center">
              <button
                onClick={enableCamera}
                className="px-4 py-2 mb-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Enable Camera
              </button>
              <p className="text-sm text-gray-300">Click to enable your camera</p>
            </div>
          </div>
        )}
        
        {connectionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/80 z-20">
            <div className="text-center p-4 max-w-md">
              <p className="mb-4">{connectionError}</p>
              {permissionsError && (
                <button
                  onClick={refreshTokenRef.current}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  disabled={isRefreshingToken}
                >
                  {isRefreshingToken ? 'Reconnecting...' : 'Reconnect with New Token'}
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Main video container */}
        <div className="relative w-full h-full">
          <div className="flex flex-wrap gap-2 p-2 overflow-auto h-full">
            {roomContext?.room ? (
              <div className="w-full h-full flex items-center justify-center">
                <LiveKitVideoConference />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-pulse">Connecting...</div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Controls at bottom */}
      <div className="p-2 bg-gray-800 flex justify-center items-center space-x-2">
        <button
          onClick={toggleMicrophone}
          className={`p-3 rounded-full ${micEnabled ? 'bg-blue-600' : 'bg-red-600'}`}
          title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {micEnabled ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23"></line>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          )}
        </button>
        
        <button
          onClick={toggleCamera}
          className={`p-3 rounded-full ${cameraEnabled ? 'bg-blue-600' : 'bg-red-600'}`}
          title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {cameraEnabled ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z"></path>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          )}
        </button>
        
        <button
          onClick={toggleDeviceSelector}
          className="p-3 rounded-full bg-gray-700"
          title="Choose devices"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
      
      {/* Device selector */}
      {showDeviceSelector && (
        <div className="p-3 bg-gray-800 border-t border-gray-700">
          <div className="mb-2">
            <label className="block text-sm mb-1">Camera</label>
            <select 
              className="w-full p-2 bg-gray-700 rounded"
              onChange={(e) => changeVideoDevice(e.target.value)}
            >
              {videoInputs.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm mb-1">Microphone</label>
            <select 
              className="w-full p-2 bg-gray-700 rounded"
              onChange={(e) => {
                if (localParticipant) {
                  localParticipant.setMicrophoneEnabled(true, { deviceId: e.target.value });
                }
              }}
            >
              {audioInputs.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      
      <RoomAudioRenderer />
    </div>
  );
} 