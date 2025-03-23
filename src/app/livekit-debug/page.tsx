'use client';

import React, { useState, useEffect, useRef } from 'react';
import { livekitDiagnostics } from '../../utils/livekit-diagnostics';
import { Room } from 'livekit-client';

export default function LiveKitDebugPage() {
  const [roomName, setRoomName] = useState('');
  const [identity, setIdentity] = useState('');
  const [serverUrl, setServerUrl] = useState(process.env.NEXT_PUBLIC_LIVEKIT_URL || '');
  const [token, setToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [localVideo, setLocalVideo] = useState<MediaStream | null>(null);
  
  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Effect to update video element when local video is available
  useEffect(() => {
    if (videoRef.current && localVideo) {
      videoRef.current.srcObject = localVideo;
    }
  }, [localVideo, videoRef]);
  
  // Handle form submission
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isConnected) {
      // Disconnect if already connected
      try {
        if (roomRef.current) {
          await roomRef.current.disconnect();
          roomRef.current = null;
          setIsConnected(false);
          setConnectionStatus('Disconnected');
          setLogs([]);
          setDiagnostics(null);
          
          // Stop any local video
          if (localVideo) {
            localVideo.getTracks().forEach(track => track.stop());
            setLocalVideo(null);
          }
        }
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
      return;
    }
    
    setIsConnecting(true);
    setConnectionStatus('Connecting...');
    
    try {
      // Get a token if not provided
      let currentToken = token;
      if (!currentToken) {
        const tokenResponse = await fetch('/api/get-token?' + new URLSearchParams({
          room: roomName,
          username: identity
        }));
        
        if (!tokenResponse.ok) {
          throw new Error(`Failed to get token: ${tokenResponse.status}`);
        }
        
        const tokenData = await tokenResponse.json();
        currentToken = tokenData.token;
        setToken(currentToken);
      }
      
      // Create a new room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          simulcast: true,
        }
      });
      
      // Attach the diagnostics
      livekitDiagnostics.attachToRoom(room);
      livekitDiagnostics.startRecording();
      
      // Set the room ref
      roomRef.current = room;
      
      // Connect to the room
      await room.connect(serverUrl, currentToken);
      
      // Try to get local video
      try {
        const tracks = await room.localParticipant.enableCameraAndMicrophone();
        const videoTrack = tracks.find(track => track.kind === 'video');
        if (videoTrack) {
          const mediaStream = new MediaStream([videoTrack.mediaStreamTrack]);
          setLocalVideo(mediaStream);
        }
      } catch (mediaError) {
        console.error('Error getting media:', mediaError);
      }
      
      setIsConnected(true);
      setConnectionStatus('Connected');
      setIsConnecting(false);
      
    } catch (error) {
      console.error('Connection error:', error);
      setConnectionStatus(`Error: ${(error as Error).message}`);
      setIsConnecting(false);
    }
  };
  
  // Run diagnostics
  const handleRunDiagnostics = async () => {
    if (!roomRef.current) {
      alert('You must connect to a room first');
      return;
    }
    
    try {
      const diagnosticResults = await livekitDiagnostics.runDiagnostics();
      setDiagnostics(diagnosticResults);
      
      // Send diagnostics to server
      await fetch('/api/livekit-diagnostics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ diagnostics: diagnosticResults })
      });
      
    } catch (error) {
      console.error('Error running diagnostics:', error);
      alert(`Error running diagnostics: ${(error as Error).message}`);
    }
  };
  
  // Get logs
  const handleGetLogs = () => {
    if (!roomRef.current) {
      alert('You must connect to a room first');
      return;
    }
    
    const eventLogs = livekitDiagnostics.getDiagnosticEvents();
    setLogs(eventLogs);
  };
  
  // Test mic and camera functionality
  const handleTestDevices = async () => {
    try {
      // Request user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      // Set the local video
      setLocalVideo(stream);
      
      // Alert success
      alert('Camera and microphone access successful');
      
    } catch (error) {
      console.error('Error accessing devices:', error);
      alert(`Error accessing camera or microphone: ${(error as Error).message}`);
    }
  };
  
  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">LiveKit Debug Tool</h1>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h2 className="text-xl font-semibold mb-2">Connection Setup</h2>
            <form onSubmit={handleConnect}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Server URL</label>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={e => setServerUrl(e.target.value)}
                  placeholder="wss://your-livekit-server.com"
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Room Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  placeholder="test-room"
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Identity</label>
                <input
                  type="text"
                  value={identity}
                  onChange={e => setIdentity(e.target.value)}
                  placeholder="test-user"
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Token (optional)</label>
                <input
                  type="text"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Leave blank to generate automatically"
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <button
                type="submit"
                disabled={isConnecting}
                className={`w-full p-2 rounded text-white font-medium ${
                  isConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
              </button>
            </form>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Testing Tools</h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleTestDevices}
                className="p-2 bg-green-500 hover:bg-green-600 text-white rounded"
              >
                Test Camera & Microphone
              </button>
              
              <button
                onClick={handleRunDiagnostics}
                disabled={!isConnected}
                className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded disabled:bg-gray-300"
              >
                Run Connection Diagnostics
              </button>
              
              <button
                onClick={handleGetLogs}
                disabled={!isConnected}
                className="p-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded disabled:bg-gray-300"
              >
                View Connection Logs
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex-1">
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h2 className="text-xl font-semibold mb-2">Connection Status</h2>
            <div className={`p-2 rounded mb-2 ${
              connectionStatus === 'Connected' ? 'bg-green-100 text-green-800' : 
              connectionStatus === 'Connecting...' ? 'bg-yellow-100 text-yellow-800' : 
              connectionStatus.startsWith('Error') ? 'bg-red-100 text-red-800' : 
              'bg-gray-100'
            }`}>
              {connectionStatus}
            </div>
            
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-48 bg-black rounded ${localVideo ? 'opacity-100' : 'opacity-50'}`}
            />
            <div className="text-sm text-center mt-1">
              {localVideo ? 'Local Camera' : 'No camera feed available'}
            </div>
          </div>
        </div>
      </div>
      
      {logs.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <h2 className="text-xl font-semibold mb-2">Connection Logs</h2>
          <div className="bg-gray-900 text-gray-100 p-2 rounded h-60 overflow-auto">
            <pre className="text-xs">
              {logs.map((log, i) => (
                <div key={i} className="mb-1">
                  [{new Date(log.timestamp).toISOString()}] [{log.timeOffset}ms] {log.eventName} 
                  {Object.keys(log).filter(k => !['eventName', 'timestamp', 'timeOffset'].includes(k)).length > 0 && 
                    ` - ${JSON.stringify(Object.fromEntries(
                      Object.entries(log).filter(([k]) => !['eventName', 'timestamp', 'timeOffset'].includes(k))
                    ))}`
                  }
                </div>
              ))}
            </pre>
          </div>
        </div>
      )}
      
      {diagnostics && (
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <h2 className="text-xl font-semibold mb-2">Diagnostics Results</h2>
          
          {diagnostics.issues && diagnostics.issues.length > 0 && (
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-1">Issues Detected</h3>
              <ul className="bg-red-50 p-2 rounded list-disc list-inside">
                {diagnostics.issues.map((issue: string, i: number) => (
                  <li key={i} className="text-red-700">{issue}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-medium mb-1">Browser Information</h3>
              <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs">
                {JSON.stringify(diagnostics.browserInfo, null, 2)}
              </pre>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-1">Network Information</h3>
              <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs">
                {JSON.stringify(diagnostics.networkInfo, null, 2)}
              </pre>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-1">Media Devices</h3>
              <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs">
                {JSON.stringify(diagnostics.mediaDevices, null, 2)}
              </pre>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-1">Connection Summary</h3>
              <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs">
                {JSON.stringify(diagnostics.connectionSummary, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 