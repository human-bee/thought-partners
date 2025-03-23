"use client";

import React from 'react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { VideoConferenceProvider } from '@/contexts/VideoConferenceContext';
import CollaborativeBoard from '@/components/CollaborativeBoard';
import VideoConference from '@/components/VideoConference';
import JoinRoomForm from '@/components/JoinRoomForm';
import { Room } from 'livekit-client';
import { clientEnv } from '@/utils/clientEnv';

// Dynamically import components to reduce initial load time and prevent unnecessary renders
const LiveKitRoom = dynamic(() => import('@livekit/components-react').then(mod => mod.LiveKitRoom), { ssr: false });
const LiveKitInitializer = dynamic(() => import('@/components/LiveKitInitializer'), { ssr: false });
const Transcription = dynamic(() => import('@/components/Transcription'), { ssr: false });
const LiveKitDebugger = dynamic(() => import('@/components/LiveKitDebugger'), { ssr: false });

export default function WhiteboardRoom() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [token, setToken] = useState<string | null>(null);
  const [showVideoPanel, setShowVideoPanel] = useState(true);
  const [showTranscription, setShowTranscription] = useState(false);
  const [showDebugger, setShowDebugger] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const tokenUpdateRequestedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [liveKitError, setLiveKitError] = useState<string | null>(null);
  const [needTokenRefresh, setNeedTokenRefresh] = useState(false);
  
  // Initialize audio context and attach to user interaction
  useEffect(() => {
    const initAudioContext = () => {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext && !audioContextRef.current) {
          audioContextRef.current = new AudioContext();
          
          // Make sure it's suspended until user interaction
          if (audioContextRef.current.state === 'running') {
            audioContextRef.current.suspend().catch(console.error);
          }
        }
      } catch (error) {
        console.warn('Error initializing AudioContext:', error);
      }
    };
    
    // Create the audio context on mount
    initAudioContext();
    
    // Handle user interaction to resume audio context
    const handleUserInteraction = () => {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume().catch(console.error);
        console.log('AudioContext resumed after user interaction');
      }
    };
    
    // Add listeners for various user interactions
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      
      // Close the audio context on unmount
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (error) {
          console.warn('Error closing AudioContext:', error);
        }
      }
    };
  }, []);
  
  // Check for stored token on mount (enables token refresh flow)
  useEffect(() => {
    // Only run this effect once on initial mount
    if (typeof window !== 'undefined' && !tokenUpdateRequestedRef.current) {
      // Check if we need a new token due to permission issues
      const needsNewToken = sessionStorage.getItem('livekit_needs_new_token');
      if (needsNewToken === 'true') {
        console.log('Token needs refresh: clearing stored token');
        sessionStorage.removeItem('livekit_needs_new_token');
        sessionStorage.removeItem('livekit_token');
        return;
      }
      
      const storedToken = sessionStorage.getItem('livekit_token');
      if (storedToken) {
        console.log('Found stored token, using it for connection');
        setToken(storedToken);
      }
    }
  }, []);
  
  const handleJoin = useCallback((newToken: string) => {
    if (!newToken || newToken === '{}' || newToken === 'undefined') {
      console.error('Invalid token received in handleJoin:', newToken);
      return;
    }
    
    // Store token in session storage for potential reuse/debugging
    sessionStorage.setItem('livekit_token', newToken);
    console.log('New token received and stored in session storage');
    
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
  
  const toggleDebugger = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDebugger(prev => !prev);
  }, []);
  
  // This helps prevent context closing issues
  const handleRoomCreate = useCallback((room: Room) => {
    if (!room) {
      console.warn('Room object was undefined in handleRoomCreate');
      return;
    }
    
    roomRef.current = room;
    console.log('Room created and connected:', room?.name || 'unnamed room');
    
    // Handle window events to prevent context issues
    const handleBeforeUnload = () => {
      if (roomRef.current) {
        try {
          // Properly disconnect from room
          roomRef.current.disconnect(true);
          roomRef.current = null;
        } catch (err) {
          console.error('Error disconnecting room in beforeunload:', err);
        }
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
    
    try {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    } catch (err) {
      console.warn('Could not add devicechange listener:', err);
    }
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      try {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      } catch (err) {
        console.warn('Could not remove devicechange listener:', err);
      }
    };
  }, []);

  // Handle server URL setup - ensure it has proper protocol
  const safeServerUrl = useMemo(() => {
    let url = clientEnv.NEXT_PUBLIC_LIVEKIT_URL || '';
    
    // Make sure URL has the wss:// protocol prefix for WebSocket connection
    if (url && !url.startsWith('wss://') && !url.startsWith('ws://')) {
      url = `wss://${url}`;
    }
    
    // Use console.log for debugging
    console.log('LiveKit URL:', url);
    
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
  const handleLiveKitError = useCallback((error: Error) => {
    console.error('LiveKit error:', error);
    setLiveKitError(error.message);
    
    // Check if we need to refresh the token
    if (error.message.includes('token expired') || error.message.includes('permission')) {
      // Set flag to indicate we need a new token
      sessionStorage.setItem('livekit_needs_new_token', 'true');
      setNeedTokenRefresh(true);
    }
  }, []);
  
  // Debug log to check if the URL is properly set
  useEffect(() => {
    if (!safeServerUrl) {
      console.error('LiveKit URL is not provided. Check your environment variables.');
    } else {
      console.log('Using LiveKit URL:', safeServerUrl);
    }
  }, [safeServerUrl]);

  return (
    <VideoConferenceProvider serverUrl={safeServerUrl}>
      <div className="flex flex-col h-screen w-full bg-gray-100">
        {!token ? (
          <JoinRoomForm roomId={roomId} onJoin={handleJoin} />
        ) : (
          <>
            {tokenString && (
              <LiveKitRoom
                token={tokenString}
                serverUrl={safeServerUrl}
                onError={handleLiveKitError}
                onConnected={() => {
                  console.log('LiveKitRoom connected');
                  const livekit = (window as any).livekit;
                  if (livekit?.room) {
                    roomRef.current = livekit.room;
                    handleRoomCreate(livekit.room);
                  }
                }}
                onDisconnected={() => {
                  console.log('LiveKitRoom disconnected - room may need reconnection');
                  if (roomRef.current) {
                    roomRef.current = null;
                  }
                }}
                // Ensure proper cleanup on disconnect
                options={{
                  adaptiveStream: true,
                  dynacast: true,
                  stopLocalTrackOnUnpublish: true,
                }}
                // Update: Make token explicitly available in room context
                data-token={tokenString}
                connectOptions={{
                  autoSubscribe: true,
                  rtcConfig: {
                    iceTransportPolicy: 'all',
                    // Add more STUN/TURN servers for better connectivity
                    iceServers: [
                      { urls: 'stun:stun.l.google.com:19302' },
                      { urls: 'stun:stun1.l.google.com:19302' },
                      { urls: 'stun:stun2.l.google.com:19302' },
                      { urls: 'stun:stun3.l.google.com:19302' },
                      { urls: 'stun:stun4.l.google.com:19302' },
                    ],
                  },
                  // Set timeouts here in connect options using proper names
                  peerConnectionTimeout: 60000, // 60 seconds
                }}
              >
                <LiveKitInitializer />
                <div className="flex-1 relative" style={{ backgroundColor: "#ffffff", height: "100%", width: "100%" }}>
                  <div className="absolute inset-0 z-0">
                    <CollaborativeBoard roomId={roomId} />
                  </div>
                  
                  {/* Debug tools */}
                  <div className="absolute top-4 right-4 z-50 flex gap-2">
                    <button 
                      onClick={toggleDebugger}
                      className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-xs"
                    >
                      {showDebugger ? 'Hide Debug' : 'Show Debug'}
                    </button>
                  </div>
                  
                  {/* LiveKit debugger */}
                  {showDebugger && <LiveKitDebugger />}
                  
                  {/* Video conference UI */}
                  <div className="absolute bottom-4 right-4 z-10" style={{ width: "300px", height: "225px" }}>
                    <VideoConference />
                  </div>
                </div>
              </LiveKitRoom>
            )}
          </>
        )}
      </div>
    </VideoConferenceProvider>
  );
} 