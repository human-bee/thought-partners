import { useEffect, useState } from 'react';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';

interface CollaborativeBoardProps {
  roomName: string;
  token?: string;
}

export default function CollaborativeBoard({ roomName }: CollaborativeBoardProps) {
  // For real implementation, you would:
  // 1. Set up a collaboration backend with Yjs or custom sockets
  // 2. Connect it to TLDraw's store
  // 3. Sync changes between users
  
  return (
    <div className="h-full w-full">
      <Tldraw id={roomName} />
    </div>
  );
} 