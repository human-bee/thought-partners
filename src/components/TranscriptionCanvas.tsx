"use client";

import { TranscriptionCanvas as RefactoredTranscriptionCanvas } from './transcription/TranscriptionCanvas';
import { TestControls } from './transcription/TestControls';

// Export components from the refactored structure
export { TestControls };

interface TranscriptionCanvasProps {
  roomId: string;
}

// Main component that uses the refactored implementation
export function TranscriptionCanvas({ roomId }: TranscriptionCanvasProps) {
  return <RefactoredTranscriptionCanvas roomId={roomId} />;
} 