import React, { useEffect, useState, useRef } from 'react';
import { 
  Room, 
  RoomEvent, 
  ConnectionState, 
  ConnectionQuality,
  VideoPresets,
  RoomOptions
} from 'livekit-client';
import { LiveKitRoom as LiveKitRoomOriginal } from '@livekit/components-react';

interface Props {
  token: string;
  serverUrl: string;
  onConnected?: (room: Room) => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  children: React.ReactNode;
}

export const EnhancedLiveKitRoom: React.FC<Props> = ({
  token,
  serverUrl,
  onConnected,
  onDisconnected,
  onError,
  children,
}) => {
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  // Store token in session storage for potential reuse
  useEffect(() => {
    if (token) {
      sessionStorage.setItem('livekit_token', token);
    }
  }, [token]);

  const handleError = (err: Error) => {
    console.error('LiveKit room error:', err);
    setError(err);
    if (onError) onError(err);
  };

  const handleDisconnect = () => {
    console.log('LiveKit room disconnected');
    if (onDisconnected) onDisconnected();
  };

  const handleConnected = (room: Room) => {
    console.log('LiveKit room connected:', room.name);
    // Reset reconnect attempts on successful connection
    reconnectAttempts.current = 0;
    if (onConnected) onConnected(room);
  };

  const handleConnectionStateChanged = (state: ConnectionState) => {
    console.log('LiveKit connection state changed:', ConnectionState[state]);
    setConnectionState(state);
    
    if (state === ConnectionState.Reconnecting) {
      reconnectAttempts.current++;
      console.log(`LiveKit reconnecting attempt ${reconnectAttempts.current} of ${maxReconnectAttempts}`);
      
      if (reconnectAttempts.current > maxReconnectAttempts) {
        console.warn('LiveKit max reconnect attempts reached, will not retry further');
      }
    }
  };

  // Configure room options for optimal performance
  const roomOptions: RoomOptions = {
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
    },
    // Add connection timeout options
    connectionTimeout: 30000, // 30 seconds
  };

  if (!token || !serverUrl) {
    return (
      <div className="livekit-connection-error">
        <p>Missing LiveKit connection details (token or server URL)</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="livekit-error-message" style={{ 
          position: 'absolute', 
          bottom: '10px', 
          right: '10px',
          background: 'rgba(255,0,0,0.1)',
          color: 'red',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 1000
        }}>
          <p>LiveKit error: {error.message}</p>
        </div>
      )}
      
      <LiveKitRoomOriginal
        token={token}
        serverUrl={serverUrl}
        options={roomOptions}
        onError={handleError}
        onConnected={handleConnected}
        onDisconnected={handleDisconnect}
        connectionStateChanged={handleConnectionStateChanged}
        data-lk-theme="default"
      >
        {children}
      </LiveKitRoomOriginal>
    </>
  );
}; 