"use client";

import {
  RoomAudioRenderer,
  VideoConference as LiveKitVideoConference,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { useState, useCallback } from 'react';
import { useVideoConferenceContext } from '@/contexts/VideoConferenceContext';

import { useDeviceManager } from './DeviceManager';
import { useMediaControls } from './MediaControls';
import { useConnectionManager } from './ConnectionManager';
import { MediaControlsUI } from './MediaControlsUI';
import { ErrorUI, CameraDisabledUI } from './ErrorUI';

export default function VideoConference() {
  const videoConferenceContext = useVideoConferenceContext();
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Handle errors
  const handleError = useCallback((message: string) => {
    setConnectionError(message);
  }, []);
  
  // Clear errors
  const handleRecovery = useCallback(() => {
    setConnectionError(null);
  }, []);
  
  // Set up device manager
  const deviceManager = useDeviceManager();
  
  // Set up connection manager
  const connectionManager = useConnectionManager({
    onError: handleError,
    onRecovery: handleRecovery
  });
  
  // Set up media controls
  const mediaControls = useMediaControls({
    onError: handleError
  });
  
  // Handle container clicks to prevent event bubbling
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);
  
  // Render component
  return (
    <div className="flex flex-col h-full bg-gray-900 text-white rounded-lg shadow-lg overflow-hidden border border-gray-700" onClick={handleContainerClick}>
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {!mediaControls.cameraEnabled && (
          <CameraDisabledUI 
            onEnableCamera={mediaControls.enableCamera}
            initializeAudioContext={mediaControls.initializeAudioContext}
          />
        )}
        
        <ErrorUI
          connectionError={connectionError}
          permissionsError={mediaControls.permissionsError || connectionManager.permissionsError}
          isRefreshingToken={connectionManager.isRefreshingToken}
          onRefreshToken={connectionManager.refreshToken}
        />
        
        {/* Main video container */}
        <div className="relative w-full h-full">
          <div className="flex flex-wrap gap-2 p-2 overflow-auto h-full">
            {videoConferenceContext?.room ? (
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
      
      <MediaControlsUI
        cameraEnabled={mediaControls.cameraEnabled}
        micEnabled={mediaControls.micEnabled}
        toggleCamera={mediaControls.toggleCamera}
        toggleMicrophone={mediaControls.toggleMicrophone}
        toggleDeviceSelector={mediaControls.toggleDeviceSelector}
        showDeviceSelector={mediaControls.showDeviceSelector}
        videoInputs={deviceManager.videoInputs}
        audioInputs={deviceManager.audioInputs}
        onChangeVideoDevice={mediaControls.changeVideoDevice}
        onChangeAudioDevice={mediaControls.changeAudioDevice}
      />
      
      <RoomAudioRenderer />
    </div>
  );
} 