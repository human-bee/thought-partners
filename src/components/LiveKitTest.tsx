'use client';

import React, { useState, useRef, useEffect } from 'react';
import { testLiveKitFlow } from '../utils/test-livekit-flow';

function VolumeMeter({ audioTrack }: { audioTrack: MediaStreamTrack }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const audioContextRef = useRef<AudioContext>();
  const analyserRef = useRef<AnalyserNode>();
  const sourceRef = useRef<MediaStreamAudioSourceNode>();

  useEffect(() => {
    if (!canvasRef.current || !audioTrack) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize audio context and analyzer
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Connect audio track to analyzer
    const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
    source.connect(analyser);

    // Store refs for cleanup
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    sourceRef.current = source;

    // Animation function
    const draw = () => {
      if (!ctx || !analyser) return;

      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const volume = Math.min(1, average / 128); // Normalize to 0-1

      // Clear canvas
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw volume bar
      const barWidth = canvas.width * 0.8;
      const barHeight = 20;
      const x = (canvas.width - barWidth) / 2;
      const y = (canvas.height - barHeight) / 2;

      // Background bar
      ctx.fillStyle = '#333';
      ctx.fillRect(x, y, barWidth, barHeight);

      // Volume level
      ctx.fillStyle = volume > 0.6 ? '#ff4444' : volume > 0.3 ? '#44ff44' : '#4444ff';
      ctx.fillRect(x, y, barWidth * volume, barHeight);

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [audioTrack]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={60}
      className="bg-gray-900 rounded"
    />
  );
}

export function LiveKitTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [audioTrack, setAudioTrack] = useState<MediaStreamTrack | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoTrack && videoRef.current) {
      const mediaStream = new MediaStream([videoTrack]);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(console.error);
    }
  }, [videoTrack]);

  const runTest = async () => {
    setIsRunning(true);
    setError(null);
    setLogs([]);
    setVideoTrack(null);
    setAudioTrack(null);

    try {
      const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!serverUrl) {
        throw new Error('LiveKit server URL not configured');
      }

      const roomName = `test-room-${Math.random().toString(36).substring(7)}`;
      const identity = `test-user-${Math.random().toString(36).substring(7)}`;

      const result = await testLiveKitFlow(serverUrl, roomName, identity);
      setLogs(result.logs);
      if (result.videoTrack) {
        setVideoTrack(result.videoTrack);
      }
      if (result.audioTrack) {
        setAudioTrack(result.audioTrack);
      }
    } catch (error) {
      setError(error.message);
      if (error.logs) {
        setLogs(error.logs);
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">LiveKit Authentication Test</h1>
      
      <button
        onClick={runTest}
        disabled={isRunning}
        className={`px-4 py-2 rounded ${
          isRunning 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white font-semibold`}
      >
        {isRunning ? 'Running Test...' : 'Run Test'}
      </button>

      {videoTrack && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Local Video:</h2>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-[320px] h-[240px] bg-gray-900 rounded"
          />
        </div>
      )}

      {audioTrack && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Microphone Level:</h2>
          <VolumeMeter audioTrack={audioTrack} />
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Test Logs:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
            {logs.join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
} 