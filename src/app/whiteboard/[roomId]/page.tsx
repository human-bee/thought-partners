'use client';

import { useEffect, useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import { useParams } from 'next/navigation';

export default function WhiteboardPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [token, setToken] = useState<string>('');
  const [username, setUsername] = useState<string>(`user_${Math.floor(Math.random() * 10000)}`);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function getToken() {
      try {
        const response = await fetch(`/api/get-token?room=${roomId}&username=${username}`);
        const data = await response.json();
        setToken(data.token);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching token:', error);
        setIsLoading(false);
      }
    }

    getToken();
  }, [roomId, username]);

  useEffect(() => {
    async function createAgent() {
      try {
        if (token) {
          await fetch('/api/create-agent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ roomName: roomId }),
          });
        }
      } catch (error) {
        console.error('Error creating agent:', error);
      }
    }

    createAgent();
  }, [roomId, token]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Video Conference Section */}
      <div className="w-1/4 h-full bg-gray-900 p-2">
        {token && (
          <LiveKitRoom
            serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
            token={token}
          >
            <div className="text-white">Video Conference Component Would Go Here</div>
          </LiveKitRoom>
        )}
      </div>

      {/* Whiteboard Section */}
      <div className="w-3/4 h-full bg-gray-100">
        <div className="text-center p-8">Whiteboard Component Would Go Here</div>
      </div>
    </div>
  );
} 