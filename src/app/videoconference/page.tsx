'use client';

import VideoConference from '@/components/videoconference/VideoConference';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function VideoConferencePage() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    // Set document title directly since we're in a client component
    document.title = 'Video Conference';
  }, []);
  
  // Get room name and identity from URL
  const room = searchParams?.get('room') || 'default-room';
  const identity = searchParams?.get('identity') || 'user-' + Math.floor(Math.random() * 10000);
  
  // Handle errors from VideoConference component
  const handleError = (error: Error) => {
  };
  
  // Only render VideoConference component on client-side
  if (!mounted) {
    return <div className="min-h-screen flex items-center justify-center">
      <p>Loading video conference...</p>
    </div>;
  }
  
  return (
    <main className="min-h-screen flex flex-col">
      <div className="p-4 bg-gray-100 border-b border-gray-200">
        <h1 className="text-xl font-bold">Video Conference</h1>
        <p className="text-sm text-gray-600">Room: {room}</p>
      </div>
      
      <div className="flex-1 p-4">
        <VideoConference />
      </div>
    </main>
  );
} 