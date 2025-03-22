import React, { useState, useEffect, useCallback } from 'react';
import { VideoPresets } from 'livekit-client';

interface PreJoinProps {
  onJoin: (options: JoinOptions) => void;
  onError?: (error: Error) => void;
  username?: string;
}

export interface JoinOptions {
  username: string;
  videoEnabled: boolean;
  audioEnabled: boolean;
  videoDeviceId?: string;
  audioDeviceId?: string;
}

export default function PreJoin({ onJoin, onError, username = '' }: PreJoinProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDeviceId, setVideoDeviceId] = useState<string | undefined>(undefined);
  const [audioDeviceId, setAudioDeviceId] = useState<string | undefined>(undefined);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [name, setName] = useState(username);
  const [localVideo, setLocalVideo] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Get available media devices
  const getDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Request permissions first to ensure we get complete device lists
      try {
        // Try to get video permission
        if (videoEnabled) {
          const videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: {
              width: { ideal: VideoPresets.h720.width },
              height: { ideal: VideoPresets.h720.height }
            } 
          });
          setLocalVideo(videoStream);
          if (videoRef.current) {
            videoRef.current.srcObject = videoStream;
          }
        }
      } catch (e) {
        console.error('Failed to get video permissions:', e);
        setVideoEnabled(false);
        setPermissionError('Camera permission denied. Please check your browser settings.');
      }

      try {
        // Try to get audio permission
        if (audioEnabled) {
          await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      } catch (e) {
        console.error('Failed to get audio permissions:', e);
        setAudioEnabled(false);
        setPermissionError((prev) => prev ? `${prev} Microphone permission denied.` : 'Microphone permission denied.');
      }

      // Get list of devices after permissions
      const devices = await navigator.mediaDevices.enumerateDevices();
      setDevices(devices);
      
      // Set default devices if not already set
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const audioDevices = devices.filter(d => d.kind === 'audioinput');
      
      if (videoDevices.length > 0 && !videoDeviceId) {
        setVideoDeviceId(videoDevices[0].deviceId);
      }
      
      if (audioDevices.length > 0 && !audioDeviceId) {
        setAudioDeviceId(audioDevices[0].deviceId);
      }
      
      setIsLoading(false);
    } catch (e) {
      console.error('Error getting devices:', e);
      setIsLoading(false);
      if (onError && e instanceof Error) {
        onError(e);
      }
    }
  }, [videoEnabled, audioEnabled, onError, videoDeviceId, audioDeviceId]);

  // Get devices on mount and when permissions change
  useEffect(() => {
    getDevices();
    
    // Listen for device changes
    const handleDeviceChange = () => {
      getDevices();
    };
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      // Clean up video stream
      if (localVideo) {
        localVideo.getTracks().forEach(track => track.stop());
      }
    };
  }, [getDevices, localVideo]);

  // Update video preview when device changes
  useEffect(() => {
    if (!videoEnabled || !videoDeviceId) return;
    
    const updateVideoPreview = async () => {
      try {
        // Stop current tracks
        if (localVideo) {
          localVideo.getVideoTracks().forEach(track => track.stop());
        }
        
        // Get new stream with selected device
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: videoDeviceId,
            width: { ideal: VideoPresets.h720.width },
            height: { ideal: VideoPresets.h720.height }
          }
        });
        
        setLocalVideo(newStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (e) {
        console.error('Error updating video preview:', e);
        setVideoEnabled(false);
        setPermissionError('Failed to access camera. Please check your permissions.');
      }
    };
    
    updateVideoPreview();
  }, [videoDeviceId, videoEnabled]);

  const handleJoin = () => {
    // Clean up video stream
    if (localVideo) {
      localVideo.getTracks().forEach(track => track.stop());
    }
    
    onJoin({
      username: name,
      videoEnabled,
      audioEnabled,
      videoDeviceId,
      audioDeviceId,
    });
  };

  return (
    <div className="pre-join-container">
      <h2>Join Meeting</h2>
      
      {permissionError && (
        <div className="error-message">
          {permissionError}
        </div>
      )}
      
      <div className="video-preview-container">
        {videoEnabled ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="video-preview"
          />
        ) : (
          <div className="video-placeholder">
            Camera is disabled
          </div>
        )}
      </div>
      
      <div className="form-group">
        <label htmlFor="username">Name:</label>
        <input
          id="username"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          required
        />
      </div>
      
      <div className="form-group">
        <label>Camera:</label>
        <div className="device-controls">
          <input
            type="checkbox"
            id="video-toggle"
            checked={videoEnabled}
            onChange={(e) => setVideoEnabled(e.target.checked)}
          />
          <label htmlFor="video-toggle">Enable Camera</label>
          
          <select
            value={videoDeviceId}
            onChange={(e) => setVideoDeviceId(e.target.value)}
            disabled={!videoEnabled || isLoading}
          >
            {devices
              .filter(device => device.kind === 'videoinput')
              .map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                </option>
              ))}
          </select>
        </div>
      </div>
      
      <div className="form-group">
        <label>Microphone:</label>
        <div className="device-controls">
          <input
            type="checkbox"
            id="audio-toggle"
            checked={audioEnabled}
            onChange={(e) => setAudioEnabled(e.target.checked)}
          />
          <label htmlFor="audio-toggle">Enable Microphone</label>
          
          <select
            value={audioDeviceId}
            onChange={(e) => setAudioDeviceId(e.target.value)}
            disabled={!audioEnabled || isLoading}
          >
            {devices
              .filter(device => device.kind === 'audioinput')
              .map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                </option>
              ))}
          </select>
        </div>
      </div>
      
      <button
        onClick={handleJoin}
        disabled={isLoading || !name}
        className="join-button"
      >
        Join Meeting
      </button>
      
      <style jsx>{`
        .pre-join-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        
        h2 {
          text-align: center;
          margin-bottom: 20px;
        }
        
        .error-message {
          background-color: #ffeeee;
          color: #cc0000;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
          text-align: center;
        }
        
        .video-preview-container {
          width: 100%;
          height: 240px;
          margin-bottom: 20px;
          background-color: #000;
          border-radius: 4px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .video-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .video-placeholder {
          color: #fff;
          text-align: center;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }
        
        input[type="text"] {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        .device-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        select {
          flex: 1;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        .join-button {
          width: 100%;
          padding: 10px;
          background-color: #0070f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          margin-top: 20px;
        }
        
        .join-button:hover {
          background-color: #0060df;
        }
        
        .join-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
} 