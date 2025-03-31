"use client";

import { DataPacket_Kind } from 'livekit-client';
import { VideoLogger } from '@/utils/VideoLogger';
import { createShapeId } from 'tldraw';

// Define interfaces

export interface TranscriptionEntry {
  participantIdentity: string;
  participantName: string;
  text: string;
  timestamp: Date;
}

export interface DataMessage {
  topic: string;
  data: string;
}

// Define custom type with LiveKit properties we need
export interface ExtendedRoom {
  dataReceived: {
    on: (callback: (data: Uint8Array) => void) => void;
    off: (callback: (data: Uint8Array) => void) => void;
  };
  localParticipant: {
    identity: string;
    name: string;
    publishData: (data: Uint8Array, kind: DataPacket_Kind) => void;
  };
}

// Define TLTextShapeProps to match actual implementation
export interface TLTextShapeProps {
  text: string;
  color: string;
  size: string;
  width: number;
  font: string;
  align: string;
  autoSize: boolean;
  verticalAlign?: string;
}

// Define custom editor type with methods we need
export interface ExtendedEditor {
  getChanges: () => any[];
  createShapes: (shapes: any[]) => void;
  getViewportPageBounds: () => any;
  batch: (callback: () => void) => void;
  bringToFront?: (ids: string[]) => void;
  getShapeUtil: (type: string) => any;
}

// Function to add transcription to canvas
export function addTranscriptionToCanvas(
  entry: TranscriptionEntry, 
  editor: ExtendedEditor
) {
  VideoLogger.info(`Adding transcription to canvas from ${entry.participantName}: ${entry.text}`);
  if (!editor) {
    VideoLogger.warn('Editor is not available for transcription');
    return;
  }
  
  VideoLogger.debug('Editor instance is available:', editor);
  
  try {
    // Create a new note shape (better for transcriptions than text)
    const id = createShapeId();
    VideoLogger.debug('Generated shape ID:', id);
    
    // Format the transcription content
    const displayText = `${entry.participantName}: ${entry.text}`;
    VideoLogger.debug('Creating note with text:', displayText);
    
    // Get the viewport to ensure the note is in view
    const viewport = editor.getViewportPageBounds();
    if (!viewport) {
      VideoLogger.warn('Could not get viewport bounds');
      return;
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noteShape: any = {
      id,
      type: 'note',
      x: viewport.center.x + (Math.random() * 300 - 150),
      y: viewport.center.y + (Math.random() * 200 - 100),
      props: {
        text: displayText, // Use text property if richText isn't supported
        color: 'yellow',
        size: 'm',
        font: 'draw',
        align: 'start',
        growY: true,
      },
    };
    
    // Check if the shape utility supports richText or text
    const noteUtil = editor.getShapeUtil('note');
    if (noteUtil) {
      const defaultProps = noteUtil.getDefaultProps?.();
      if (defaultProps) {
        // Use the proper property based on shape util definition
        if ('richText' in defaultProps) {
          const { toRichText } = require('@tldraw/editor');
          noteShape.props.richText = toRichText(displayText);
          delete noteShape.props.text; // Remove text if richText is supported
        }
      }
    }
    
    VideoLogger.debug('Note shape object:', noteShape);
    
    // Add the shape to the canvas with error handling
    try {
      editor.batch(() => {
        editor.createShapes([noteShape]);
      });
      VideoLogger.debug('Successfully created shape');
    } catch (error) {
      VideoLogger.error('Error in editor.createShapes:', error);
      // Fallback approach
      try {
        const transaction = editor.startTransaction('create_transcription_note');
        editor.createShapes([noteShape]);
        editor.completeTransaction(transaction);
      } catch (fallbackError) {
        VideoLogger.error('Fallback shape creation also failed:', fallbackError);
      }
    }
    
  } catch (error) {
    VideoLogger.error('Error creating transcription note:', error);
  }
}

// Function to publish data through LiveKit
export function publishData(
  localParticipant: any, 
  data: string, 
  topic: string
) {
  if (!localParticipant) return;
  
  try {
    // Convert string to Uint8Array for LiveKit's publishData
    const jsonString = JSON.stringify({ topic, data });
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(jsonString);
    
    // Use any type to avoid type errors
    localParticipant.publishData(uint8Array, DataPacket_Kind.RELIABLE);
  } catch (error) {
    VideoLogger.error('Error publishing data:', error);
  }
} 