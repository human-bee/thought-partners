"use client";

import { Editor, createShapeId, toRichText } from '@tldraw/editor';
import { Room } from 'livekit-client';
import { VideoLogger } from '@/utils/VideoLogger';

// Define flexible shape props that can have either text or richText
export interface NoteShapeProps {
  text?: string;
  richText?: any;
  color: string;
  size: string;
  font: string;
  align: string;
  growY: boolean;
  w: number;
}

// Define settings for transcript chunking
export const TRANSCRIPT_CHUNK_DURATION = 60 * 1000; // 60 seconds in ms

// Add debug flag to control verbose logging
export const DEBUG_MODE = process.env.NODE_ENV === 'development';

// Define an interface for the extended HTMLElement with the editor property
export interface TLDrawElementWithEditor extends HTMLElement {
  __editorForTranscription?: Editor;
}

// Function to locate editor reference using multiple strategies
export const findEditor = (editorRef: React.MutableRefObject<Editor | null>) => {
  if (editorRef.current) return editorRef.current;
  
  // Check global variable first
  if (window.__editorInstance) {
    editorRef.current = window.__editorInstance;
    console.log("Found editor in window.__editorInstance");
    return editorRef.current;
  }
  
  // Try DOM methods
  const tldrawElements = [
    document.querySelector('[data-testid="tldraw-editor"]'),
    document.querySelector('.tldraw'),
    ...Array.from(document.querySelectorAll('[class*="tldraw"]'))
  ];
  
  for (const element of tldrawElements) {
    if (!element) continue;
    
    // Try different property patterns that might contain the editor
    const possibleEditorProps = [
      (element as any).__editor,
      (element as any).__editorForTranscription,
      (element as any).editor
    ];
    
    for (const prop of possibleEditorProps) {
      if (prop) {
        editorRef.current = prop;
        console.log("Found editor in DOM element:", element);
        return editorRef.current;
      }
    }
  }
  
  console.warn("Could not find editor reference");
  return null;
};

// Function to add transcription directly to canvas
export const addTranscriptionToCanvas = (
  text: string, 
  editorRef: React.MutableRefObject<Editor | null>,
  room?: Room
) => {
  console.log(`Adding transcription to canvas: "${text}"`);
  
  // Find the editor if we don't have it yet
  if (!editorRef.current) {
    findEditor(editorRef);
    
    if (!editorRef.current) {
      console.error('Cannot find any editor reference - transcription note creation will fail');
      return;
    }
  }

  const editor = editorRef.current;
  const id = createShapeId();
  console.log('Generated shape ID:', id);

  try {
    // Create a random position that's centered on the screen
    const viewport = editor.getViewportPageBounds();
    console.log('Viewport bounds:', viewport);
    
    const x = viewport.center.x + (Math.random() * 300 - 150);
    const y = viewport.center.y + (Math.random() * 200 - 100);
    
    console.log('Calculated position for note:', { x, y });

    // Create the richText value
    const richTextValue = toRichText(text);
    
    // Prepare note props with flexible types
    const props: NoteShapeProps = {
      color: 'yellow',
      size: 'l',
      font: 'draw',
      align: 'middle',
      growY: true,
      w: 300,
    };
    
    // Check which property to use (richText or text)
    const noteUtil = editor.getShapeUtil('note');
    if (noteUtil) {
      const defaultProps = noteUtil.getDefaultProps?.() || {};
      console.log('Note default props:', defaultProps);
      
      if ('richText' in defaultProps) {
        props.richText = richTextValue;
      } else {
        props.text = text;
      }
    } else {
      // Default to text if we can't check
      props.text = text;
    }
    
    // Create the shape
    const shape = {
      id,
      type: 'note',
      x,
      y,
      props
    };

    console.log('Creating note shape:', shape);
    
    // Use batch with try-catch for robust error handling
    try {
      editor.batch(() => {
        editor.createShapes([shape]);
      });
      console.log('Successfully created shape!');
    } catch (batchError) {
      console.error('Error in batch shape creation:', batchError);
      
      // Try direct method as fallback
      try {
        editor.createShapes([shape]);
        console.log('Shape created using direct method');
      } catch (directError) {
        console.error('Direct shape creation also failed:', directError);
      }
    }

    // Publish the shape data to other participants
    if (room && room.localParticipant) {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({ 
        type: 'transcription', 
        shape,
        timestamp: Date.now() 
      }));
      room.localParticipant.publishData(data, { reliable: true })
        .then(() => console.log('Shape data published to other participants'))
        .catch(error => console.error('Error publishing shape data:', error));
    }
  } catch (error) {
    console.error('Error creating shape:', error);
  }
};

// Function to handle incoming data from LiveKit
export const handleLiveKitData = (
  data: Uint8Array, 
  editorRef: React.MutableRefObject<Editor | null>,
  isTimelineActive: boolean,
  addTextToChunk: (text: string, participantName?: string) => void,
) => {
  console.log('Data received in TranscriptionCanvas:', data?.length || 0, 'bytes');
  
  try {
    // Convert the Uint8Array to a string and parse as JSON
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(data);
    console.log('Decoded data string:', jsonString);
    
    let message;
    try {
      message = JSON.parse(jsonString);
      console.log('Parsed message:', message);
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      return;
    }

    // Check if it's a direct transcription message
    if (message.type === 'transcription' && message.text) {
      console.log('Direct transcription message received:', message);
      
      // Add to current chunk instead of directly to canvas
      if (isTimelineActive) {
        addTextToChunk(message.text);
      } else {
        addTranscriptionToCanvas(message.text, editorRef);
      }
    } 
    // Check if it's a wrapped message with a shape
    else if (message.type === 'transcription' && message.shape) {
      console.log('Transcription with shape received:', message.shape);
      try {
        findEditor(editorRef);
        if (editorRef.current) {
          console.log('Creating shape from received data');
          editorRef.current.createShapes([message.shape]);
          console.log('Shape created from received data');
        } else {
          console.warn('Editor ref not available to create received shape');
        }
      } catch (shapeError) {
        console.error('Error creating shape from received data:', shapeError);
      }
    }
    // Handle wrapped format with topic field (used by CollaborativeBoard)
    else if (message.topic === 'transcription' && message.data) {
      console.log('Wrapped transcription message received:', message);
      try {
        const innerData = JSON.parse(message.data);
        console.log('Successfully parsed inner data:', innerData);
        if (innerData.type === 'transcription' && innerData.text) {
          // Add to current chunk instead of directly to canvas
          if (isTimelineActive) {
            addTextToChunk(innerData.text, innerData.participantName);
          } else {
            const displayText = innerData.participantName 
              ? `${innerData.participantName}: ${innerData.text}`
              : innerData.text;
            
            console.log('Adding wrapped transcription to canvas:', displayText);
            addTranscriptionToCanvas(displayText, editorRef);
          }
        } else {
          console.warn('Inner data missing required fields:', innerData);
        }
      } catch (parseError) {
        console.error('Error parsing inner data:', parseError);
      }
    } else {
      console.log('Message does not match expected transcription formats:', message);
    }
  } catch (error) {
    console.error('Error handling data:', error);
  }
};

// Add global window type augmentation
declare global {
  interface Window {
    __editorInstance?: Editor;
  }
} 