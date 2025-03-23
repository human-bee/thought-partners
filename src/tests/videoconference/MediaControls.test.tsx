import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useMediaControls } from '../../components/VideoConference/MediaControls';

// Mock the LiveKit client dependencies
jest.mock('livekit-client', () => ({
  createLocalAudioTrack: jest.fn().mockResolvedValue({
    mute: jest.fn(),
    unmute: jest.fn(),
    stop: jest.fn(),
    mediaStreamTrack: {}
  }),
  createLocalVideoTrack: jest.fn().mockResolvedValue({
    mute: jest.fn(),
    unmute: jest.fn(),
    stop: jest.fn(),
    mediaStreamTrack: {}
  })
}));

// Mock the VideoLogger
jest.mock('../../components/videoconference/VideoLogger', () => ({
  VideoLogger: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Test wrapper component to use the hook
function TestComponent({ onError = jest.fn() }) {
  const mediaControls = useMediaControls({ onError });
  
  return (
    <div>
      <button data-testid="toggle-camera" onClick={mediaControls.toggleCamera}>
        Toggle Camera
      </button>
      <button data-testid="toggle-mic" onClick={mediaControls.toggleMicrophone}>
        Toggle Mic
      </button>
      <button data-testid="toggle-device-selector" onClick={mediaControls.toggleDeviceSelector}>
        Toggle Device Selector
      </button>
      <button 
        data-testid="change-video-device" 
        onClick={() => mediaControls.changeVideoDevice('test-device-id')}
      >
        Change Video
      </button>
      <button 
        data-testid="change-audio-device" 
        onClick={() => mediaControls.changeAudioDevice('test-device-id')}
      >
        Change Audio
      </button>
      <div data-testid="camera-state">
        {mediaControls.cameraEnabled ? 'On' : 'Off'}
      </div>
      <div data-testid="mic-state">
        {mediaControls.micEnabled ? 'On' : 'Off'}
      </div>
      <div data-testid="selector-state">
        {mediaControls.showDeviceSelector ? 'Open' : 'Closed'}
      </div>
      <div data-testid="permissions-error">
        {mediaControls.permissionsError || 'No Error'}
      </div>
    </div>
  );
}

describe('MediaControls Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('initializes with camera and mic disabled', () => {
    render(<TestComponent />);
    
    expect(screen.getByTestId('camera-state')).toHaveTextContent('Off');
    expect(screen.getByTestId('mic-state')).toHaveTextContent('Off');
    expect(screen.getByTestId('selector-state')).toHaveTextContent('Closed');
  });
  
  test('toggles camera state when toggleCamera is called', async () => {
    render(<TestComponent />);
    
    // Initial state is off
    expect(screen.getByTestId('camera-state')).toHaveTextContent('Off');
    
    // Toggle camera on
    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle-camera'));
    });
    
    // Now camera should be on
    expect(screen.getByTestId('camera-state')).toHaveTextContent('On');
    
    // Toggle camera off
    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle-camera'));
    });
    
    // Now camera should be off again
    expect(screen.getByTestId('camera-state')).toHaveTextContent('Off');
  });
  
  test('toggles microphone state when toggleMicrophone is called', async () => {
    render(<TestComponent />);
    
    // Initial state is off
    expect(screen.getByTestId('mic-state')).toHaveTextContent('Off');
    
    // Toggle mic on
    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle-mic'));
    });
    
    // Now mic should be on
    expect(screen.getByTestId('mic-state')).toHaveTextContent('On');
    
    // Toggle mic off
    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle-mic'));
    });
    
    // Now mic should be off again
    expect(screen.getByTestId('mic-state')).toHaveTextContent('Off');
  });
  
  test('toggles device selector when toggleDeviceSelector is called', () => {
    render(<TestComponent />);
    
    // Initial state is closed
    expect(screen.getByTestId('selector-state')).toHaveTextContent('Closed');
    
    // Open device selector
    fireEvent.click(screen.getByTestId('toggle-device-selector'));
    
    // Now device selector should be open
    expect(screen.getByTestId('selector-state')).toHaveTextContent('Open');
    
    // Close device selector
    fireEvent.click(screen.getByTestId('toggle-device-selector'));
    
    // Now device selector should be closed again
    expect(screen.getByTestId('selector-state')).toHaveTextContent('Closed');
  });
  
  test('changes video device when changeVideoDevice is called', async () => {
    const { createLocalVideoTrack } = require('livekit-client');
    render(<TestComponent />);
    
    // First enable camera
    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle-camera'));
    });
    
    // Reset mocks to check if new track is created
    createLocalVideoTrack.mockClear();
    
    // Change video device
    await act(async () => {
      fireEvent.click(screen.getByTestId('change-video-device'));
    });
    
    // Verify that a new track was created with the device ID
    expect(createLocalVideoTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'test-device-id'
      })
    );
  });
  
  test('changes audio device when changeAudioDevice is called', async () => {
    const { createLocalAudioTrack } = require('livekit-client');
    render(<TestComponent />);
    
    // First enable mic
    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle-mic'));
    });
    
    // Reset mocks to check if new track is created
    createLocalAudioTrack.mockClear();
    
    // Change audio device
    await act(async () => {
      fireEvent.click(screen.getByTestId('change-audio-device'));
    });
    
    // Verify that a new track was created with the device ID
    expect(createLocalAudioTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'test-device-id'
      })
    );
  });
  
  test('handles permissions error correctly', async () => {
    const { createLocalVideoTrack } = require('livekit-client');
    const mockError = new Error('Permission denied');
    mockError.name = 'NotAllowedError';
    createLocalVideoTrack.mockRejectedValueOnce(mockError);
    
    const mockOnError = jest.fn();
    render(<TestComponent onError={mockOnError} />);
    
    // Try to enable camera, which will fail with permission error
    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle-camera'));
    });
    
    // Check that error state is correctly set
    expect(screen.getByTestId('permissions-error')).not.toHaveTextContent('No Error');
    expect(screen.getByTestId('permissions-error')).toHaveTextContent(/permission/i);
    
    // Check that error callback was called
    expect(mockOnError).toHaveBeenCalled();
  });
}); 