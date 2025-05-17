"use client";

import React, { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';

export default function LiveKitDebugger() {
  const roomContext = useRoomContext();
  const [debugInfo, setDebugInfo] = useState<{
    roomState: string;
    hasLocalParticipant: boolean;
    canPublish: boolean;
    canSubscribe: boolean;
    canPublishData: boolean;
    participantCount: number;
    identity: string;
    serverUrl: string;
    token: string;
    roomName: string;
    connectionError: string | null;
  }>({
    roomState: 'Not connected',
    hasLocalParticipant: false,
    canPublish: false,
    canSubscribe: false,
    canPublishData: false,
    participantCount: 0,
    identity: '',
    serverUrl: '',
    token: '',
    roomName: '',
    connectionError: null,
  });

  useEffect(() => {
    if (!roomContext?.room) {
      setDebugInfo(prev => ({
        ...prev,
        roomState: 'No room context',
        connectionError: 'Room context is missing or undefined'
      }));
      return;
    }

    const room = roomContext.room;
    
    // Initial update
    updateDebugInfo(room);
    
    // Update on any state change
    const handleStateChange = () => updateDebugInfo(room);
    
    // Listen for connection errors
    const handleError = (error: Error) => {
      setDebugInfo(prev => ({
        ...prev,
        connectionError: error.message
      }));
    };
    
    // Add listeners
    room.on('connectionStateChanged', handleStateChange);
    room.on('participantConnected', handleStateChange);
    room.on('participantDisconnected', handleStateChange);
    room.on('localParticipantPermissionsChanged', handleStateChange);
    room.on('disconnected', handleStateChange);
    room.on('reconnecting', handleStateChange);
    room.on('reconnected', handleStateChange);
    room.on('error', handleError);
    
    return () => {
      // Remove listeners
      room.off('connectionStateChanged', handleStateChange);
      room.off('participantConnected', handleStateChange);
      room.off('participantDisconnected', handleStateChange);
      room.off('localParticipantPermissionsChanged', handleStateChange);
      room.off('disconnected', handleStateChange);
      room.off('reconnecting', handleStateChange);
      room.off('reconnected', handleStateChange);
      room.off('error', handleError);
    };
  }, [roomContext?.room]);

  function updateDebugInfo(room: any) {
    try {
      const participant = room?.localParticipant;
      const permissions = participant?.permissions;

      // Get token from session storage
      const token = sessionStorage.getItem('livekit_token') || 'No token found';
      
      setDebugInfo({
        roomState: room?.state !== undefined ? ConnectionState[room.state] || 'Unknown' : 'No state',
        hasLocalParticipant: !!participant,
        canPublish: !!permissions?.canPublish,
        canSubscribe: !!permissions?.canSubscribe,
        canPublishData: !!permissions?.canPublishData,
        participantCount: room?.participants?.size || 0,
        identity: participant?.identity || 'Unknown',
        serverUrl: room?.connectOptions?.url || 'Unknown',
        token: token ? (token.substring(0, 20) + '...') : 'Not available',
        roomName: room?.name || 'Unknown',
        connectionError: null, // Reset error on successful update
      });
    } catch (error: any) {
      setDebugInfo(prev => ({
        ...prev,
        connectionError: error?.message || 'Error updating debug info'
      }));
    }
  }

  // Styling
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    padding: '10px',
    borderRadius: '5px',
    fontSize: '12px',
    zIndex: 1000,
    maxWidth: '300px',
  };

  const statusStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '5px',
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'Connected':
        return '#4CAF50';
      case 'Connecting':
      case 'Reconnecting':
        return '#FFC107';
      default:
        return '#F44336';
    }
  };

  return (
    <div style={containerStyle}>
      <h3 style={{ margin: '0 0 10px 0' }}>LiveKit Status</h3>
      
      {debugInfo.connectionError && (
        <div style={{ 
          backgroundColor: 'rgba(244, 67, 54, 0.2)', 
          padding: '5px',
          marginBottom: '10px',
          borderRadius: '3px'
        }}>
          <span style={{ color: '#F44336' }}>Error: {debugInfo.connectionError}</span>
        </div>
      )}
      
      <div style={statusStyle}>
        <span>Room State:</span>
        <span style={{ color: getStatusColor(debugInfo.roomState) }}>
          {debugInfo.roomState}
        </span>
      </div>
      
      <div style={statusStyle}>
        <span>Local Participant:</span>
        <span style={{ color: debugInfo.hasLocalParticipant ? '#4CAF50' : '#F44336' }}>
          {debugInfo.hasLocalParticipant ? 'Available' : 'Missing'}
        </span>
      </div>
      
      <div style={statusStyle}>
        <span>Can Publish:</span>
        <span style={{ color: debugInfo.canPublish ? '#4CAF50' : '#F44336' }}>
          {debugInfo.canPublish ? 'Yes' : 'No'}
        </span>
      </div>
      
      <div style={statusStyle}>
        <span>Participants:</span>
        <span>{debugInfo.participantCount}</span>
      </div>
      
      <div style={statusStyle}>
        <span>Room:</span>
        <span>{debugInfo.roomName}</span>
      </div>
      
      <div style={statusStyle}>
        <span>Identity:</span>
        <span>{debugInfo.identity}</span>
      </div>
      
      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <button 
          style={{
            padding: '5px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          Log Token to Console
        </button>
        
        <button 
          style={{
            padding: '5px',
            backgroundColor: '#009688',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          Log Room to Console
        </button>
        
        <button 
          onClick={() => {
            // Trigger reconnection by clearing session storage
            sessionStorage.removeItem('livekit_token');
            sessionStorage.setItem('livekit_needs_new_token', 'true');
            window.location.reload();
          }}
          style={{
            padding: '5px',
            backgroundColor: '#FF5722',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          Force Reconnect
        </button>
      </div>
    </div>
  );
} 