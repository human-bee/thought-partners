import { Room, RoomOptions } from 'livekit-client';
import React from 'react';

// Define the context type
export interface VideoConferenceContextType {
  room: Room | null;
  token: string | null;
  setToken: (token: string | null) => void;
  isConnected: boolean;
  isReconnecting: boolean;
  hasError: boolean;
  onRoomConnected: () => void;
  onRoomDisconnected: () => void;
  onRoomReconnecting: () => void;
  onRoomReconnected: () => void;
  onRoomFailed: (isFailed: boolean) => void;
  onRoomCleanup: () => void;
}

// Define provider props type
export interface VideoConferenceProviderProps {
  children: React.ReactNode;
  serverUrl: string;
  roomOptions?: RoomOptions;
} 