import { RoomStorage } from '../../components/videoconference/RoomStorage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('RoomStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });
  
  test('saveRoomInfo stores room information in localStorage', () => {
    const roomInfo = {
      roomName: 'test-room',
      serverUrl: 'wss://test-server.com',
      token: 'test-token',
      identity: 'test-user',
      timestamp: new Date().toISOString()
    };
    
    RoomStorage.saveRoomInfo(roomInfo);
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'livekit-room-info',
      expect.any(String)
    );
    
    const storedValue = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(storedValue).toEqual(roomInfo);
  });
  
  test('getRoomInfo retrieves room information from localStorage', () => {
    const roomInfo = {
      roomName: 'test-room',
      serverUrl: 'wss://test-server.com',
      token: 'test-token',
      identity: 'test-user',
      timestamp: new Date().toISOString()
    };
    
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(roomInfo));
    
    const retrievedInfo = RoomStorage.getRoomInfo();
    
    expect(localStorageMock.getItem).toHaveBeenCalledWith('livekit-room-info');
    expect(retrievedInfo).toEqual(roomInfo);
  });
  
  test('getRoomInfo returns null when no data is stored', () => {
    localStorageMock.getItem.mockReturnValueOnce(null);
    
    const retrievedInfo = RoomStorage.getRoomInfo();
    
    expect(retrievedInfo).toBeNull();
  });
  
  test('clearRoomInfo removes room information from localStorage', () => {
    RoomStorage.clearRoomInfo();
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('livekit-room-info');
  });
  
  test('isRoomInfoValid returns true for valid room info', () => {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    
    const roomInfo = {
      roomName: 'test-room',
      serverUrl: 'wss://test-server.com',
      token: 'test-token',
      identity: 'test-user',
      timestamp: oneMinuteAgo.toISOString()
    };
    
    const isValid = RoomStorage.isRoomInfoValid(roomInfo);
    
    expect(isValid).toBe(true);
  });
  
  test('isRoomInfoValid returns false for expired room info', () => {
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    
    const roomInfo = {
      roomName: 'test-room',
      serverUrl: 'wss://test-server.com',
      token: 'test-token',
      identity: 'test-user',
      timestamp: threeHoursAgo.toISOString()
    };
    
    const isValid = RoomStorage.isRoomInfoValid(roomInfo);
    
    expect(isValid).toBe(false);
  });
  
  test('isRoomInfoValid returns false for incomplete room info', () => {
    const incompleteRoomInfo = {
      roomName: 'test-room',
      serverUrl: 'wss://test-server.com',
      // Missing token and identity
      timestamp: new Date().toISOString()
    };
    
    const isValid = RoomStorage.isRoomInfoValid(incompleteRoomInfo as any);
    
    expect(isValid).toBe(false);
  });
  
  test('isRoomInfoExpiring returns true when token is about to expire', () => {
    const now = new Date();
    const almostTwoHoursAgo = new Date(now.getTime() - 110 * 60 * 1000);
    
    const roomInfo = {
      roomName: 'test-room',
      serverUrl: 'wss://test-server.com',
      token: 'test-token',
      identity: 'test-user',
      timestamp: almostTwoHoursAgo.toISOString()
    };
    
    const isExpiring = RoomStorage.isRoomInfoExpiring(roomInfo);
    
    expect(isExpiring).toBe(true);
  });
  
  test('isRoomInfoExpiring returns false when token is not about to expire', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const roomInfo = {
      roomName: 'test-room',
      serverUrl: 'wss://test-server.com',
      token: 'test-token',
      identity: 'test-user',
      timestamp: oneHourAgo.toISOString()
    };
    
    const isExpiring = RoomStorage.isRoomInfoExpiring(roomInfo);
    
    expect(isExpiring).toBe(false);
  });
}); 