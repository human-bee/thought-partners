import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ConnectionState,
  Room,
  RoomEvent,
  LocalParticipant,
  RemoteParticipant,
  Participant
} from 'livekit-client';

// Context types
interface RoomContextType {
  room: Room | null;
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  roomName: string | null;
}

interface ConnectionStateContextType {
  state: ConnectionState;
  isConnected: boolean;
  error: Error | null;
}

interface ParticipantContextType {
  localParticipant: LocalParticipant | null;
  remoteParticipants: RemoteParticipant[];
}

// Create contexts
const RoomContext = createContext<RoomContextType | null>(null);
const ConnectionStateContext = createContext<ConnectionStateContextType>({
  state: ConnectionState.Disconnected,
  isConnected: false,
  error: null
});
const ParticipantContext = createContext<ParticipantContextType>({
  localParticipant: null,
  remoteParticipants: []
});

// Create provider component
export const VideoConferenceProvider: React.FC<{
  children: React.ReactNode;
  roomOptions?: any;
  roomName?: string;
}> = ({ children, roomOptions, roomName }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const [localParticipant, setLocalParticipant] = useState<LocalParticipant | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [currentRoomName, setCurrentRoomName] = useState<string | null>(roomName || null);

  // Initialize room
  useEffect(() => {
    console.log(`Initializing room with options:`, roomOptions);
    console.log(`Initial room name: ${roomName}`);
    
    const newRoom = new Room(roomOptions);
    setRoom(newRoom);
    
    // If roomName is provided, save it to context state
    if (roomName) {
      setCurrentRoomName(roomName);
      console.log(`Set current room name: ${roomName}`);
    }

    // Clean up on unmount
    return () => {
      console.log('Cleaning up room on unmount');
      if (newRoom.state !== ConnectionState.Disconnected) {
        newRoom.disconnect().catch(console.error);
      }
    };
  }, [roomOptions, roomName]);

  // Set up event listeners when room changes
  useEffect(() => {
    if (!room) return;

    console.log('Setting up room event listeners');

    const handleConnectionStateChanged = (state: ConnectionState) => {
      console.log(`Connection state changed: ${state}`);
      setConnectionState(state);

      // Set local participant when connected
      if (state === ConnectionState.Connected) {
        console.log('Connected to room, setting local participant');
        setLocalParticipant(room.localParticipant);
        
        // Get room name from room object if not already set
        if (room.name && !currentRoomName) {
          console.log(`Setting room name from room object: ${room.name}`);
          setCurrentRoomName(room.name);
        }
      } else if (state === ConnectionState.Disconnected) {
        setLocalParticipant(null);
      }
    };

    const handleParticipantConnected = (participant: RemoteParticipant) => {
      console.log(`Participant connected: ${participant.identity}`);
      setRemoteParticipants(prev => [...prev, participant]);
    };

    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      console.log(`Participant disconnected: ${participant.identity}`);
      setRemoteParticipants(prev => prev.filter(p => p.sid !== participant.sid));
    };

    const handleError = (error: Error) => {
      console.error('Room error:', error);
      setConnectionError(error);
    };

    // Add event listeners
    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.MediaDevicesError, handleError);
    room.on(RoomEvent.ConnectionError, handleError);

    // Set initial state
    setConnectionState(room.state);
    if (room.state === ConnectionState.Connected) {
      setLocalParticipant(room.localParticipant);
      setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      
      // Get room name from room object if not already set
      if (room.name && !currentRoomName) {
        console.log(`Setting room name from room object: ${room.name}`);
        setCurrentRoomName(room.name);
      }
    }

    // Clean up listeners on unmount or when room changes
    return () => {
      console.log('Removing room event listeners');
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.MediaDevicesError, handleError);
      room.off(RoomEvent.ConnectionError, handleError);
    };
  }, [room, currentRoomName]);

  // Room connection methods
  const connect = async (url: string, token: string) => {
    if (!room) throw new Error('Room not initialized');
    
    try {
      console.log('Connecting to room with token...');
      await room.connect(url, token, {
        autoSubscribe: true
      });
      console.log('Connected to room successfully');
      
      // Update room name if not already set
      if (room.name && !currentRoomName) {
        console.log(`Setting room name after connection: ${room.name}`);
        setCurrentRoomName(room.name);
      }
    } catch (error) {
      console.error('Failed to connect to room:', error);
      setConnectionError(error as Error);
      throw error;
    }
  };

  const disconnect = async () => {
    if (!room) return;
    
    try {
      await room.disconnect();
      setConnectionState(ConnectionState.Disconnected);
      setLocalParticipant(null);
      setRemoteParticipants([]);
    } catch (error) {
      console.error('Error disconnecting from room:', error);
      throw error;
    }
  };

  return (
    <RoomContext.Provider value={{ room, connect, disconnect, roomName: currentRoomName }}>
      <ConnectionStateContext.Provider 
        value={{ 
          state: connectionState, 
          isConnected: connectionState === ConnectionState.Connected,
          error: connectionError 
        }}
      >
        <ParticipantContext.Provider value={{ localParticipant, remoteParticipants }}>
          {children}
        </ParticipantContext.Provider>
      </ConnectionStateContext.Provider>
    </RoomContext.Provider>
  );
};

// Custom hooks
export const useRoomContext = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoomContext must be used within a VideoConferenceProvider');
  }
  return context;
};

export const useConnectionState = () => {
  return useContext(ConnectionStateContext);
};

export const useLocalParticipant = () => {
  const { localParticipant } = useContext(ParticipantContext);
  return { localParticipant };
};

export const useRemoteParticipants = () => {
  const { remoteParticipants } = useContext(ParticipantContext);
  return remoteParticipants;
}; 