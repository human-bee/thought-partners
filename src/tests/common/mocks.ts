/**
 * Common mock objects and functions for testing
 */

// Mock React Audio/Video element
export const createMockMediaElement = () => ({
  srcObject: null,
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
});

// Mock event handlers
export const mockEventHandlers = () => ({
  onCameraToggle: jest.fn(),
  onMicrophoneToggle: jest.fn(),
  onScreenShareToggle: jest.fn(),
  onDeviceSelect: jest.fn(),
  onDisconnect: jest.fn(),
  onError: jest.fn(),
});

// Mock LiveKit token service response
export const mockTokenResponse = {
  token: 'mock-token-xyz-123',
  success: true,
};

// Mock LiveKit room data
export const mockRoomData = {
  name: 'test-room',
  url: 'wss://mock-livekit-server.example.com',
  token: 'mock-token-xyz-123',
};

// Mock participant data
export const mockParticipant = {
  identity: 'test-user',
  name: 'Test User',
  metadata: JSON.stringify({ avatar: 'https://example.com/avatar.png' }),
  audioLevel: 0,
  connectionQuality: 1,
  isSpeaking: false,
  audioTracks: new Map(),
  videoTracks: new Map(),
  on: jest.fn(),
  off: jest.fn(),
}; 