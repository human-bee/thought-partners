"use client";

import { useState } from 'react';
import { TranscriptionCanvas } from './transcription/TranscriptionCanvas';
import { TranscriptionControls } from './transcription/TranscriptionControls';
import { useTranscriptionContext } from '@/contexts/TranscriptionContext';
import CollaborativeBoard from './CollaborativeBoard';

export default function TranscriptionBoard({ roomId }: { roomId: string }) {
  const [showTester, setShowTester] = useState(false);
  const { 
    showTranscription, 
    setShowTranscription, 
    showDebugger, 
    setShowDebugger 
  } = useTranscriptionContext();
  
  // Layer visibility state (move up from CollaborativeBoard)
  const [transcriptVisible, setTranscriptVisible] = useState(true);
  const [agentsVisible, setAgentsVisible] = useState(true);
  const setLayerVisibility = (kind: string, visible: boolean) => {
    if (kind === 'transcript') setTranscriptVisible(visible);
    if (kind === 'agent') setAgentsVisible(visible);
  };
  
  const toggleTranscription = () => setShowTranscription(prev => !prev);
  const toggleDebugger = () => setShowDebugger(prev => !prev);
  
  return (
    <div className="relative w-full h-full">
      {showTester ? (
        <TranscriptionCanvas roomId={roomId} />
      ) : (
        <TranscriptionCanvas roomId={roomId} />
      )}
      
      {/* Main collaborative board */}
      <CollaborativeBoard
        transcriptVisible={transcriptVisible}
        agentsVisible={agentsVisible}
      />
      
      <div className="fixed left-4 top-[200px] w-[220px] flex flex-col gap-3 bg-white/95 p-4 rounded-lg shadow-lg z-[9999] border border-gray-200 backdrop-blur-sm">
        <h3 className="font-bold text-gray-700 text-sm mb-1">Transcription Controls</h3>
        
        <TranscriptionControls />
        
        <div className="h-[1px] bg-gray-200 my-2"></div>
        
        {/* --- Layer Visibility Toggles --- */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={transcriptVisible}
            onChange={e => setLayerVisibility('transcript', e.target.checked)}
          />
          Show Transcript
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={agentsVisible}
            onChange={e => setLayerVisibility('agent', e.target.checked)}
          />
          Show Agents
        </label>
        <button
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded shadow-md font-medium text-sm transition-colors w-full mt-2"
          onClick={() => {
            setLayerVisibility('transcript', true);
            setLayerVisibility('agent', true);
          }}
        >
          Reset Visibility
        </button>
        
        <div className="h-[1px] bg-gray-200 my-2"></div>
        
        <button 
          onClick={toggleTranscription}
          className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded shadow-md font-medium text-sm transition-colors w-full"
        >
          {showTranscription ? 'Hide Transcription' : 'Show Transcription'}
        </button>
        
        <button 
          onClick={toggleDebugger}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded shadow-md font-medium text-sm transition-colors w-full"
        >
          {showDebugger ? 'Hide Debug' : 'Show Debug'}
        </button>
        
        <div className="h-[1px] bg-gray-200 my-2"></div>
        
        <button 
          onClick={() => setShowTester(!showTester)}
          className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded shadow-md transition-colors w-full text-sm font-medium"
        >
          {showTester ? 'Show Regular Canvas' : 'Debug Shape Creation'}
        </button>
      </div>
    </div>
  );
} 