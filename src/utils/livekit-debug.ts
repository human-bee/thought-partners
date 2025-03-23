import { Room, RoomEvent, ConnectionState } from 'livekit-client';

class LiveKitDebugger {
  private logs: string[] = [];
  private room: Room | null = null;

  clearLogs() {
    this.logs = [];
    console.clear();
    console.log('LiveKit Debug Session Started');
  }

  log(message: string, level: 'info' | 'error' | 'warn' = 'info') {
    try {
      // Ensure level is a valid string
      const validLevel = typeof level === 'string' && ['info', 'error', 'warn'].includes(level) ? level : 'info';
      
      const timestamp = new Date().toISOString();
      const logMessage = `[LiveKit ${timestamp}] ${validLevel.toUpperCase()}: ${message}`;
      
      // Always log to console for visibility
      switch(validLevel) {
        case 'error':
          console.error(logMessage);
          break;
        case 'warn':
          console.warn(logMessage);
          break;
        default:
          console.log(logMessage);
      }
      
      this.logs.push(logMessage);
    } catch (error) {
      // Fallback logging in case of errors
      const fallbackMessage = `[LiveKit ${new Date().toISOString()}] ERROR: ${message} (Logging error: ${error})`;
      console.error(fallbackMessage);
      this.logs.push(fallbackMessage);
    }
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  attachToRoom(room: Room) {
    try {
      if (!room) {
        this.log('Cannot attach debugger: Room is null', 'error');
        return;
      }

      this.room = room;
      this.log('Attaching debugger to room');
      
      // Track all room events
      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        try {
          this.log(`Room connection state changed to: ${state}`);
          
          // Log additional details based on state
          switch(state) {
            case ConnectionState.Connecting:
              this.log('Attempting to establish WebSocket connection...', 'info');
              break;
            case ConnectionState.Connected:
              this.logConnectionDetails(room);
              break;
            case ConnectionState.Disconnected:
              this.log('Room disconnected - checking disconnect reason', 'warn');
              break;
            case ConnectionState.Failed:
              this.log('Connection failed - will log error details', 'error');
              break;
          }
        } catch (error) {
          this.log(`Error handling connection state change: ${error}`, 'error');
        }
      });

      room.on(RoomEvent.SignalConnected, () => {
        try {
          this.log('Signal connection established');
          this.logConnectionDetails(room);
        } catch (error) {
          this.log(`Error handling signal connection: ${error}`, 'error');
        }
      });

      room.on(RoomEvent.ParticipantConnected, (participant) => {
        try {
          this.log(`Participant connected: ${participant?.identity ?? 'unknown'}`);
        } catch (error) {
          this.log(`Error handling participant connection: ${error}`, 'error');
        }
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        try {
          this.log(`Participant disconnected: ${participant?.identity ?? 'unknown'}`);
        } catch (error) {
          this.log(`Error handling participant disconnection: ${error}`, 'error');
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        try {
          this.log('Room disconnected event received');
          this.logConnectionDetails(room);
        } catch (error) {
          this.log(`Error handling room disconnection: ${error}`, 'error');
        }
      });

      room.on(RoomEvent.Reconnecting, () => {
        try {
          this.log('Attempting to reconnect...', 'warn');
        } catch (error) {
          this.log(`Error handling reconnection attempt: ${error}`, 'error');
        }
      });

      room.on(RoomEvent.Reconnected, () => {
        try {
          this.log('Successfully reconnected');
          this.logConnectionDetails(room);
        } catch (error) {
          this.log(`Error handling reconnection: ${error}`, 'error');
        }
      });

      room.on(RoomEvent.MediaDevicesError, (e: Error) => {
        try {
          this.log(`Media devices error: ${e?.message ?? 'Unknown error'}`, 'error');
        } catch (error) {
          this.log(`Error handling media device error: ${error}`, 'error');
        }
      });

      // Log initial state
      this.logConnectionDetails(room);
    } catch (error) {
      this.log(`Error attaching debugger to room: ${error}`, 'error');
      console.error('Full error:', error);
    }
  }

  private logConnectionDetails(room: Room) {
    try {
      this.log('Connection Details:', 'info');
      this.log(`- Room State: ${room?.state ?? 'unknown'}`);
      this.log(`- Room Name: ${room?.name ?? 'unknown'}`);
      this.log(`- Local Participant: ${room?.localParticipant?.identity ?? 'not connected'}`);
      this.log(`- Participant Count: ${room?.participants?.size ?? 0}`);
      
      const permissions = room?.localParticipant?.permissions;
      if (permissions) {
        this.log(`- Local Permissions: ${JSON.stringify(permissions)}`);
      } else {
        this.log('- Local Permissions: none', 'warn');
      }
    } catch (error) {
      this.log(`Error logging connection details: ${error}`, 'error');
      console.error('Full error:', error);
    }
  }

  checkToken(token: string) {
    if (!token) {
      this.log('Token is missing', 'error');
      return;
    }

    if (typeof token !== 'string') {
      this.log(`Invalid token type: ${typeof token}`, 'error');
      return;
    }

    try {
      // Basic JWT structure check
      const parts = token.split('.');
      if (parts.length !== 3) {
        this.log('Invalid token structure - not a valid JWT format', 'error');
        return;
      }

      // Decode payload
      const payload = JSON.parse(atob(parts[1]));
      this.log('Token validation passed - JWT structure is valid');
      
      // Log the entire payload for debugging
      console.log('Token payload:', payload);
      
      // Check critical fields
      const missingFields = [];
      if (!payload.video?.room) missingFields.push('room');
      if (!payload.sub) missingFields.push('identity');
      if (!payload.exp) missingFields.push('expiration');
      
      if (missingFields.length > 0) {
        this.log(`Token missing critical fields: ${missingFields.join(', ')}`, 'error');
      } else {
        this.log('Token contains all required fields');
      }

      // Check permissions
      const permissions = payload.video;
      if (permissions) {
        this.log('Token permissions:', 'info');
        this.log(`- Room: ${permissions.room}`);
        this.log(`- Can Join: ${permissions.roomJoin}`);
        this.log(`- Can Publish: ${permissions.canPublish}`);
        this.log(`- Can Subscribe: ${permissions.canSubscribe}`);
        this.log(`- Can Publish Data: ${permissions.canPublishData}`);
        this.log(`- Can Publish Audio: ${permissions.canPublishAudio}`);
        this.log(`- Can Publish Video: ${permissions.canPublishVideo}`);
        if (permissions.canPublishSources) {
          this.log(`- Allowed Sources: ${permissions.canPublishSources.join(', ')}`);
        }
      } else {
        this.log('Token missing video permissions section', 'error');
      }

      // Check expiration
      if (payload.exp) {
        const expiresAt = new Date(payload.exp * 1000);
        const now = new Date();
        if (expiresAt < now) {
          this.log(`Token has expired at ${expiresAt.toISOString()}`, 'error');
        } else {
          this.log(`Token expires at ${expiresAt.toISOString()}`);
        }
      }
    } catch (error) {
      this.log(`Token validation failed: ${error}`, 'error');
      console.error('Full token validation error:', error);
    }
  }
}

export const livekitDebugger = new LiveKitDebugger(); 