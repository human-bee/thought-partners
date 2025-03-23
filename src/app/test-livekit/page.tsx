'use client';

import React, { useState, useRef, useEffect } from 'react';
import { WebcamHelper } from '@/utils/webcamHelper';
import { clientEnv } from '@/utils/clientEnv';
import { Room, RoomEvent } from 'livekit-client';
import { LiveKitRoom } from '@livekit/components-react';

function AudioTest() {
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    let audioContext: AudioContext;
    let analyser: AnalyserNode;
    let dataArray: Uint8Array;
    let animationFrame: number;

    const startAudioCapture = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioStream(stream);
        
        // Set up audio analysis
        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateAudioLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
          setAudioLevel(average);
          animationFrame = requestAnimationFrame(updateAudioLevel);
        };
        
        updateAudioLevel();
      } catch (error) {
        console.error('Error accessing microphone:', error);
      }
    };

    if (isRecording) {
      startAudioCapture();
    }

    return () => {
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [isRecording]);

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h2 className="text-lg font-semibold mb-4">Audio Test</h2>
      <button
        onClick={() => setIsRecording(!isRecording)}
        className={`px-4 py-2 rounded ${
          isRecording ? 'bg-red-500' : 'bg-green-500'
        } text-white`}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
      {isRecording && (
        <div className="mt-4">
          <div className="text-sm text-gray-600 mb-2">Audio Level:</div>
          <div className="w-full h-4 bg-gray-200 rounded">
            <div
              className="h-full bg-blue-500 rounded transition-all duration-100"
              style={{ width: `${(audioLevel / 255) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function TestWebcamPage() {
  const [activeTab, setActiveTab] = useState<'direct' | 'livekit'>('direct');
  const [isStreaming, setIsStreaming] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // More aggressive environment checking
  useEffect(() => {
    // Force refresh of environment on component mount
    function checkEnv() {
      // Try all possible sources of the environment variable
      let url = '';
      
      // 1. Try window.__ENV if it exists (set by our clientEnv utility)
      if (typeof window !== 'undefined' && (window as any).__ENV?.NEXT_PUBLIC_LIVEKIT_URL) {
        url = (window as any).__ENV.NEXT_PUBLIC_LIVEKIT_URL;
        console.log('Found LiveKit URL in window.__ENV:', url);
      } 
      // 2. Try process.env directly (works in development)
      else if (process.env.NEXT_PUBLIC_LIVEKIT_URL) {
        url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
        console.log('Found LiveKit URL in process.env:', url);
      }
      // 3. Try clientEnv utility (our safe accessor)
      else if (clientEnv.NEXT_PUBLIC_LIVEKIT_URL) {
        url = clientEnv.NEXT_PUBLIC_LIVEKIT_URL;
        console.log('Found LiveKit URL in clientEnv:', url);
      }
      
      // Hard-code the value as fallback for testing
      if (!url) {
        console.warn('LiveKit URL not found in any source, checking hard-coded value...');
        // For testing - remove this in production
        if (typeof window !== 'undefined') {
          console.log('Checking if window has access to env vars:', {
            NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL
          });
          
          // Log all NEXT_PUBLIC_ environment variables
          const nextPublicVars = Object.keys(process.env)
            .filter(key => key.startsWith('NEXT_PUBLIC_'))
            .reduce((obj, key) => {
              obj[key] = process.env[key];
              return obj;
            }, {} as Record<string, string | undefined>);
          
          console.log('All NEXT_PUBLIC_ variables:', nextPublicVars);
        }
      }
      
      setLivekitUrl(url);
      
      console.log('Environment check:', { 
        NEXT_PUBLIC_LIVEKIT_URL: url,
        NODE_ENV: clientEnv.NODE_ENV
      });
    }
    
    // Check immediately
    checkEnv();
    
    // Also check after a short delay to allow Next.js to fully initialize
    const timeout = setTimeout(checkEnv, 1000);
    return () => clearTimeout(timeout);
  }, []);

  const startWebcam = async () => {
    try {
      setMediaError(null);
      const result = await WebcamHelper.startCamera({ 
        video: true, 
        audio: true 
      });
      
      if (result.success && result.stream) {
        if (videoRef.current) {
          videoRef.current.srcObject = result.stream;
          streamRef.current = result.stream;
          setIsStreaming(true);
        }
      } else if (result.message) {
        setMediaError(result.message);
      }
    } catch (error) {
      console.error('Error accessing webcam:', error);
      setMediaError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  };

  const stopWebcam = () => {
    WebcamHelper.stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">LiveKit Test Page</h1>
      <AudioTest />
      <div className="min-h-screen bg-gray-50 p-8">
        <h1 className="text-2xl font-bold mb-4">Webcam Test Page</h1>
        
        {/* Environment info */}
        <div className="mb-6 p-4 bg-gray-100 rounded">
          <h2 className="text-lg font-semibold mb-2">Environment Info:</h2>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <span className="font-medium">LiveKit URL: </span>
              <span className={livekitUrl ? 'text-green-600' : 'text-red-600'}>
                {livekitUrl || 'Not configured'}
              </span>
            </div>
            <div>
              <span className="font-medium">Environment: </span>
              <span>{clientEnv.NODE_ENV}</span>
            </div>
          </div>
        </div>
        
        {/* Tab navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('direct')}
            className={`px-4 py-2 ${
              activeTab === 'direct' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Direct Webcam Access
          </button>
          <button
            onClick={() => setActiveTab('livekit')}
            className={`px-4 py-2 ${
              activeTab === 'livekit' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            LiveKit Integration
          </button>
        </div>
        
        {/* Direct webcam access tab */}
        {activeTab === 'direct' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Direct Webcam Access</h2>
            
            <div className="flex mb-4 space-x-4">
              <button
                onClick={startWebcam}
                disabled={isStreaming}
                className={`px-4 py-2 rounded ${
                  isStreaming ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'
                } text-white font-semibold`}
              >
                Start Camera
              </button>
              
              <button
                onClick={stopWebcam}
                disabled={!isStreaming}
                className={`px-4 py-2 rounded ${
                  !isStreaming ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'
                } text-white font-semibold`}
              >
                Stop Camera
              </button>
            </div>
            
            {mediaError && (
              <div className="my-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                <p><strong>Error:</strong> {mediaError}</p>
              </div>
            )}
            
            <div className="bg-black rounded overflow-hidden">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                muted
                className="w-full max-w-2xl"
                style={{ height: '400px', objectFit: 'contain' }}
              />
            </div>
            
            <div className="mt-4">
              <p className="text-gray-700">
                {isStreaming 
                  ? '✅ Camera is active' 
                  : '❌ Camera is not active'}
              </p>
            </div>
          </div>
        )}
        
        {/* LiveKit integration tab */}
        {activeTab === 'livekit' && (
          <div>
            <h2 className="text-xl font-bold mb-4">LiveKit Integration</h2>
            
            {!livekitUrl ? (
              <div className="p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded mb-4">
                <p className="font-semibold">LiveKit URL is not configured</p>
                <p className="mt-2">
                  Please set the <code className="bg-gray-200 px-1 rounded">NEXT_PUBLIC_LIVEKIT_URL</code> environment 
                  variable in your <code className="bg-gray-200 px-1 rounded">.env.local</code> file.
                </p>
                <p className="mt-2">
                  Environment value set: <code className="bg-gray-200 px-1 rounded">{process.env.NEXT_PUBLIC_LIVEKIT_URL || 'none'}</code>
                </p>
              </div>
            ) : (
              <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded mb-4">
                <p className="font-semibold">LiveKit URL is configured properly:</p>
                <p className="mt-1 font-mono">{livekitUrl}</p>
                <p className="mt-2">
                  To fully test LiveKit integration, implement the functionality on this tab or use the main whiteboard 
                  features of your application.
                </p>
              </div>
            )}
            
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Troubleshooting Common Issues:</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>"process is not defined" error:</strong> This happens when trying to access <code className="bg-gray-200 px-1 rounded">process.env</code> directly in client-side code. Use the <code className="bg-gray-200 px-1 rounded">clientEnv</code> utility instead.
                </li>
                <li>
                  <strong>Error: "Missing LiveKit URL":</strong> Make sure your environment variable is properly set and that you're accessing it safely through the <code className="bg-gray-200 px-1 rounded">clientEnv</code> utility.
                </li>
                <li>
                  <strong>Camera/Microphone not working with LiveKit:</strong> Try testing with the direct access method first to isolate browser permission issues from LiveKit configuration issues.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 