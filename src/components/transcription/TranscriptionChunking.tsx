"use client";

import { useRef, useCallback } from 'react';
import { createShapeId } from '@tldraw/editor';
import { TRANSCRIPT_CHUNK_DURATION, DEBUG_MODE } from './TranscriptionUtils';
import { VideoLogger } from '@/utils/VideoLogger';

export interface TimelineNote {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  position: {
    x: number;
    y: number;
  };
}

export interface TranscriptChunk {
  text: string;
  startTime: number;
  lastUpdate: number;
}

export interface UseTranscriptionChunkingProps {
  isTimelineActive: boolean;
  addTimelineNote: (note: TimelineNote) => void;
  getCurrentTimestamp: () => number;
  addTranscriptionToCanvas: (text: string) => void;
  findEditor: () => void;
}

export function useTranscriptionChunking({
  isTimelineActive,
  addTimelineNote,
  getCurrentTimestamp,
  addTranscriptionToCanvas,
  findEditor
}: UseTranscriptionChunkingProps) {
  // Reference to track current transcript chunk
  const currentChunkRef = useRef<TranscriptChunk>({
    text: '',
    startTime: 0,
    lastUpdate: 0
  });

  // Initialize chunk
  const initializeChunk = useCallback(() => {
    currentChunkRef.current = {
      text: '',
      startTime: getCurrentTimestamp(),
      lastUpdate: getCurrentTimestamp()
    };
  }, [getCurrentTimestamp]);

  // Function to finalize a transcript chunk and create a note
  const finalizeTranscriptChunk = useCallback(() => {
    const chunk = currentChunkRef.current;
    
    // Only proceed if there's text in the chunk
    if (chunk.text.trim() === '') return;
    
    if (DEBUG_MODE) {
      VideoLogger.debug(`Finalizing transcript chunk: ${chunk.text}`);
    }
    
    // Create a note from the chunk
    const noteId = createShapeId();
    const notePosition = { x: 0, y: 0 }; // Will be calculated based on timeline positioning
    
    // Make sure we have an editor reference
    findEditor();
    
    // Decide if note is on left or right side (alternate sides)
    const notesCount = document.querySelectorAll('[data-shape-type="note"]').length || 0;
    notePosition.x = notesCount % 2 === 0 ? -1 : 1; // -1 for left, 1 for right
    
    // Add note to timeline if timeline is active
    if (isTimelineActive) {
      addTimelineNote({
        id: noteId.toString(),
        text: chunk.text,
        startTime: chunk.startTime,
        endTime: chunk.lastUpdate,
        position: notePosition
      });
      
      if (DEBUG_MODE) {
        VideoLogger.debug(`Added note to timeline: ${chunk.text}`);
      }
    }
    
    // Also add the note to the canvas
    addTranscriptionToCanvas(chunk.text);
    
    // Reset the chunk
    currentChunkRef.current = {
      text: '',
      startTime: getCurrentTimestamp(),
      lastUpdate: getCurrentTimestamp()
    };
    
  }, [addTimelineNote, getCurrentTimestamp, isTimelineActive, findEditor, addTranscriptionToCanvas]);

  // Check if chunk needs to be finalized due to time or length
  const checkAndFinalizeChunk = useCallback(() => {
    const chunk = currentChunkRef.current;
    const currentTime = getCurrentTimestamp();
    
    // Finalize if chunk duration exceeds the limit
    if (currentTime - chunk.startTime >= TRANSCRIPT_CHUNK_DURATION) {
      finalizeTranscriptChunk();
      return true;
    }
    
    return false;
  }, [finalizeTranscriptChunk, getCurrentTimestamp]);

  // Add text to the current chunk
  const addTextToChunk = useCallback((text: string, participantName?: string) => {
    // Format text with participant name if available
    const formattedText = participantName ? `${participantName}: ${text}` : text;
    
    // Get current chunk
    const chunk = currentChunkRef.current;
    
    // If this is the first text in a new chunk, set the start time
    if (chunk.text === '') {
      chunk.startTime = getCurrentTimestamp();
    }
    
    // Add text to chunk with space or newline
    if (chunk.text) {
      chunk.text += ' ' + formattedText;
    } else {
      chunk.text = formattedText;
    }
    
    // Update last update time
    chunk.lastUpdate = getCurrentTimestamp();
    
    // Check if we need to finalize this chunk
    checkAndFinalizeChunk();
  }, [checkAndFinalizeChunk, getCurrentTimestamp]);

  return {
    currentChunkRef,
    initializeChunk,
    finalizeTranscriptChunk,
    checkAndFinalizeChunk,
    addTextToChunk
  };
} 