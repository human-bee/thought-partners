import { useState } from 'react';
import { TranscriptionCanvas } from './transcription/TranscriptionCanvas';
import { TranscriptionControls } from './transcription/TranscriptionControls';
import { TestControls } from './transcription/TestControls';
import { TranscriptionShapeTester } from './transcription/TranscriptionShapeTester';
import { useTranscriptionContext } from '@/contexts/TranscriptionContext';
import { useTimelineContext } from '@/contexts/TimelineContext';
import { Timeline } from './Timeline';

export default function TranscriptionBoard({ roomId }: { roomId: string }) {
  const [showTester, setShowTester] = useState(false);
  const { 
    showTranscription, 
    setShowTranscription, 
    showDebugger, 
    setShowDebugger 
  } = useTranscriptionContext();
  
  // Get timeline context
  const { isTimelineActive, setTimelineActive } = useTimelineContext();
  
  const toggleTranscription = () => setShowTranscription(prev => !prev);
  const toggleDebugger = () => setShowDebugger(prev => !prev);
  const toggleTimeline = () => setTimelineActive(prev => !prev);
  
  return (
    <div className="relative w-full h-full">
      {showTester ? (
        <TranscriptionShapeTester />
      ) : (
        <>
          <TranscriptionCanvas roomId={roomId} />
          {isTimelineActive && <Timeline />}
        </>
      )}
      
      <div className="fixed left-4 top-[200px] w-[220px] flex flex-col gap-3 bg-white/95 p-4 rounded-lg shadow-lg z-[9999] border border-gray-200 backdrop-blur-sm">
        <h3 className="font-bold text-gray-700 text-sm mb-1">Transcription Controls</h3>
        
        <TranscriptionControls />
        
        <div className="h-[1px] bg-gray-200 my-2"></div>
        
        <h3 className="font-bold text-gray-700 text-sm mb-1">Test Tools</h3>
        
        <TestControls />
        
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
        
        <button 
          onClick={toggleTimeline}
          className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded shadow-md font-medium text-sm transition-colors w-full"
        >
          {isTimelineActive ? 'Hide Timeline' : 'Show Timeline'}
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