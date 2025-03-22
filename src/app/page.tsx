'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const router = useRouter();

  const createRoom = () => {
    // Generate a random room ID if not provided
    const newRoomId = roomId || `room-${Math.random().toString(36).substring(2, 9)}`;
    router.push(`/whiteboard/${newRoomId}`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="w-full max-w-md p-6 bg-gray-800 rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Thought Partner
        </h1>
        <p className="mb-6 text-center">
          Collaborative whiteboard with AI-powered capabilities
        </p>
        
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
        
        <button
          onClick={createRoom}
          className="w-full py-3 bg-blue-600 rounded-md font-medium hover:bg-blue-700 transition-colors"
        >
          {roomId ? 'Join Room' : 'Create New Room'}
        </button>
      </div>
    </main>
  );
}
