import { useCallback, useState, useEffect } from 'react';
import { log } from './VideoLogger';

// Interface for media device info
export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: string;
}

export interface DeviceManagerState {
  videoInputs: MediaDeviceInfo[];
  audioInputs: MediaDeviceInfo[];
  fetchDevices: () => Promise<void>;
}

/**
 * Custom hook to manage media devices
 */
export const useDeviceManager = (): DeviceManagerState => {
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  
  // Fetch available devices
  const fetchDevices = useCallback(async () => {
    try {
      // Request permission first to ensure labels are populated
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch (_) {
        log.info('Initial permission request may have been denied, continuing...');
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
      
      log.info('Available devices updated:', videoDevices.length, 'video,', audioDevices.length, 'audio');
      
      // Log specific iPhone/Mac device details for debugging
      const iosDevices = videoDevices.filter(d => 
        d.label.includes('iPhone') || 
        d.label.includes('iPad') || 
        d.label.includes('Continuity')
      );
      
      if (iosDevices.length > 0) {
        log.info('iOS devices found:', iosDevices.map(d => d.label));
      }
      
      setVideoInputs(videoDevices);
      setAudioInputs(audioDevices);
      
    } catch (error) {
      log.error('Error enumerating devices:', error);
    }
  }, []);
  
  // Listen for device changes
  useEffect(() => {
    fetchDevices();
    
    // Update device list when devices change
    const handleDeviceChange = () => {
      log.info('Device change detected - refreshing device list');
      fetchDevices();
    };
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [fetchDevices]);
  
  return {
    videoInputs,
    audioInputs,
    fetchDevices,
  };
};

/**
 * Helper function to detect iOS continuity devices (Handoff feature)
 */
export const findIOSDevices = (videoInputs: MediaDeviceInfo[]): MediaDeviceInfo | null => {
  const iosDevices = videoInputs.filter(d => 
    d.label.includes('iPhone') || 
    d.label.includes('iPad') || 
    d.label.includes('Continuity')
  );
  
  return iosDevices.length > 0 ? iosDevices[0] : null;
}; 