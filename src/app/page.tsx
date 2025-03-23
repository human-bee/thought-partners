'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [roomType, setRoomType] = useState<'whiteboard' | 'transcription'>('whiteboard');
  const router = useRouter();

  const joinRoom = () => {
    // Generate a random room ID if not provided
    const newRoomId = roomId || `room-${Math.random().toString(36).substring(2, 9)}`;
    const user = username || 'Anonymous';
    
    if (roomType === 'whiteboard') {
      router.push(`/whiteboard/${newRoomId}`);
    } else {
      router.push(`/transcription-board?room=${newRoomId}&username=${user}`);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="w-full max-w-md p-6 bg-gray-800 rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Thought Partner
        </h1>
        <p className="mb-6 text-center">
          Collaborative tools with AI-powered capabilities
        </p>
        
        <div className="mb-6">
          <label htmlFor="username" className="block mb-2 text-sm font-medium">
            Your Name
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            className="w-full p-3 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="mb-6">
          <label htmlFor="roomId" className="block mb-2 text-sm font-medium">
            Room ID (optional)
          </label>
          <input
            type="text"
            id="roomId"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter a room ID or leave blank to generate one"
            className="w-full p-3 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="mb-6">
          <label className="block mb-2 text-sm font-medium">
            Room Type
          </label>
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => setRoomType('whiteboard')}
              className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                roomType === 'whiteboard' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Whiteboard
            </button>
            <button
              type="button"
              onClick={() => setRoomType('transcription')}
              className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                roomType === 'transcription' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Transcription Board
            </button>
          </div>
        </div>
        
        <button
          onClick={joinRoom}
          className="w-full py-3 bg-blue-600 rounded-md font-medium hover:bg-blue-700 transition-colors"
        >
          {roomId ? 'Join Room' : 'Create New Room'}
        </button>
        
        <p className="mt-4 text-sm text-gray-400 text-center">
          {roomType === 'transcription' 
            ? 'Transcription Board: Collaborate with real-time speech-to-text on a shared canvas.' 
            : 'Whiteboard: Draw and collaborate on a shared whiteboard.'}
        </p>
      </div>
    </main>
  );
}
