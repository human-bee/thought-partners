"use client";

import { useState, useCallback } from 'react';

interface JoinRoomFormProps {
  roomId: string;
  onJoin: (token: string) => void;
}

export default function JoinRoomForm({ roomId, onJoin }: JoinRoomFormProps) {
  const [username, setUsername] = useState(`user_${Math.floor(Math.random() * 10000)}`);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createAiAgent, setCreateAiAgent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // First, get a token for the LiveKit room
      const response = await fetch('/api/create-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          roomName: roomId,
          participantName: username,
          createAiAgent
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join room');
      }
      
      if (data.token) {
        // Validate the token before proceeding
        if (!data.token || data.token === '{}' || data.token === 'undefined') {
          console.error('Invalid token received from server:', data.token);
          throw new Error('Invalid token received from the server');
        }
        
        // Ensure token is a string
        const tokenStr = typeof data.token === 'object' 
          ? JSON.stringify(data.token) 
          : String(data.token);
        
        console.log('Token received:', typeof data.token, data.token);
        
        // Additional validation to ensure token is not empty
        if (tokenStr === '{}' || tokenStr === 'undefined' || tokenStr === '') {
          console.error('Empty or invalid token after conversion:', tokenStr);
          throw new Error('Invalid token format received from server');
        }
        
        onJoin(tokenStr);
        
        if (createAiAgent && data.agentCreated) {
          console.log('AI assistant joined the room');
        }
      } else {
        throw new Error('No token received from server');
      }
    } catch (error) {
      console.error('Error joining room:', error);
      setError(error instanceof Error ? error.message : 'Failed to join room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent event propagation to avoid context closed errors
  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setCreateAiAgent(e.target.checked);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setUsername(e.target.value);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center">Join Whiteboard Room</h1>
        <p className="text-center text-gray-600">Room ID: <span className="font-semibold">{roomId}</span></p>
        
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">Your Name</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={handleInputChange}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              id="createAiAgent"
              checked={createAiAgent}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label 
              htmlFor="createAiAgent" 
              className="ml-2 block text-sm text-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                setCreateAiAgent(!createAiAgent);
              }}
            >
              Add AI assistant (provides transcription)
            </label>
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? 'Joining...' : 'Join Room'}
          </button>
        </form>
      </div>
    </div>
  );
} 