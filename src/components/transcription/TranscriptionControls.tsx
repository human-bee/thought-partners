"use client";

import { useSpeechRecognition } from './useSpeechRecognition';

export function TranscriptionControls() {
  const { isTranscribing, startTranscription, stopTranscription, error } = useSpeechRecognition();

  return (
    <div className="w-full">
      {error && (
        <div className="mb-2 text-sm font-medium text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
      <div className="flex items-center">
        <button
          onClick={isTranscribing ? stopTranscription : startTranscription}
          className={`px-3 py-2 rounded text-white font-medium text-sm w-full transition-colors ${
            isTranscribing ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {isTranscribing ? 'Stop Transcribing' : 'Start Transcribing'}
          {isTranscribing && (
            <span 
              className="ml-2 inline-block w-3 h-3 bg-white rounded-full animate-pulse" 
              title="Recording in progress"
            />
          )}
        </button>
      </div>
    </div>
  );
} 