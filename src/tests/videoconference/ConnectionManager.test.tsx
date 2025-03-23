import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ConnectionManager } from '../../components/VideoConference/ConnectionManager';
import { RoomStorage } from '../../components/VideoConference/RoomStorage';
import { VideoLogger } from '../../utils/VideoLogger';

// Mock RoomStorage
jest.mock('../../components/VideoConference/RoomStorage', () => ({
  RoomStorage: {
    getRoomInfo: jest.fn(),
    saveRoomInfo: jest.fn(),
    clearRoomInfo: jest.fn()
  }
}));

// Mock VideoLogger
jest.mock('../../utils/VideoLogger', () => ({
  VideoLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock LiveKit API
jest.mock('livekit-client', () => {
  const mockRoom = {
    connect: jest.fn().mockResolvedValue({}),
    disconnect: jest.fn(),
    state: 'new',
    on: jest.fn(),
    off: jest.fn(),
    localParticipant: {
      setMicrophoneEnabled: jest.fn(),
      setCameraEnabled: jest.fn(),
      setScreenShareEnabled: jest.fn(),
      publishTrack: jest.fn()
    },
    participants: new Map()
  };

  return {
    Room: jest.fn(() => mockRoom),
    RoomEvent: {
      ParticipantConnected: 'participantConnected',
      ParticipantDisconnected: 'participantDisconnected',
      TrackSubscribed: 'trackSubscribed',
      TrackUnsubscribed: 'trackUnsubscribed',
      Disconnected: 'disconnected',
      LocalTrackPublished: 'localTrackPublished'
    },
    ConnectionState: {
      Disconnected: 'disconnected',
      Connected: 'connected',
      Connecting: 'connecting'
    },
    createLocalTracks: jest.fn().mockResolvedValue([])
  };
});

// Mock fetch for token API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ token: 'mock-token' })
  })
) as jest.Mock;

describe('ConnectionManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RoomStorage.getRoomInfo as jest.Mock).mockReturnValue({
      roomName: 'test-room',
      participantName: 'Test User'
    });
  });

  test('renders loading state initially', () => {
    render(<ConnectionManager />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  test('fetches token and connects to room on mount', async () => {
    render(<ConnectionManager />);
    
    // Wait for async operations
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    // Check that fetch was called with correct URL
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/livekit-token'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    );
    
    // Check that connect was called on the room
    const { Room } = require('livekit-client');
    const mockRoom = Room.mock.results[0].value;
    expect(mockRoom.connect).toHaveBeenCalledWith(
      'mock-token',
      expect.objectContaining({
        autoSubscribe: true
      })
    );
  });

  test('handles connection errors', async () => {
    // Mock fetch to reject
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    
    render(<ConnectionManager />);
    
    // Wait for async operations
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    // Check that error state is shown
    expect(screen.getByText(/failed to connect/i)).toBeInTheDocument();
    
    // Check that VideoLogger.error was called
    expect(VideoLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to get token'),
      expect.any(Error)
    );
  });

  test('handles room disconnection', async () => {
    render(<ConnectionManager />);
    
    // Wait for initial connection
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    // Get the room instance
    const { Room, RoomEvent } = require('livekit-client');
    const mockRoom = Room.mock.results[0].value;
    
    // Find the disconnect handler
    const disconnectHandler = mockRoom.on.mock.calls.find(
      call => call[0] === RoomEvent.Disconnected
    )[1];
    
    // Trigger disconnect event
    act(() => {
      disconnectHandler();
    });
    
    // Verify disconnect message is shown
    expect(screen.getByText(/disconnected from room/i)).toBeInTheDocument();
  });

  test('cleans up on unmount', async () => {
    const { unmount } = render(<ConnectionManager />);
    
    // Wait for connection
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    // Get room instance
    const { Room } = require('livekit-client');
    const mockRoom = Room.mock.results[0].value;
    
    // Unmount the component
    unmount();
    
    // Check that disconnect was called
    expect(mockRoom.disconnect).toHaveBeenCalled();
    expect(mockRoom.off).toHaveBeenCalled();
  });
}); 