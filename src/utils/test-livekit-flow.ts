import { Room, RoomEvent, RoomOptions, ConnectionState, createLocalVideoTrack, RoomConnectOptions, Participant, createLocalAudioTrack } from 'livekit-client';
import { livekitDebugger } from './livekit-debug';

interface ConnectionDetails {
  roomState: ConnectionState;
  hasLocalParticipant: boolean;
  participantCount: number;
  connectionQuality: string;
  roomName: string;
  participantIdentity: string;
  videoTrack?: MediaStreamTrack;
  audioTrack?: MediaStreamTrack;
}

export async function testLiveKitFlow(serverUrl: string, roomName: string, identity: string) {
  livekitDebugger.clearLogs();
  livekitDebugger.log('Starting LiveKit authentication flow test');

  try {
    // Track connection progress
    const connectionSteps = {
      signalConnected: false,
      participantConnected: false,
      permissionsReceived: false,
      connectionState: 'disconnected' as ConnectionState,
      metadataReceived: false,
      localParticipantConnected: false
    };

    // Validate server URL
    if (!serverUrl.startsWith('ws://') && !serverUrl.startsWith('wss://')) {
      throw new Error(`Invalid server URL format: ${serverUrl}. Must start with ws:// or wss://`);
    }
    livekitDebugger.log(`Using LiveKit server: ${serverUrl}`);

    // Step 1: Get initial token
    livekitDebugger.log('Step 1: Requesting initial token');
    const initialTokenResponse = await fetch('/api/get-token?' + new URLSearchParams({
      room: roomName,
      username: identity
    }));

    if (!initialTokenResponse.ok) {
      const errorText = await initialTokenResponse.text();
      throw new Error(`Failed to get initial token: ${initialTokenResponse.status} - ${errorText}`);
    }

    const { token } = await initialTokenResponse.json();
    
    // Ensure token is a string
    if (typeof token !== 'string') {
      throw new Error('Invalid token format received from server');
    }
    
    livekitDebugger.checkToken(token);

    // Step 2: Configure room options
    livekitDebugger.log('Step 2: Configuring room options');
    const roomOptions: RoomOptions = {
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        simulcast: true,
      },
      videoCaptureDefaults: {
        resolution: { width: 640, height: 480 }
      }
    };

    // Step 3: Create and connect room
    livekitDebugger.log('Step 3: Creating room instance');
    const room = new Room(roomOptions);
    
    // Add more detailed connection state logging
    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      livekitDebugger.log(`Connection state changed to: ${state}`);
      if (state === ConnectionState.Connecting) {
        livekitDebugger.log('Attempting to establish WebSocket connection...');
      } else if (state === ConnectionState.Disconnected) {
        // Log more details about the disconnect
        livekitDebugger.log(`Disconnect details:\n${JSON.stringify({
          lastConnectionState: connectionSteps.connectionState,
          hasLocalParticipant: !!room.localParticipant,
          participantCount: room.numParticipants ?? 0,
          roomName: room.name,
          serverUrl,
          error: room.engine?.client?.ws ? {
            code: room.engine.client.ws.readyState,
            reason: 'WebSocket connection closed'
          } : 'No WebSocket close information'
        }, null, 2)}`, 'warn');
      }
    });

    room.on(RoomEvent.SignalConnected, () => {
      livekitDebugger.log('Signal connection established');
    });

    livekitDebugger.attachToRoom(room);

    // Step 4: Connect to room
    livekitDebugger.log('Step 4: Connecting to room');
    livekitDebugger.log(`Connecting to room "${roomName}" as "${identity}"`);
    
    try {
      await room.connect(serverUrl, token);
      livekitDebugger.log('Initial connection successful');
    } catch (error) {
      livekitDebugger.log(`Connection error: ${error.message}`, 'error');
      throw error;
    }

    // Step 5: Wait for connection and check permissions
    return new Promise((resolve, reject) => {
      const TIMEOUT_DURATION = 30000; // 30 seconds
      let connectionCheckInterval: NodeJS.Timeout;

      // Set up periodic connection state check
      connectionCheckInterval = setInterval(() => {
        const currentState = room.state;
        if (currentState !== connectionSteps.connectionState) {
          connectionSteps.connectionState = currentState;
          livekitDebugger.log(`Connection state updated: ${currentState}`);
        }

        // Check if we're connected but haven't received the Connected event
        if (currentState === 'connected' && room.localParticipant) {
          connectionSteps.localParticipantConnected = true;
          
          // If we're connected and have a local participant, but haven't received the Connected event,
          // manually trigger the connection success flow
          if (!connectionSteps.participantConnected) {
            livekitDebugger.log('Room is connected but Connected event not received. Proceeding with connection...');
            handleConnection();
          }
        }
      }, 1000);

      const timeout = setTimeout(() => {
        clearInterval(connectionCheckInterval);
        const state = room.state;
        const error = new Error(`Connection timeout after ${TIMEOUT_DURATION/1000}s. Final state: ${state}`);
        error.name = 'ConnectionTimeout';
        reject(error);
      }, TIMEOUT_DURATION);

      // Track all possible connection-related events
      room.on(RoomEvent.SignalConnected, () => {
        connectionSteps.signalConnected = true;
        livekitDebugger.log('Signal connection established');
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        connectionSteps.participantConnected = true;
        livekitDebugger.log('Participant connected to room');
      });

      room.on(RoomEvent.RoomMetadataChanged, () => {
        connectionSteps.metadataReceived = true;
        livekitDebugger.log('Room metadata received');
      });

      const handleConnection = async () => {
        clearTimeout(timeout);
        clearInterval(connectionCheckInterval);
        livekitDebugger.log('Step 5: Connected to room, checking permissions');

        try {
          // Log connection details
          const connectionDetails: ConnectionDetails = {
            roomState: room.state,
            hasLocalParticipant: !!room.localParticipant,
            participantCount: room.numParticipants ?? 0,
            connectionQuality: room.localParticipant?.connectionQuality ?? 'unknown',
            roomName: room.name,
            participantIdentity: room.localParticipant?.identity ?? ''
          };
          livekitDebugger.log('Connection details:\n' + JSON.stringify(connectionDetails, null, 2));

          // Check camera permissions
          livekitDebugger.log('Step 6: Checking camera permissions');
          try {
            const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
            livekitDebugger.log(`Camera permission state: ${cameraPermission.state}`);

            // If camera permission is denied, log it but continue
            if (cameraPermission.state === 'denied') {
              livekitDebugger.log('Camera permission is denied by browser', 'warn');
            }
          } catch (permError) {
            livekitDebugger.log(`Error checking camera permissions: ${permError}`, 'error');
            // Continue despite permission check error
          }

          // Try to publish video and audio tracks
          livekitDebugger.log('Step 7: Attempting to publish media tracks');
          try {
            if (!room.localParticipant) {
              throw new Error('No local participant available');
            }

            // First check if we can create a video track
            livekitDebugger.log('Creating video track...');
            const videoTrack = await createLocalVideoTrack();
            livekitDebugger.log('Successfully created video track');

            // Then try to publish it
            livekitDebugger.log('Publishing video track...');
            await room.localParticipant.publishTrack(videoTrack);
            livekitDebugger.log('Successfully published video track');

            // Store the video track to return it later
            connectionDetails.videoTrack = videoTrack.mediaStreamTrack;

            // Now create and publish audio track
            livekitDebugger.log('Creating audio track...');
            const audioTrack = await createLocalAudioTrack();
            livekitDebugger.log('Successfully created audio track');

            // Then try to publish it
            livekitDebugger.log('Publishing audio track...');
            await room.localParticipant.publishTrack(audioTrack);
            livekitDebugger.log('Successfully published audio track');

            // Store the audio track to return it later
            connectionDetails.audioTrack = audioTrack.mediaStreamTrack;
          } catch (e) {
            livekitDebugger.log(`Failed to handle media tracks: ${e}`, 'error');
            if (e instanceof Error) {
              livekitDebugger.log(`Error stack: ${e.stack}`, 'error');
            }
          }

          // Check all permissions
          const permissions = room.localParticipant?.permissions;
          connectionSteps.permissionsReceived = !!permissions;
          livekitDebugger.log('Final permission check:');
          livekitDebugger.log(`- Can Publish: ${permissions?.canPublish ?? 'unknown'}`);
          livekitDebugger.log(`- Can Subscribe: ${permissions?.canSubscribe ?? 'unknown'}`);
          livekitDebugger.log(`- Can Publish Data: ${permissions?.canPublishData ?? 'unknown'}`);
          livekitDebugger.log(`- Allowed Sources: ${permissions?.canPublishSources?.join(', ') ?? 'none'}`);

          // Log final connection state before resolving
          livekitDebugger.log('Final connection state check:');
          livekitDebugger.log(`- Room state: ${room.state}`);
          livekitDebugger.log(`- Connection steps completed: ${JSON.stringify(connectionSteps, null, 2)}`);

          resolve({
            success: true,
            logs: livekitDebugger.getLogs(),
            permissions,
            connectionSteps,
            videoTrack: connectionDetails.videoTrack,
            audioTrack: connectionDetails.audioTrack
          });
        } catch (error) {
          livekitDebugger.log(`Connection handling failed: ${error}`, 'error');
          if (error instanceof Error) {
            livekitDebugger.log(`Error stack: ${error.stack}`, 'error');
          }
          reject(error);
        }
      };

      // Handle the Connected event normally
      room.once(RoomEvent.Connected, handleConnection);

      room.once(RoomEvent.Disconnected, () => {
        clearTimeout(timeout);
        clearInterval(connectionCheckInterval);
        
        // Enhanced disconnect logging
        const disconnectInfo = {
          steps: connectionSteps,
          finalState: room.state,
          wsState: room.engine?.client?.ws?.readyState ?? 'unknown',
          wsReason: 'WebSocket connection closed',
          hasLocalParticipant: !!room.localParticipant,
          localParticipantState: room.localParticipant ? {
            identity: room.localParticipant.identity,
            sid: room.localParticipant.sid,
            connectionQuality: room.localParticipant.connectionQuality,
            permissions: room.localParticipant.permissions
          } : null
        };
        
        livekitDebugger.log('Connection status when disconnected:\n' + JSON.stringify(disconnectInfo, null, 2));
        reject(new Error(`Room disconnected during test. Details: ${JSON.stringify(disconnectInfo)}`));
      });
    });
  } catch (error) {
    livekitDebugger.log(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    throw {
      message: error instanceof Error ? error.message : 'Unknown error',
      logs: livekitDebugger.getLogs()
    };
  }
} 