"use client";

import { useState, useCallback, useRef, useEffect, useMemo, useId } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import JoinRoomForm from '@/components/JoinRoomForm';
import { Room } from 'livekit-client';

// Dynamically import components to reduce initial load time and prevent unnecessary renders
const CollaborativeBoard = dynamic(() => import('@/components/CollaborativeBoard'), { ssr: false });
const VideoConference = dynamic(() => import('@/components/VideoConference'), { ssr: false });
const Transcription = dynamic(() => import('@/components/Transcription'), { ssr: false });
const LiveKitRoom = dynamic(() => import('@livekit/components-react').then(mod => mod.LiveKitRoom), { ssr: false });
const LiveKitInitializer = dynamic(() => import('@/components/LiveKitInitializer'), { ssr: false });
const VideoConferenceProvider = dynamic(() => import('@/contexts/VideoConferenceContext').then(mod => mod.VideoConferenceProvider), { ssr: false });

export default function WhiteboardRoom() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [token, setToken] = useState<string | null>(null);
  const [showVideoPanel, setShowVideoPanel] = useState(true);
  const [showTranscription, setShowTranscription] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const tokenUpdateRequestedRef = useRef(false);
  
  // Check for stored token on mount (enables token refresh flow)
  useEffect(() => {
    // Only run this effect once on initial mount
    if (typeof window !== 'undefined' && !tokenUpdateRequestedRef.current) {
      // Check if we need a new token due to permission issues
      const needsNewToken = sessionStorage.getItem('livekit_needs_new_token');
      if (needsNewToken === 'true') {
        sessionStorage.removeItem('livekit_needs_new_token');
        sessionStorage.removeItem('livekit_token');
        return;
      }
      
      const storedToken = sessionStorage.getItem('livekit_token');
      if (storedToken) {
        setToken(storedToken);
        // Clear the stored token to prevent infinite loops if there are issues
        sessionStorage.removeItem('livekit_token');
      }
    }
  }, []);
  
  const handleJoin = useCallback((newToken: string) => {
    if (!newToken || newToken === '{}' || newToken === 'undefined') {
      console.error('Invalid token received in handleJoin:', newToken);
      return;
    }
    
    setToken(newToken);
  }, []);

  const toggleVideoPanel = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    setShowVideoPanel(prev => !prev);
  }, []);

  const toggleTranscription = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    setShowTranscription(prev => !prev);
  }, []);
  
  // This helps prevent context closing issues
  const handleRoomCreate = useCallback((room: Room) => {
    roomRef.current = room;
    
    // Handle window events to prevent context issues
    const handleBeforeUnload = () => {
      if (roomRef.current) {
        // Properly disconnect from room
        roomRef.current.disconnect(true);
      }
    };
    
    // Add specific device change listener to support handoff
    const handleDeviceChange = () => {
      // This will trigger LiveKit to update available devices
      if (roomRef.current && roomRef.current.localParticipant) {
        console.log('Device change detected, updating available devices');
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      // Ensure clean disconnection
      if (roomRef.current) {
        try {
          roomRef.current.disconnect(true);
        } catch (e) {
          console.warn('Error disconnecting from room:', e);
        }
      }
    };
  }, []);

  // Handle server URL setup once - never changes
  const safeServerUrl = useMemo(() => {
    let url = process.env.NEXT_PUBLIC_LIVEKIT_URL || '';
    
    // Make sure URL has the wss:// protocol prefix for WebSocket connection
    if (url && !url.startsWith('wss://') && !url.startsWith('ws://')) {
      url = `wss://${url}`;
    }
    
    return url;
  }, []);
  
  // Handle token validation once per token change and memoize the result 
  const tokenString = useMemo(() => {
    if (!token) return null;
    
    if (typeof token === 'object') {
      if (token === null || Object.keys(token).length === 0) {
        console.error('Invalid token object received:', token);
        return null;
      }
      return JSON.stringify(token);
    } 
    
    if (typeof token === 'string') {
      if (token === '{}' || token === 'undefined' || token === '') {
        console.error('Invalid token string received:', token);
        return null;
      }
      // Return the string directly - do not stringify again
      return token;
    }
    
    console.error('Token is neither object nor string:', token);
    return null;
  }, [token]);
  
  // Handle LiveKit errors with token refresh via state update
  const handleLiveKitError = useCallback((e: Error) => {
    console.error('LiveKitRoom connection error:', e);
    
    // Check if it's a token error
    if (e.message?.includes('token') || e.message?.includes('auth')) {
      console.error('Authentication error, token may be invalid');
      
      // Avoid immediate re-render during render phase
      if (!tokenUpdateRequestedRef.current) {
        tokenUpdateRequestedRef.current = true;
        
        // Force token refresh by clearing it - do this in a setTimeout to avoid render phase updates
        sessionStorage.setItem('livekit_needs_new_token', 'true');
        
        // Schedule token clearing for next event loop
        setTimeout(() => {
          setToken(null);
          tokenUpdateRequestedRef.current = false;
        }, 0);
      }
    }
  }, []);
  
  // Show JoinRoomForm if no token or invalid token
  if (!token || !tokenString) {
    return <JoinRoomForm roomId={roomId} onJoin={handleJoin} />;
  }

  return (
    <div className="h-screen" onClick={(e) => e.stopPropagation()}>
      <LiveKitRoom
        token={tokenString}
        serverUrl={safeServerUrl}
        connect={true}
        data-lk-theme="default"
        onConnected={handleRoomCreate}
        onDisconnected={(reason) => {
          console.log('LiveKit disconnected, reason:', reason);
        }}
        onError={handleLiveKitError}
        options={{ 
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: { width: 640, height: 480 },
            facingMode: 'user'
          },
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          publishDefaults: {
            dtx: true,
            videoSimulcastLayers: [
              { width: 320, height: 240, encoding: { maxBitrate: 150_000, maxFramerate: 15 } },
              { width: 640, height: 480, encoding: { maxBitrate: 500_000, maxFramerate: 30 } }
            ]
          },
          disconnectOnBrowserClose: false,
          disconnectOnPageUnload: false,
          audioEnabled: true,
          audioOutput: {
            deviceId: 'default',
          },
          stopMicTrackOnMute: false,
          suspendLocalVideoOnInactive: false,
          screenShareEnabled: true,
          activateInHiddenTab: true,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          startAudioMuted: true,
          startVideoMuted: true,
          reconnectPolicy: {
            maxRetries: 10,
            retryBackoff: 1.7,
            maxBackoff: 20
          }
        }}
      >
        <LiveKitInitializer />
        <div className="flex flex-col md:flex-row h-full">
          <div className={`${showVideoPanel ? 'w-full md:w-1/2' : 'w-full'} h-full relative`}>
            <CollaborativeBoard roomId={roomId} />
            
            {showTranscription && (
              <div className="absolute bottom-4 left-4 z-10 w-1/3 h-64 shadow-lg rounded-lg overflow-hidden">
                <Transcription />
              </div>
            )}
            
            <div className="absolute top-4 right-4 z-10 flex space-x-2" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={toggleTranscription}
                className="p-2 bg-gray-800 text-white rounded-full shadow-md hover:bg-gray-700"
                title={showTranscription ? "Hide transcript" : "Show transcript"}
                aria-label={showTranscription ? "Hide transcript" : "Show transcript"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </button>
              <button 
                onClick={toggleVideoPanel}
                className="p-2 bg-gray-800 text-white rounded-full shadow-md hover:bg-gray-700"
                title={showVideoPanel ? "Hide video panel" : "Show video panel"}
                aria-label={showVideoPanel ? "Hide video panel" : "Show video panel"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-video">
                  {showVideoPanel ? (
                    <>
                      <path d="M23 7l-7 5 7 5V7z"></path>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </>
                  ) : (
                    <>
                      <path d="M23 7l-7 5 7 5V7z"></path>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>
          {showVideoPanel && (
            <div className={`w-full md:w-1/2 bg-black relative`}>
              <VideoConferenceProvider 
                roomOptions={{
                  adaptiveStream: true,
                  dynacast: true,
                  videoCaptureDefaults: {
                    resolution: { width: 640, height: 480 },
                    facingMode: 'user'
                  },
                  audioCaptureDefaults: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                  }
                }}
                roomName={roomId}
              >
                <VideoConference />
              </VideoConferenceProvider>
            </div>
          )}
        </div>
      </LiveKitRoom>
    </div>
  );
} 