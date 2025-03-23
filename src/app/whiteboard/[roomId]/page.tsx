"use client";

import React from 'react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { VideoConferenceProvider } from '@/contexts/VideoConferenceContext';
import { TranscriptionProvider } from '@/contexts/TranscriptionContext';
import CollaborativeBoard from '@/components/CollaborativeBoard';
import VideoConference from '@/components/VideoConference';
import JoinRoomForm from '@/components/JoinRoomForm';
import { Room } from 'livekit-client';
import { clientEnv } from '@/utils/clientEnv';
import TranscriptionBoard from '@/components/TranscriptionBoard';

// Dynamically import components to reduce initial load time and prevent unnecessary renders
const LiveKitRoom = dynamic(() => import('@livekit/components-react').then(mod => mod.LiveKitRoom), { ssr: false });
const LiveKitInitializer = dynamic(() => import('@/components/LiveKitInitializer'), { ssr: false });
const LiveKitDebugger = dynamic(() => import('@/components/LiveKitDebugger'), { ssr: false });

interface WebKitWindow extends Window {
  webkitAudioContext: typeof AudioContext;
}

export default function WhiteboardRoom({ params }: { params: { roomId: string } }) {
  const roomId = params.roomId;
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const tokenUpdateRequestedRef = useRef(false);
  const [liveKitError, setLiveKitError] = useState<string | null>(null);
  const [needTokenRefresh, setNeedTokenRefresh] = useState(false);
  
  // Initialize audio context
  useEffect(() => {
    try {
      const AudioContext = window.AudioContext || (window as unknown as WebKitWindow).webkitAudioContext;
      if (AudioContext && !audioContext) {
        const newAudioContext = new AudioContext();
        if (newAudioContext.state === 'running') {
          newAudioContext.suspend().catch(console.error);
        }
        setAudioContext(newAudioContext);
      }
    } catch (error) {
      console.error('Error initializing AudioContext:', error);
    }

    const handleUserInteraction = () => {
      if (audioContext?.state === 'suspended') {
        audioContext.resume().catch(console.error);
      }
    };

    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction);

    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      if (audioContext) {
        try {
          audioContext.close();
        } catch (error) {
          console.warn('Error closing AudioContext:', error);
        }
      }
    };
  }, [audioContext]);
  
  // Check for stored token on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !tokenUpdateRequestedRef.current) {
      const needsNewToken = sessionStorage.getItem('livekit_needs_new_token');
      if (needsNewToken === 'true') {
        sessionStorage.removeItem('livekit_needs_new_token');
        sessionStorage.removeItem('livekit_token');
        return;
      }
      
      const storedToken = sessionStorage.getItem('livekit_token');
      if (storedToken) {
        setToken(storedToken);
      }
    }
  }, []);
  
  const handleJoin = useCallback((newToken: string) => {
    if (!newToken || newToken === '{}' || newToken === 'undefined') {
      console.error('Invalid token received in handleJoin:', newToken);
      return;
    }
    
    sessionStorage.setItem('livekit_token', newToken);
    setToken(newToken);
  }, []);

  const handleRoomCreate = useCallback((room: Room) => {
    if (!room) return;
    
    roomRef.current = room;
    
    const handleBeforeUnload = () => {
      if (roomRef.current) {
        try {
          roomRef.current.disconnect(true);
          roomRef.current = null;
        } catch (err) {
          console.error('Error disconnecting room:', err);
        }
      }
    };
    
    const handleDeviceChange = () => {
      if (roomRef.current && roomRef.current.localParticipant) {
        console.log('Device change detected');
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

  const safeServerUrl = useMemo(() => {
    let url = clientEnv.NEXT_PUBLIC_LIVEKIT_URL || '';
    if (url && !url.startsWith('wss://') && !url.startsWith('ws://')) {
      url = `wss://${url}`;
    }
    return url;
  }, []);
  
  const tokenString = useMemo(() => {
    if (!token) return null;
    
    if (typeof token === 'object') {
      if (token === null || Object.keys(token).length === 0) {
        return null;
      }
      return JSON.stringify(token);
    } 
    
    if (typeof token === 'string') {
      if (token === '{}' || token === 'undefined' || token === '') {
        return null;
      }
      return token;
    }
    
    return null;
  }, [token]);
  
  const handleLiveKitError = useCallback((error: Error) => {
    console.error('LiveKit error:', error);
    setLiveKitError(error.message);
    
    if (error.message.includes('token expired') || error.message.includes('permission')) {
      sessionStorage.setItem('livekit_needs_new_token', 'true');
      setNeedTokenRefresh(true);
    }
  }, []);

  return (
    <VideoConferenceProvider serverUrl={safeServerUrl}>
      <div className="flex flex-col h-screen w-full bg-gray-100">
        {!token ? (
          <JoinRoomForm roomId={roomId} onJoin={handleJoin} />
        ) : (
          <>
            {tokenString && (
              <TranscriptionProvider>
                <LiveKitRoom
                  token={tokenString}
                  serverUrl={safeServerUrl}
                  onError={handleLiveKitError}
                  onConnected={() => {
                    const livekit = (window as unknown as { livekit?: { room?: Room } }).livekit;
                    if (livekit?.room) {
                      roomRef.current = livekit.room;
                      handleRoomCreate(livekit.room);
                    }
                  }}
                  onDisconnected={() => {
                    if (roomRef.current) {
                      roomRef.current = null;
                    }
                  }}
                  options={{
                    adaptiveStream: true,
                    dynacast: true,
                    stopLocalTrackOnUnpublish: true,
                  }}
                  data-token={tokenString}
                  connectOptions={{
                    autoSubscribe: true,
                    rtcConfig: {
                      iceTransportPolicy: 'all',
                      iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:stun3.l.google.com:19302' },
                        { urls: 'stun:stun4.l.google.com:19302' },
                      ],
                    },
                    peerConnectionTimeout: 60000,
                  }}
                >
                  <LiveKitInitializer />
                  <div className="flex-1 relative" style={{ backgroundColor: "#ffffff", height: "100%", width: "100%" }}>
                    <div className="absolute inset-0 z-0">
                      <CollaborativeBoard roomId={roomId} />
                    </div>
                    
                    <TranscriptionBoardWrapper roomId={roomId} />
                  </div>
                </LiveKitRoom>
              </TranscriptionProvider>
            )}
          </>
        )}
      </div>
    </VideoConferenceProvider>
  );
}

// Separate component to use TranscriptionContext
const TranscriptionBoardWrapper = dynamic(() => Promise.resolve(({ roomId }: { roomId: string }) => {
  // Import has to be inside the component to avoid React Hook errors
  const { useTranscriptionContext } = require('@/contexts/TranscriptionContext');
  const context = useTranscriptionContext();
  
  return (
    <>
      {context.showTranscription && (
        <div className="absolute inset-0 z-10">
          <TranscriptionBoard roomId={roomId} />
        </div>
      )}
      
      {context.showDebugger && <LiveKitDebugger />}
      
      <div className="absolute bottom-4 right-4 z-10" style={{ width: "300px", height: "225px" }}>
        <VideoConference />
      </div>
    </>
  );
}), { ssr: false }); 