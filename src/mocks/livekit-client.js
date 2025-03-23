// Mock for LiveKit client
const mockRoom = {
  connect: jest.fn().mockResolvedValue({}),
  disconnect: jest.fn().mockResolvedValue({}),
  localParticipant: {
    publishTrack: jest.fn().mockResolvedValue({}),
    setMicrophoneEnabled: jest.fn().mockResolvedValue(true),
    setCameraEnabled: jest.fn().mockResolvedValue(true),
    on: jest.fn(),
    off: jest.fn(),
  },
  state: 'connected',
  participants: new Map(),
  on: jest.fn(),
  off: jest.fn(),
};

class Room {
  constructor() {
    Object.assign(this, mockRoom);
  }
  
  connect() {
    return Promise.resolve({});
  }

  disconnect() {
    return Promise.resolve({});
  }
}

const createToken = jest.fn().mockReturnValue('mock-livekit-token');

module.exports = {
  Room,
  RoomEvent: {
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    ConnectionStateChanged: 'connectionStateChanged',
  },
  ConnectionState: {
    Connecting: 'connecting',
    Connected: 'connected',
    Disconnected: 'disconnected',
  },
  LocalParticipant: jest.fn(),
  RemoteParticipant: jest.fn(),
  Track: {
    Source: {
      Camera: 'camera',
      Microphone: 'microphone',
      ScreenShare: 'screen_share',
    },
    Kind: {
      Audio: 'audio',
      Video: 'video',
    },
  },
  createToken,
}; 