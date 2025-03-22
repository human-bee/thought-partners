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
import { Room, RoomEvent, LocalTrackPublication, Participant, Track as LKTrack, VideoPresets } from 'livekit-client';
import '@livekit/components-styles';
import { useState, useEffect, useCallback, useRef } from 'react';

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
  const connectionState = useConnectionState();
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const roomContext = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  
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
  
  const userIdentityRef = useRef<string | null>(null);
  const roomNameRef = useRef<string | null>(null);
  const errorCountRef = useRef(0);
  
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
        } else {
          setConnectionError(`Failed to switch camera: ${error.message}`);
        }
      } else {
        setConnectionError('Failed to switch camera. Please try again.');
      }
    }
  }, [localParticipant, cameraEnabled]);
  
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
  
  // Store room reference to prevent context closed errors
  useEffect(() => {
    if (roomContext?.room) {
      roomRef.current = roomContext.room;
      
      // Store room information for reconnection
      if (roomContext.room.localParticipant) {
        userIdentityRef.current = roomContext.room.localParticipant.identity;
        roomNameRef.current = roomContext.room.name;
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
            setTimeout(() => refreshToken(), 1000);
          }
        } else if (error.message.includes('insufficient permissions')) {
          setConnectionError('Permission issue detected: Your token lacks necessary video/audio publishing permissions.');
          setPermissionsError(true);
          console.log('Debug - Current permissions:', roomContext.room.localParticipant.permissions);
          
          // Automatically attempt to refresh token after permission error
          if (!autoReconnectAttempted && errorCountRef.current <= 3) {
            setAutoReconnectAttempted(true);
            console.log('Automatically attempting to refresh token with proper permissions...');
            setTimeout(() => refreshToken(), 1000);
          }
        }
      };
      
      // Catch all possible error events
      roomContext.room.on(RoomEvent.MediaDevicesError, handleError);
      roomContext.room.on(RoomEvent.TrackPublicationError, handleError);
      roomContext.room.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Disconnected || state === ConnectionState.Failed) {
          setNeedsReconnect(true);
          
          // Auto reconnect on disconnection
          if (state === ConnectionState.Failed && !autoReconnectAttempted && errorCountRef.current <= 3) {
            setAutoReconnectAttempted(true);
            console.log('Connection failed, attempting automatic recovery...');
            setTimeout(() => refreshToken(), 1000);
          }
        }
      });
      
      // Additional error handlers for audio context issues
      roomContext.room.on(RoomEvent.AudioPlaybackStatusChanged, (status) => {
        console.log('Audio playback status changed:', status);
        if (!status) {
          console.warn('Audio playback stopped - this might indicate a context closed error');
        }
      });
      
      return () => {
        if (roomRef.current) {
          roomRef.current.off(RoomEvent.MediaDevicesError, handleError);
          roomRef.current.off(RoomEvent.TrackPublicationError, handleError);
          roomRef.current.off(RoomEvent.ConnectionStateChanged);
          roomRef.current.off(RoomEvent.AudioPlaybackStatusChanged);
        }
      };
    }
  }, [roomContext?.room, refreshToken, autoReconnectAttempted]);

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
  
  // Enable camera function with better error handling
  const enableCamera = useCallback(async () => {
    try {
      if (!localParticipant) return;
      
      // First check if we have permissions - this helps with iOS/macOS handoff
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Update device list after permissions are granted
      await fetchDevices();
      
      await localParticipant.setCameraEnabled(true);
      setCameraEnabled(true);
      setConnectionError(null);
    } catch (error) {
      console.error('Error enabling camera:', error);
      setConnectionError('Failed to enable camera. Please check your permissions and ensure your camera is connected.');
    }
  }, [localParticipant, fetchDevices]);
  
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
      localParticipant.off('trackPublished', handleTrackPublished);
      localParticipant.off('trackUnpublished', handleTrackUnpublished);
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

  // Get a new token with proper permissions
  const refreshToken = useCallback(async () => {
    try {
      if (!roomContext?.room) return;
      
      // Store room information before disconnecting
      if (roomContext.room.localParticipant) {
        userIdentityRef.current = roomContext.room.localParticipant.identity;
        roomNameRef.current = roomContext.room.name;
      }
      
      // Set state to show loading
      setIsRefreshingToken(true);
      
      // Get a new token with explicit publishing permissions
      const response = await fetch('/api/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: roomNameRef.current,
          identity: userIdentityRef.current,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.token) {
        throw new Error(data.error || 'Failed to get new token');
      }
      
      // Disconnect properly from the room
      if (roomContext.room.isConnected) {
        await roomContext.room.disconnect(true);
      }
      
      // Reconnect with the new token (by reloading the page)
      console.log('Got new token with proper permissions, reloading page...');
      sessionStorage.setItem('livekit_token', data.token);
      window.location.reload();
      
    } catch (error) {
      console.error('Error refreshing token:', error);
      setConnectionError('Failed to get a new token. Please refresh the page manually.');
    } finally {
      setIsRefreshingToken(false);
    }
  }, [roomContext?.room]);

  // Global error handler for LiveKit errors - capture errors that might occur outside Room context
  useEffect(() => {
    const handleGlobalError = async (event: ErrorEvent) => {
      if (event.error?.message?.includes('Context is closed') || 
          event.error?.message?.includes('insufficient permissions') ||
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
          
          // Delay slightly to avoid immediate refresh that might cause issues
          setTimeout(() => {
            refreshToken();
          }, 1000);
        }
      }
    };
    
    window.addEventListener('error', handleGlobalError);
    
    return () => {
      window.removeEventListener('error', handleGlobalError);
    };
  }, [refreshToken, autoReconnectAttempted]);

  // Render component
  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-900 relative">
      <RoomAudioRenderer />
      
      {(connectionError || isRefreshingToken) && 
        <div className="absolute top-0 left-0 right-0 bg-red-600 text-white p-2 z-50">
          <p className="text-center">
            {isRefreshingToken 
              ? 'Attempting to reconnect with new permissions... Please wait.' 
              : connectionError}
          </p>
          {permissionsError && !isRefreshingToken && !autoReconnectAttempted && (
            <div className="flex flex-col items-center mt-2">
              <div className="flex justify-center mb-2 space-x-2">
                <button 
                  onClick={refreshToken}
                  disabled={isRefreshingToken || autoReconnectAttempted}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded transition-colors"
                >
                  {isRefreshingToken ? 'Reconnecting...' : 'Reconnect with New Token'}
                </button>
                <button 
                  onClick={() => window.location.reload()}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-1 rounded transition-colors"
                >
                  Retry Camera
                </button>
                <button 
                  onClick={() => {
                    // Reset error state
                    setConnectionError(null);
                    setPermissionsError(false);
                  }}
                  className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-1 rounded transition-colors"
                >
                  Close
                </button>
              </div>
              <p className="text-sm mt-1">
                <span className="font-semibold">iOS Device Tip:</span> If using iPhone camera, ensure Continuity Camera is enabled on both devices. 
                Check Settings → General → AirPlay & Handoff, and "Allow Handoff between this Mac and your iCloud devices" should be enabled.
              </p>
            </div>
          )}
          {autoReconnectAttempted && !isRefreshingToken && (
            <div className="text-center mt-2">
              <p className="text-sm">
                Automatic recovery attempted. If issues persist, please refresh the page manually.
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded transition-colors"
              >
                Refresh Page
              </button>
            </div>
          )}
        </div>
      }
      
      {showDeviceSelector && (
        <div className="m-4 p-3 bg-gray-800 text-white text-sm rounded-md">
          <h3 className="font-semibold mb-2">Select Camera</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {videoInputs.length === 0 ? (
              <p className="text-gray-400 text-xs">No cameras found</p>
            ) : (
              videoInputs.map(device => (
                <button 
                  key={device.deviceId}
                  onClick={() => changeVideoDevice(device.deviceId)}
                  className="block w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                >
                  {device.label}
                </button>
              ))
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <button 
              onClick={toggleDeviceSelector}
              className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {connectionState === ConnectionState.Connecting && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Connecting to room...</p>
          </div>
        </div>
      )}
      
      {(connectionState === ConnectionState.Connected || connectionState === ConnectionState.Reconnecting) && (
        <LayoutContextProvider>
          <div className="flex-1 relative flex flex-col" onClick={(e) => e.stopPropagation()}>
            {!cameraEnabled && !micEnabled && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-black bg-opacity-70">
                <div className="text-center p-4 bg-gray-800 rounded-lg">
                  <p className="mb-4">Share your camera and microphone to join the call</p>
                  <div className="space-y-2">
                    <button
                      onClick={enableCamera}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full"
                    >
                      Enable Camera
                    </button>
                    <button
                      onClick={toggleDeviceSelector}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 w-full"
                    >
                      Select Camera Source
                    </button>
                    <button
                      onClick={handleiOSHandoff}
                      className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 w-full"
                    >
                      Use iPhone/iPad Camera
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <SafeVideoConference />
            
            <div className="p-2 border-t border-gray-800">
              <div className="flex justify-center space-x-4">
                <button
                  onClick={toggleCamera}
                  className={`p-2 rounded-full ${cameraEnabled ? 'bg-blue-600' : 'bg-red-600'}`}
                  title={cameraEnabled ? "Turn camera off" : "Turn camera on"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {cameraEnabled ? (
                      <>
                        <path d="M23 7l-7 5 7 5V7z"></path>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                      </>
                    ) : (
                      <>
                        <path d="M23 7l-7 5 7 5V7z"></path>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </>
                    )}
                  </svg>
                </button>
                
                <button
                  onClick={toggleMicrophone}
                  className={`p-2 rounded-full ${micEnabled ? 'bg-blue-600' : 'bg-red-600'}`}
                  title={micEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {micEnabled ? (
                      <>
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        <line x1="12" y1="19" x2="12" y2="23"></line>
                        <line x1="8" y1="23" x2="16" y2="23"></line>
                      </>
                    ) : (
                      <>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .85-.13 1.67-.39 2.44"></path>
                        <line x1="12" y1="19" x2="12" y2="23"></line>
                        <line x1="8" y1="23" x2="16" y2="23"></line>
                      </>
                    )}
                  </svg>
                </button>
                
                <button
                  onClick={toggleDeviceSelector}
                  className="p-2 rounded-full bg-gray-700"
                  title="Select camera/microphone"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </LayoutContextProvider>
      )}
    </div>
  );
} 