import { LocalParticipant, Participant, RemoteParticipant, Room, RoomEvent, Track, ConnectionState } from 'livekit-client';
import { log } from '../components/videoconference/VideoLogger';

/**
 * A diagnostic utility for LiveKit connections
 */
export class LiveKitDiagnostics {
  private static instance: LiveKitDiagnostics;
  private room: Room | null = null;
  private diagnosticEvents: any[] = [];
  private isRecording = false;
  private startTime: number = 0;

  private constructor() {
    // Private constructor to enforce singleton
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): LiveKitDiagnostics {
    if (!LiveKitDiagnostics.instance) {
      LiveKitDiagnostics.instance = new LiveKitDiagnostics();
    }
    return LiveKitDiagnostics.instance;
  }

  /**
   * Attach diagnostics to a LiveKit room
   */
  public attachToRoom(room: Room): void {
    this.room = room;
    this.startListening();
    log.info('LiveKitDiagnostics: Attached to room');
  }

  /**
   * Start recording diagnostic events
   */
  public startRecording(): void {
    this.diagnosticEvents = [];
    this.isRecording = true;
    this.startTime = Date.now();
    this.logEvent('Recording started');
    log.info('LiveKitDiagnostics: Started recording events');
  }

  /**
   * Stop recording diagnostic events
   */
  public stopRecording(): any[] {
    this.isRecording = false;
    this.logEvent('Recording stopped');
    log.info('LiveKitDiagnostics: Stopped recording events');
    return this.getDiagnosticEvents();
  }

  /**
   * Get the recorded diagnostic events
   */
  public getDiagnosticEvents(): any[] {
    return [...this.diagnosticEvents];
  }

  /**
   * Get a summary of the current connection state
   */
  public getConnectionSummary(): any {
    if (!this.room) {
      return {
        status: 'Not connected',
        error: 'No room attached'
      };
    }

    const localParticipant = this.room.localParticipant;
    const remoteParticipants = Array.from(this.room.participants.values());

    return {
      timestamp: new Date().toISOString(),
      roomName: this.room.name,
      connectionState: this.room.state,
      serverAddress: this.room.connectionDetails?.url || 'Unknown',
      localParticipant: this.getParticipantInfo(localParticipant),
      remoteParticipants: remoteParticipants.map(p => this.getParticipantInfo(p)),
      simulcast: this.room.options?.publishDefaults?.simulcast ?? false,
      adaptiveStream: this.room.options?.adaptiveStream ?? false,
      dynacast: this.room.options?.dynacast ?? false
    };
  }

  /**
   * Run a complete diagnostic check of the LiveKit connection
   */
  public async runDiagnostics(): Promise<any> {
    if (!this.room) {
      return {
        success: false,
        error: 'No room attached'
      };
    }

    const diagnostics = {
      timestamp: new Date().toISOString(),
      browserInfo: this.getBrowserInfo(),
      networkInfo: await this.getNetworkInfo(),
      mediaDevices: await this.getMediaDevicesInfo(),
      connectionSummary: this.getConnectionSummary(),
      issues: [] as string[]
    };

    // Check for common issues
    this.detectIssues(diagnostics);

    return diagnostics;
  }

  /**
   * Detect common issues with the LiveKit connection
   */
  private detectIssues(diagnostics: any): void {
    const issues = diagnostics.issues;
    const connectionState = this.room?.state;

    // Connection state issues
    if (connectionState !== ConnectionState.Connected) {
      issues.push(`Room is not connected (state: ${connectionState})`);
    }

    // Local participant issues
    const localParticipant = diagnostics.connectionSummary.localParticipant;
    if (!localParticipant) {
      issues.push('No local participant found');
    } else {
      if (localParticipant.audioTracks.length === 0) {
        issues.push('No local audio tracks published');
      }
      if (localParticipant.videoTracks.length === 0) {
        issues.push('No local video tracks published');
      }
    }

    // Network connectivity issues
    if (diagnostics.networkInfo.latency > 300) {
      issues.push(`High network latency: ${diagnostics.networkInfo.latency}ms`);
    }

    // Media device issues
    if (diagnostics.mediaDevices.cameras.length === 0) {
      issues.push('No cameras detected');
    }
    if (diagnostics.mediaDevices.microphones.length === 0) {
      issues.push('No microphones detected');
    }
  }

  /**
   * Get information about a participant
   */
  private getParticipantInfo(participant: Participant | LocalParticipant | RemoteParticipant | null): any {
    if (!participant) return null;

    const videoTracks = Array.from(participant.videoTracks.values()).map(pub => ({
      trackSid: pub.trackSid,
      muted: pub.muted,
      simulcasted: pub.simulcasted,
      dimensions: pub.dimensions ? `${pub.dimensions?.width}x${pub.dimensions?.height}` : 'unknown',
      kind: pub.kind,
      source: pub.source
    }));

    const audioTracks = Array.from(participant.audioTracks.values()).map(pub => ({
      trackSid: pub.trackSid,
      muted: pub.muted,
      kind: pub.kind,
      source: pub.source
    }));

    return {
      identity: participant.identity,
      sid: participant.sid,
      metadata: participant.metadata,
      connectionQuality: participant.connectionQuality,
      isSpeaking: participant.isSpeaking,
      audioLevel: participant.audioLevel,
      videoTracks,
      audioTracks
    };
  }

