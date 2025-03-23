import { act, renderHook } from '@testing-library/react';
import { useDeviceManager } from '../../components/VideoConference/DeviceManager';
import { VideoLogger } from '../../utils/VideoLogger';

// Mock VideoLogger
jest.mock('../../utils/VideoLogger', () => ({
  VideoLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('DeviceManager Hook', () => {
  // Save original navigator.mediaDevices
  const originalMediaDevices = navigator.mediaDevices;
  
  // Mock device data
  const mockVideoDevices = [
    { deviceId: 'video-1', label: 'Camera 1', kind: 'videoinput' },
    { deviceId: 'video-2', label: 'Camera 2', kind: 'videoinput' }
  ];
  
  const mockAudioDevices = [
    { deviceId: 'audio-1', label: 'Microphone 1', kind: 'audioinput' },
    { deviceId: 'audio-2', label: 'Microphone 2', kind: 'audioinput' }
  ];
  
  const mockOutputDevices = [
    { deviceId: 'output-1', label: 'Speaker 1', kind: 'audiooutput' },
    { deviceId: 'output-2', label: 'Speaker 2', kind: 'audiooutput' }
  ];
  
  const allDevices = [...mockVideoDevices, ...mockAudioDevices, ...mockOutputDevices];
  
  // Mock for enumerateDevices
  const mockEnumerateDevices = jest.fn().mockResolvedValue(allDevices);
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mocked mediaDevices
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        enumerateDevices: mockEnumerateDevices,
        getUserMedia: jest.fn().mockResolvedValue({
          getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
        })
      },
      writable: true,
      configurable: true
    });
  });
  
  afterEach(() => {
    // Restore original mediaDevices
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: originalMediaDevices,
      writable: true,
      configurable: true
    });
  });

  test('loads devices on mount', async () => {
    // Render the hook
    const { result, waitForNextUpdate } = renderHook(() => useDeviceManager());
    
    // Wait for devices to load
    await waitForNextUpdate();
    
    // Check that enumerateDevices was called
    expect(mockEnumerateDevices).toHaveBeenCalled();
    
    // Check that devices are loaded
    expect(result.current.videoInputs.length).toBe(2);
    expect(result.current.audioInputs.length).toBe(2);
    
    // Check first video device
    expect(result.current.videoInputs[0]).toEqual({
      deviceId: 'video-1',
      label: 'Camera 1'
    });
    
    // Check first audio device
    expect(result.current.audioInputs[0]).toEqual({
      deviceId: 'audio-1',
      label: 'Microphone 1'
    });
    
    // Check that is not loading
    expect(result.current.isLoading).toBe(false);
    
    // Check that there are no errors
    expect(result.current.error).toBeNull();
  });
  
  test('refreshes devices when called', async () => {
    // Render the hook
    const { result, waitForNextUpdate } = renderHook(() => useDeviceManager());
    
    // Wait for initial load
    await waitForNextUpdate();
    
    // Clear mocks to track new calls
    mockEnumerateDevices.mockClear();
    
    // Call refreshDevices
    await act(async () => {
      await result.current.refreshDevices();
    });
    
    // Check that enumerateDevices was called again
    expect(mockEnumerateDevices).toHaveBeenCalled();
  });

  test('handles permission errors gracefully', async () => {
    // Mock an error in enumerateDevices
    const permissionError = new Error('Permission denied');
    mockEnumerateDevices.mockRejectedValueOnce(permissionError);
    
    // Render the hook
    const { result, waitForNextUpdate } = renderHook(() => useDeviceManager());
    
    // Wait for devices to attempt to load
    await waitForNextUpdate();
    
    // Check that error is set
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('Failed to enumerate devices');
    
    // Check that VideoLogger.error was called
    expect(VideoLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error getting devices'),
      expect.any(Error)
    );
  });

  test('handles unsupported media devices gracefully', async () => {
    // Remove mediaDevices API to simulate unsupported browsers
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true
    });
    
    // Render the hook
    const { result, waitForNextUpdate } = renderHook(() => useDeviceManager());
    
    // Wait for hook to process
    await waitForNextUpdate();
    
    // Check that devices arrays are empty
    expect(result.current.videoInputs.length).toBe(0);
    expect(result.current.audioInputs.length).toBe(0);
    
    // Check that VideoLogger.warn was called
    expect(VideoLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Media devices not supported')
    );
  });
}); 