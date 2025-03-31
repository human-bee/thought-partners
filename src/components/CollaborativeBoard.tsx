"use client";

import CollaborativeBoard from './whiteboard/CollaborativeBoard';

interface CollaborativeBoardProps {
  roomId: string;
}

// Main component that uses the refactored implementation
export default function CollaborativeBoardWrapper({ roomId }: CollaborativeBoardProps) {
  return <CollaborativeBoard roomId={roomId} />;
} 