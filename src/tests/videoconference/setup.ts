/**
 * Setup utilities for VideoConference tests
 */

import { mockRoomData, mockParticipant } from '../common/mocks';

// Mock LiveKit Room for testing
export const createMockRoom = () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  localParticipant: {
    ...mockParticipant,
    identity: 'local-user',
    publishTrack: jest.fn().mockResolvedValue({}),
    unpublishTrack: jest.fn().mockResolvedValue({}),
    setMicrophoneEnabled: jest.fn().mockResolvedValue(true),
    setCameraEnabled: jest.fn().mockResolvedValue(true),
  },
  state: 'disconnected',
  participants: new Map([
    ['remote-user-1', { ...mockParticipant, identity: 'remote-user-1' }],
  ]),
  on: jest.fn().mockImplementation((event, callback) => {
    return { event, callback };
  }),
  off: jest.fn(),
});

// Create mock tracks
export const createMockVideoTrack = (trackId = 'video-track-1') => ({
  trackSid: trackId,
  kind: 'video',
  source: 'camera',
  track: {
    attach: jest.fn().mockReturnValue(document.createElement('video')),
    detach: jest.fn(),
  },
  start: jest.fn(),
  stop: jest.fn(),
  mediaStreamTrack: {
    enabled: true,
    id: trackId,
  },
});

export const createMockAudioTrack = (trackId = 'audio-track-1') => ({
  trackSid: trackId,
  kind: 'audio',
  source: 'microphone',
  track: {
    attach: jest.fn().mockReturnValue(document.createElement('audio')),
    detach: jest.fn(),
  },
  start: jest.fn(),
  stop: jest.fn(),
  mediaStreamTrack: {
    enabled: true,
    id: trackId,
  },
});

// Mock token service
export const mockTokenService = {
  getToken: jest.fn().mockResolvedValue({
    token: 'mock-token-xyz-123',
    success: true,
  }),
};

// Setup room data for tests
export const setupRoomData = {
  ...mockRoomData,
  identity: 'test-user',
}; 