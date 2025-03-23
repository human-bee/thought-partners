// Import testing libraries using require instead of import
require('@testing-library/jest-dom');

// Mock for ResizeObserver which is not available in Jest environment
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock for mediaDevices API
if (!window.navigator.mediaDevices) {
  window.navigator.mediaDevices = {
    getUserMedia: jest.fn().mockImplementation(() => Promise.resolve({
      getTracks: () => [],
    })),
    enumerateDevices: jest.fn().mockResolvedValue([]),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
}

// Mock for matchMedia
window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  };
};

// Mock for localStorage
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Suppressing console error/warnings during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
console.error = (...args) => {
  if (
    args[0]?.includes?.('Warning: ReactDOM.render is no longer supported') ||
    args[0]?.includes?.('Warning: React does not recognize the') ||
    args[0]?.includes?.('Error: Not implemented') ||
    args[0]?.includes?.('Warning: An update to') ||
    args[0]?.includes?.('Warning: useLayoutEffect does nothing on the server')
  ) {
    return;
  }
  originalConsoleError(...args);
};

console.warn = (...args) => {
  if (
    args[0]?.includes?.('Warning: React does not recognize the') ||
    args[0]?.includes?.('Warning: Unknown prop')
  ) {
    return;
  }
  originalConsoleWarn(...args);
};

// Mock for RTCPeerConnection
window.RTCPeerConnection = jest.fn().mockImplementation(() => ({
  createOffer: jest.fn().mockResolvedValue({}),
  setLocalDescription: jest.fn().mockResolvedValue({}),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  close: jest.fn(),
}));

// Mock for window.MediaStream
Object.defineProperty(window, 'MediaStream', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    addTrack: jest.fn(),
    removeTrack: jest.fn()
  }))
});

// Mock for navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: jest.fn().mockReturnValue([{
        stop: jest.fn()
      }])
    }),
    enumerateDevices: jest.fn().mockResolvedValue([
      { kind: 'videoinput', deviceId: 'video-1', label: 'Camera 1' },
      { kind: 'audioinput', deviceId: 'audio-1', label: 'Microphone 1' },
      { kind: 'audiooutput', deviceId: 'output-1', label: 'Speaker 1' }
    ])
  }
});

// Mock for environment variables
process.env.NEXT_PUBLIC_LIVEKIT_URL = 'wss://mock.livekit-server.com';

// Mock for LiveKit token in tests
global.mockLiveKitToken = 'mock-livekit-token';

// Setup mock for fetch API used by LiveKit
global.fetch = jest.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ token: 'mock-livekit-token' })
  })
);

// Clean up all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
}); 