  /**
   * Get browser information
   */
  private getBrowserInfo(): any {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      language: navigator.language,
      hardwareConcurrency: navigator.hardwareConcurrency,
      webRTCSupported: !!window.RTCPeerConnection
    };
  }

  /**
   * Get network information
   */
  private async getNetworkInfo(): Promise<any> {
    // Basic network info
    const info: any = {
      online: navigator.onLine,
      latency: 0
    };

    // Try to measure latency
    try {
      const start = Date.now();
      await fetch('/api/ping', { method: 'GET', cache: 'no-cache' });
      info.latency = Date.now() - start;
    } catch (e) {
      info.latencyError = (e as Error).message;
    }

    // Try to get connection information
    try {
      // @ts-ignore - Not all browsers support this
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection) {
        info.effectiveType = connection.effectiveType;
        info.downlinkMbps = connection.downlink;
        info.rtt = connection.rtt;
        info.saveData = connection.saveData;
      }
    } catch (e) {
      // Ignore if not supported
    }

    return info;
  }

  /**
   * Get information about available media devices
   */
  private async getMediaDevicesInfo(): Promise<any> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return {
        error: 'Media devices API not supported',
        cameras: [],
        microphones: [],
        speakers: []
      };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      return {
        cameras: devices.filter(d => d.kind === 'videoinput').map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.substring(0, 5)}...`,
          groupId: d.groupId
        })),
        microphones: devices.filter(d => d.kind === 'audioinput').map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.substring(0, 5)}...`,
          groupId: d.groupId
        })),
        speakers: devices.filter(d => d.kind === 'audiooutput').map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${d.deviceId.substring(0, 5)}...`,
          groupId: d.groupId
        }))
      };
    } catch (e) {
      return {
        error: (e as Error).message,
        cameras: [],
        microphones: [],
        speakers: []
      };
    }
  }

  /**
   * Start listening to room events
   */
  private startListening(): void {
    if (!this.room) return;

    // Connection events
    this.room.on(RoomEvent.Connected, () => this.logEvent('Connected'));
    this.room.on(RoomEvent.Disconnected, () => this.logEvent('Disconnected'));
    this.room.on(RoomEvent.Reconnecting, () => this.logEvent('Reconnecting'));
    this.room.on(RoomEvent.Reconnected, () => this.logEvent('Reconnected'));
    this.room.on(RoomEvent.ConnectionStateChanged, (state) => this.logEvent('ConnectionStateChanged', { state }));
    
    // Participant events
    this.room.on(RoomEvent.ParticipantConnected, (participant) => 
      this.logEvent('ParticipantConnected', { identity: participant.identity }));
    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => 
      this.logEvent('ParticipantDisconnected', { identity: participant.identity }));
    this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => 
      this.logEvent('ActiveSpeakersChanged', { count: speakers.length }));
    
    // Track events
    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => 
      this.logEvent('TrackSubscribed', { 
        kind: track.kind, 
        source: publication.source,
        participant: participant.identity 
      }));
    this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => 
      this.logEvent('TrackUnsubscribed', { 
        kind: track.kind, 
        source: publication.source,
        participant: participant.identity 
      }));
    this.room.on(RoomEvent.LocalTrackPublished, (publication) => 
      this.logEvent('LocalTrackPublished', { 
        kind: publication.kind, 
        source: publication.source 
      }));
    this.room.on(RoomEvent.LocalTrackUnpublished, (publication) => 
      this.logEvent('LocalTrackUnpublished', { 
        kind: publication.kind, 
        source: publication.source 
      }));
    
    // Error events
    this.room.on(RoomEvent.MediaDevicesError, (e: Error) => 
      this.logEvent('MediaDevicesError', { message: e.message, name: e.name }));
    this.room.on(RoomEvent.ConnectionError, (e: Error) => 
      this.logEvent('ConnectionError', { message: e.message, name: e.name }));
    this.room.on(RoomEvent.SignalConnected, () => 
      this.logEvent('SignalConnected'));
  }

  /**
   * Log an event to the diagnostic events array
   */
  private logEvent(eventName: string, data: any = {}): void {
    if (!this.isRecording) return;
    
    const timestamp = Date.now();
    const timeOffset = timestamp - this.startTime;
    
    this.diagnosticEvents.push({
      eventName,
      timestamp,
      timeOffset,
      ...data
    });
  }
}

// Export a singleton instance
export const livekitDiagnostics = LiveKitDiagnostics.getInstance(); 