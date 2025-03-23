'use client';

import { useState, useEffect } from 'react';
import { EnhancedLiveKitRoom } from '@/components/LiveKitRoom';
import TranscriptionBoard from '@/components/TranscriptionBoard';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConnectionState } from 'livekit-client';

export default function TranscriptionBoardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Get room and username from URL query params
  const roomName = searchParams.get('room');
  const username = searchParams.get('username') || 'Anonymous';

  useEffect(() => {
    // If no room name is provided, redirect to join page
    if (!roomName) {
      router.push('/');
      return;
    }

    const fetchToken = async () => {
      setIsConnecting(true);
      try {
        const response = await fetch(`/api/get-participant-token?room=${roomName}&username=${username}`);
        
        if (!response.ok) {
          throw new Error(`Failed to get token: ${response.statusText}`);
        }
        
        const data = await response.json();
        setToken(data.token);
      } catch (err) {
        console.error('Error fetching token:', err);
        setError(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsConnecting(false);
      }
    };

    fetchToken();
  }, [roomName, username, router]);

  const handleConnected = () => {
    console.log('Connected to room:', roomName);
  };

  const handleDisconnected = () => {
    console.log('Disconnected from room');
  };

  const handleError = (err: Error) => {
    console.error('LiveKit error:', err);
    setError(`Connection error: ${err.message}`);
  };

  if (!roomName) {
    return <div className="p-8">Redirecting to home page...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Connection Error</h1>
          <p className="text-gray-700 mb-6">{error}</p>
          <button 
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (isConnecting || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Connecting to room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold">Transcription Board: {roomName}</h1>
        <p className="text-sm opacity-80">Connected as: {username}</p>
      </header>
      
      <main className="flex-1 overflow-hidden">
        <EnhancedLiveKitRoom
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || ''}
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onError={handleError}
        >
          <TranscriptionBoard roomId={roomName} />
        </EnhancedLiveKitRoom>
      </main>
    </div>
  );
} 