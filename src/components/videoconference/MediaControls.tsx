"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useVideoConferenceContext } from '@/contexts/VideoConferenceContext';
import { log } from './VideoLogger';

interface MediaControlsProps {
  onError: (message: string) => void;
}

export const useMediaControls = ({ 
  onError 
}: MediaControlsProps) => {
  const videoConferenceContext = useVideoConferenceContext();
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [permissionsError, setPermissionsError] = useState(false);
  
  // Refs to break circular dependencies
  const changeVideoDeviceRef = useRef<(deviceId: string) => Promise<void>>(null!);
  
  // Function to initialize audio context
  const initializeAudioContext = useCallback(() => {
    // Create and resume AudioContext on user interaction
    try {
      // Use any here to avoid complex web audio API typing issues
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      
      if (AudioContext) {
        const audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().then(() => {
            log.info('AudioContext resumed successfully');
          }).catch(err => {
            log.warn('Failed to resume AudioContext:', err);
          });
        }
      }
    } catch (e) {
      log.warn('Error initializing AudioContext:', e);
    }
  }, []);
  
  // Set camera device
  const changeVideoDevice = useCallback(async (deviceId: string) => {
    try {
      if (!videoConferenceContext?.room) return;
      
      // Stop any existing tracks first
      if (cameraEnabled) {
        await videoConferenceContext.room.localParticipant.setCameraEnabled(false);
      }
      
      log.info('Attempting to change camera to:', deviceId);
      
      // Try to get media stream first to ensure device is available
      await navigator.mediaDevices.getUserMedia({ 
        video: { deviceId: { exact: deviceId } } 
      });
      
      // Use the selected device
      await videoConferenceContext.room.localParticipant.setCameraEnabled(true, {
        deviceId: deviceId
      });
      
      setCameraEnabled(true);
      setPermissionsError(false);
      setShowDeviceSelector(false);
    } catch (error) {
      log.error('Error changing camera device:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Permission')) {
          onError('Camera permission denied. Please allow camera access in your browser settings.');
        } else if (error.message.includes('insufficient permissions')) {
          onError('Your token lacks permissions to publish video. Please refresh and try again.');
          setPermissionsError(true);
        } else {
          onError(`Failed to switch camera: ${error.message}`);
        }
      } else {
        onError('Failed to switch camera. Please try again.');
      }
    }
  }, [videoConferenceContext?.room, cameraEnabled, onError]);
  
  // Set reference to the function to break circular dependency
  useEffect(() => {
    changeVideoDeviceRef.current = changeVideoDevice;
  }, [changeVideoDevice]);
  
  // Enable camera function
  const enableCamera = useCallback(async () => {
    setPermissionsError(false);
    setCameraEnabled(false);

    if (!videoConferenceContext || !videoConferenceContext.room) {
      log.warn('Room context not available when trying to enable camera');
      
      // Check if token is available but room isn't connected yet
      if (videoConferenceContext?.token) {
        log.info('We have token but room is not ready, waiting for connection...');
        
        // Wait for connection with timeout
        let connected = false;
        const timeout = setTimeout(() => {
          if (!connected) {
            onError('Connection timeout. Please refresh the page and try again.');
            setPermissionsError(true);
          }
        }, 20000); // Increase timeout to 20 seconds
        
        try {
          await new Promise<void>((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 20; // Increase max attempts
            const interval = setInterval(() => {
              attempts++;
              
              if (videoConferenceContext?.room) {
                clearInterval(interval);
                clearTimeout(timeout);
                connected = true;
                resolve();
              } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                clearTimeout(timeout);
                reject(new Error('Room connection timeout'));
              }
            }, 1000); // Check every second instead of 500ms
          });
          
          // Now try again with connected room
          return enableCamera();
        } catch (err) {
          log.error('Failed to connect to room', err);
          onError('Failed to connect to LiveKit room. Please check your internet connection and refresh the page.');
          setPermissionsError(true);
          return;
        }
      } else {
        // No token available
        log.warn('No active connection or token available - cannot enable camera');
        setPermissionsError(true);
        onError('Connection issue. Please refresh the page and try again.');
        return;
      }
    }
    
    try {
      // Room is available, proceed with enabling camera
      const room = videoConferenceContext.room;
      
      // Check if permission exists
      if (room.localParticipant.permissions && !room.localParticipant.permissions.canPublish) {
        log.warn('Insufficient permissions to publish video');
        setPermissionsError(true);
        onError('Your token lacks permissions to publish video. Please refresh the page.');
        return;
      }
      
      // Enable camera
      await room.localParticipant.setCameraEnabled(true);
      setCameraEnabled(true);
      
    } catch (err) {
      log.error('Failed to enable camera', err);
      setPermissionsError(true);
      
      // Properly handle the error based on its type
      if (err instanceof Error) {
        onError(err.message || 'Unknown error enabling camera');
      } else {
        onError('Unknown error enabling camera');
      }
    }
  }, [videoConferenceContext, onError]);
  
  // Toggle camera function
  const toggleCamera = useCallback(async () => {
    if (!videoConferenceContext?.room) {
      log.warn('No room available for toggle camera, attempting enableCamera instead');
      return enableCamera();
    }
    
    try {
      const localParticipant = videoConferenceContext.room.localParticipant;
      const newState = !cameraEnabled;
      
      await localParticipant.setCameraEnabled(newState);
      setCameraEnabled(newState);
      
    } catch (error) {
      log.error('Error toggling camera:', error);
      onError('Failed to toggle camera. Please try again.');
    }
  }, [videoConferenceContext, cameraEnabled, enableCamera, onError]);
  
  // Toggle microphone function
  const toggleMicrophone = useCallback(async () => {
    if (!videoConferenceContext?.room) {
      log.warn('No room available for toggle microphone');
      onError('Room not connected. Please refresh the page.');
      return;
    }
    
    try {
      const localParticipant = videoConferenceContext.room.localParticipant;
      const newState = !micEnabled;
      
      await localParticipant.setMicrophoneEnabled(newState);
      setMicEnabled(newState);
      
    } catch (error) {
      log.error('Error toggling microphone:', error);
      onError('Failed to toggle microphone. Please try again.');
    }
  }, [videoConferenceContext, micEnabled, onError]);
  
  // Monitor camera and microphone state
  useEffect(() => {
    if (!videoConferenceContext?.room?.localParticipant) return;
    
    const updateDeviceState = () => {
      setCameraEnabled(videoConferenceContext.room!.localParticipant.isCameraEnabled);
      setMicEnabled(videoConferenceContext.room!.localParticipant.isMicrophoneEnabled);
    };
    
    // Initial state
    updateDeviceState();
    
    const handleTrackPublished = () => {
      updateDeviceState();
    };
    
    const handleTrackUnpublished = () => {
      updateDeviceState();
    };
    
    videoConferenceContext.room.localParticipant.on('trackPublished', handleTrackPublished);
    videoConferenceContext.room.localParticipant.on('trackUnpublished', handleTrackUnpublished);
    
    return () => {
      // Check if localParticipant still exists before removing listeners
      if (videoConferenceContext.room?.localParticipant) {
        videoConferenceContext.room.localParticipant.off('trackPublished', handleTrackPublished);
        videoConferenceContext.room.localParticipant.off('trackUnpublished', handleTrackUnpublished);
      }
    };
  }, [videoConferenceContext?.room]);
  
  // Handle user interaction for audio context and camera
  const handleUserInteraction = useCallback(() => {
    initializeAudioContext();
    
    if (videoConferenceContext?.room && !cameraEnabled) {
      log.info('User interacted - trying to enable camera');
      enableCamera().catch(err => {
        log.error('Failed to enable camera on user interaction:', err);
      });
    }
  }, [videoConferenceContext?.room, cameraEnabled, enableCamera, initializeAudioContext]);
  
  // Add click handler for first user interaction
  useEffect(() => {
    if (!cameraEnabled && videoConferenceContext?.room) {
      document.addEventListener('click', handleUserInteraction, { once: true });
      
      return () => {
        document.removeEventListener('click', handleUserInteraction);
      };
    }
  }, [cameraEnabled, videoConferenceContext?.room, handleUserInteraction]);
  
  // Toggle device selector
  const toggleDeviceSelector = useCallback(() => {
    setShowDeviceSelector(prev => !prev);
  }, []);
  
  // Change audio device
  const changeAudioDevice = useCallback((deviceId: string) => {
    if (!videoConferenceContext?.room) return;
    
    try {
      videoConferenceContext.room.localParticipant.setMicrophoneEnabled(true, { 
        deviceId: deviceId 
      });
      setMicEnabled(true);
    } catch (error) {
      log.error('Error changing microphone device:', error);
      onError('Failed to switch microphone. Please try again.');
    }
  }, [videoConferenceContext?.room, onError]);
  
  return {
    cameraEnabled,
    micEnabled,
    showDeviceSelector,
    permissionsError,
    changeVideoDevice,
    changeAudioDevice,
    toggleCamera,
    toggleMicrophone,
    toggleDeviceSelector,
    enableCamera,
    initializeAudioContext,
    handleUserInteraction
  };
}; 