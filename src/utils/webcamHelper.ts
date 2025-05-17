/**
 * WebcamHelper - Utility functions for webcam access and management
 * 
 * This helper provides simplified methods to:
 * - Check camera/mic permissions
 * - Get available media devices
 * - Start/stop media streams
 * - Handle common errors
 */

type MediaPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

interface DeviceInfo {
  id: string;
  label: string;
  kind: string;
}

interface WebcamHelperResult {
  success: boolean;
  message: string;
  stream?: MediaStream;
  error?: Error;
}

export class WebcamHelper {
  /**
   * Check if the browser has permission to use camera and microphone
   */
  static async checkPermissions(): Promise<{ camera: MediaPermissionStatus, microphone: MediaPermissionStatus }> {
    try {
      const results = {
        camera: 'unknown' as MediaPermissionStatus,
        microphone: 'unknown' as MediaPermissionStatus
      };
      
      // Check if permissions API is available
      if (navigator.permissions) {
        try {
          const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          results.camera = cameraPermission.state as MediaPermissionStatus;
        } catch (err) {
        }
        
        try {
          const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          results.microphone = micPermission.state as MediaPermissionStatus;
        } catch (err) {
        }
      }
      
      return results;
    } catch (error) {
      return { camera: 'unknown', microphone: 'unknown' };
    }
  }
  
  /**
   * Get the list of available media devices
   */
  static async getDevices(): Promise<{ videoDevices: DeviceInfo[], audioDevices: DeviceInfo[] }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      return {
        videoDevices: devices
          .filter(device => device.kind === 'videoinput')
          .map(device => ({
            id: device.deviceId,
            label: device.label || `Camera ${device.deviceId.slice(0, 5)}...`,
            kind: device.kind
          })),
        audioDevices: devices
          .filter(device => device.kind === 'audioinput')
          .map(device => ({
            id: device.deviceId,
            label: device.label || `Microphone ${device.deviceId.slice(0, 5)}...`,
            kind: device.kind
          }))
      };
    } catch (error) {
      return { videoDevices: [], audioDevices: [] };
    }
  }
  
  /**
   * Start the webcam with specified constraints
   */
  static async startCamera(options?: { video?: boolean | MediaTrackConstraints, audio?: boolean | MediaTrackConstraints }): Promise<WebcamHelperResult> {
    const constraints = {
      video: options?.video ?? true,
      audio: options?.audio ?? false
    };
    
    try {
      // Try to get permissions if they're not already granted
      await this.requestPermissions(!!constraints.video, !!constraints.audio);
      
      // Get the media stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      return {
        success: true,
        message: 'Camera started successfully',
        stream
      };
    } catch (error) {
      return {
        success: false,
        message: this.getErrorMessage(error),
        error: error as Error
      };
    }
  }
  
  /**
   * Stop all tracks in a media stream
   */
  static stopStream(stream: MediaStream | null): void {
    if (!stream) return;
    
    stream.getTracks().forEach(track => {
      track.stop();
    });
  }
  
  /**
   * Request camera and/or microphone permissions
   * This will prompt the user if permissions haven't been granted yet
   */
  static async requestPermissions(camera: boolean, microphone: boolean): Promise<WebcamHelperResult> {
    try {
      const constraints: MediaStreamConstraints = {};
      
      if (camera) constraints.video = true;
      if (microphone) constraints.audio = true;
      
      if (!constraints.video && !constraints.audio) {
        return {
          success: false,
          message: 'No permissions requested'
        };
      }
      
      // This will trigger the browser permission dialog if needed
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Stop the stream immediately - we just needed it to request permissions
      this.stopStream(stream);
      
      return {
        success: true,
        message: 'Permissions granted'
      };
    } catch (error) {
      return {
        success: false,
        message: this.getErrorMessage(error),
        error: error as Error
      };
    }
  }
  
  /**
   * Get a user-friendly error message for common media errors
   */
  private static getErrorMessage(error: any): string {
    if (!error) return 'Unknown error';
    
    // Common getUserMedia error names
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Camera or microphone permission denied. Please check your browser settings.';
      
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera or microphone found. Please connect a device and try again.';
      
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Camera or microphone is already in use by another application.';
      
      case 'OverconstrainedError':
        return 'The requested camera settings are not available on your device.';
      
      case 'TypeError':
        return 'Invalid constraints were provided.';
      
      default:
        return error.message || 'An error occurred accessing your camera or microphone.';
    }
  }
} 