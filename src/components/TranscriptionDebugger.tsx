"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { VideoLogger } from '@/utils/VideoLogger';
import { TestControls } from './TranscriptionCanvas';
import { useRoomContext } from '@livekit/components-react';

export default function TranscriptionDebugger() {
  const [logs, setLogs] = useState<{level: string, message: string, timestamp: string}[]>([]);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [receivedData, setReceivedData] = useState<any[]>([]);
  const room = useRoomContext();

  // Override console methods to capture logs
  useEffect(() => {
    const originalConsoleLog = console.log;
    const originalConsoleDebug = console.debug;
    const originalConsoleInfo = console.info;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    const addLog = (level: string, args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      if (message.includes('transcript') || message.includes('Transcript')) {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        setLogs(prev => [...prev.slice(-30), { level, message, timestamp }]);
        
        // Capture transcription text specifically
        if (message.includes('Final transcript:')) {
          const match = message.match(/Final transcript:(.*)/);
          if (match?.[1]) {
            setLastTranscript(match[1].trim());
          }
        }
      }
    };

    console.log = (...args) => {
      originalConsoleLog(...args);
      addLog('log', args);
    };

    console.debug = (...args) => {
      originalConsoleDebug(...args);
      addLog('debug', args);
    };

    console.info = (...args) => {
      originalConsoleInfo(...args);
      addLog('info', args);
    };

    console.warn = (...args) => {
      originalConsoleWarn(...args);
      addLog('warn', args);
    };

    console.error = (...args) => {
      originalConsoleError(...args);
      addLog('error', args);
    };

    return () => {
      console.log = originalConsoleLog;
      console.debug = originalConsoleDebug;
      console.info = originalConsoleInfo;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    };
  }, []);

  // Listen for LiveKit data messages
  useEffect(() => {
    if (!room) return;
    
    const handleData = (data: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(data);
        console.log('RAW DATA RECEIVED:', jsonString);
        
        try {
          const message = JSON.parse(jsonString);
          if (message.topic === 'transcription') {
            setReceivedData(prev => [...prev.slice(-5), message]);
          }
        } catch (e) {
          console.error('Error parsing data message', e);
        }
      } catch (error) {
        console.error('Error handling data', error);
      }
    };
    
    room.on('dataReceived', handleData);
    
    return () => {
      room.off('dataReceived', handleData);
    };
  }, [room]);

  // Create a manual test message to verify data channel
  const sendTestMessage = useCallback(() => {
    if (!room?.localParticipant) {
      console.error('Room or local participant not available');
      return;
    }
    
    try {
      const testMessage = JSON.stringify({
        topic: 'transcription',
        data: JSON.stringify({
          type: 'transcription',
          participantIdentity: room.localParticipant.identity,
          participantName: room.localParticipant.identity || 'Test User',
          text: 'This is a manual test transcription at ' + new Date().toLocaleTimeString()
        })
      });
      
      console.log('Sending test message:', testMessage);
      const data = new TextEncoder().encode(testMessage);
      room.localParticipant.publishData(data, { reliable: true })
        .then(() => console.log('Test message sent successfully'))
        .catch(err => console.error('Failed to send test message', err));
    } catch (e) {
      console.error('Error preparing test message:', e);
    }
  }, [room]);

  return (
    <div className="fixed top-0 left-0 w-96 h-screen z-50 bg-gray-800 bg-opacity-90 text-white p-4 overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">Transcription Debugger</h2>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Test Controls</h3>
        <div className="flex flex-col gap-2">
          <TestControls />
          <button 
            className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded"
            onClick={sendTestMessage}
          >
            Send Test Transcription
          </button>
        </div>
      </div>
      
      {lastTranscript && (
        <div className="mb-6 p-3 bg-gray-700 rounded">
          <h3 className="text-lg font-semibold mb-1">Last Transcript:</h3>
          <p className="text-green-300">{lastTranscript}</p>
        </div>
      )}
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Received Data ({receivedData.length})</h3>
        <div className="max-h-40 overflow-y-auto bg-gray-700 p-2 rounded">
          {receivedData.length === 0 ? (
            <p className="text-gray-400 italic">No data received yet</p>
          ) : (
            receivedData.map((item, i) => (
              <div key={i} className="mb-2 text-xs border-b border-gray-600 pb-1">
                <pre className="whitespace-pre-wrap break-all">{JSON.stringify(item, null, 2)}</pre>
              </div>
            ))
          )}
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-2">Transcript Logs</h3>
        <div className="h-80 overflow-y-auto bg-gray-700 p-2 rounded">
          {logs.map((log, idx) => (
            <div 
              key={idx} 
              className={`mb-1 text-xs ${
                log.level === 'error' ? 'text-red-300' : 
                log.level === 'warn' ? 'text-yellow-300' : 
                log.level === 'info' ? 'text-blue-300' : 
                'text-gray-300'
              }`}
            >
              <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 