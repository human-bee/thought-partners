import { useEffect, useRef, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { Editor, createShapeId, toRichText } from '@tldraw/editor';
import { Tldraw } from '@tldraw/tldraw';
import { DataPublishOptions } from 'livekit-client';
import { VideoLogger } from '@/utils/VideoLogger';
import { useTimelineContext } from '@/contexts/TimelineContext';

// Add a simple debug flag to control verbose logging
const DEBUG_MODE = false;

// Define settings for transcript chunking
const TRANSCRIPT_CHUNK_DURATION = 60 * 1000; // 60 seconds in ms

// Define an interface for the extended HTMLElement with the editor property
interface TLDrawElementWithEditor extends HTMLElement {
  __editorForTranscription?: Editor;
}

// Add global window type augmentation
declare global {
  interface Window {
    __editorInstance?: Editor;
  }
}

interface TranscriptionCanvasProps {
  roomId: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TranscriptionCanvas({ roomId }: TranscriptionCanvasProps) {
  const room = useRoomContext();
  const editorRef = useRef<Editor | null>(null);
  
  // Get timeline context
  const { 
    isTimelineActive, 
    addTimelineNote, 
    getCurrentTimestamp,
    startTimeRef 
  } = useTimelineContext();

  // Reference to track current transcript chunk
  const currentChunkRef = useRef<{
    text: string;
    startTime: number;
    lastUpdate: number;
  }>({
    text: '',
    startTime: 0,
    lastUpdate: 0
  });

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
    
    // Decide if note is on left or right side (alternate sides)
    const notesCount = editorRef.current?.getCurrentPageShapes().length || 0;
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
    
  }, [addTimelineNote, getCurrentTimestamp, isTimelineActive]);

  // Check if chunk needs to be finalized due to time or length
  const checkAndFinalizeChunk = useCallback((newText: string = '') => {
    const chunk = currentChunkRef.current;
    const currentTime = getCurrentTimestamp();
    
    // Finalize if chunk duration exceeds the limit or if explicitly asked to finalize
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

  // Original addTranscriptionToCanvas function - keeps its existing logic
  const addTranscriptionToCanvas = useCallback((text: string) => {
    if (DEBUG_MODE) {
      VideoLogger.debug(`Adding transcription to canvas: ${text}`);
    }
    
    if (!editorRef.current) {
      VideoLogger.warn('Editor ref is not available', { 
        editorRefCurrent: editorRef.current,
        editorRefType: typeof editorRef.current
      });
      
      if (DEBUG_MODE) {
        VideoLogger.debug('Attempting to find editor from DOM');
      }
      
      // Try to locate editor in DOM as fallback
      const tldrawElement = document.querySelector('[data-testid="tldraw-editor"]');
      if (tldrawElement && (tldrawElement as TLDrawElementWithEditor).__editorForTranscription) {
        const foundEditor = (tldrawElement as TLDrawElementWithEditor).__editorForTranscription;
        if (foundEditor) {
          editorRef.current = foundEditor;
          if (DEBUG_MODE) {
            VideoLogger.debug('Editor found from DOM element');
          }
        }
      } else if (window.__editorInstance) {
        editorRef.current = window.__editorInstance;
        if (DEBUG_MODE) {
          VideoLogger.debug('Editor found from window global');
        }
      } else {
        VideoLogger.error('Cannot find any editor reference - transcription note creation will fail');
        return;
      }
    }

    const editor = editorRef.current;
    if (!editor) {
      VideoLogger.error('Editor still null after recovery attempts');
      return;
    }
    
    const id = createShapeId();
    if (DEBUG_MODE) {
      VideoLogger.debug('Generated shape ID:', id);
    }

    try {
      // Create a random position that's centered on the screen
      const viewport = editor.getViewportPageBounds();
      if (DEBUG_MODE) {
        VideoLogger.debug('Viewport bounds:', viewport);
      }
      
      const x = viewport.center.x + (Math.random() * 300 - 150);
      const y = viewport.center.y + (Math.random() * 200 - 100);
      
      if (DEBUG_MODE) {
        VideoLogger.debug('Calculated position for note:', { x, y });
      }

      // Create a note shape with transcription text
      const richTextValue = toRichText(text);
      if (DEBUG_MODE) {
        VideoLogger.debug('Created rich text value:', richTextValue);
      }
      
      const shape = {
        id,
        type: 'note',
        x,
        y,
        props: {
          richText: richTextValue,
          color: 'yellow',
          size: 'l',
          font: 'draw',
          align: 'middle',
          verticalAlign: 'middle',
          growY: true,
        }
      };

      if (DEBUG_MODE) {
        VideoLogger.debug('Creating transcription note shape:', shape);
        VideoLogger.debug('Available shape utils:', Object.keys(editor.shapeUtils));
        
        // Debug check if 'note' shape type is supported
        const noteUtil = editor.getShapeUtil('note');
        VideoLogger.debug('Note shape util:', noteUtil, 'Default props:', noteUtil?.getDefaultProps?.());
      }
      
      editor.createShapes([shape]);
      if (DEBUG_MODE) {
        VideoLogger.debug('createShapes method called');
        
        // Verify the shape was created in the editor
        const createdShape = editor.getShape(id);
        VideoLogger.debug('Created shape verification:', createdShape);
      }
      
      // Also select and focus on the new shape
      editor.select(id);
      editor.zoomToSelection();
      
      VideoLogger.info('Transcription note created successfully');

      // Publish the shape data to other participants
      if (room && room.localParticipant) {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify({ type: 'transcription', shape }));
        const options: DataPublishOptions = { reliable: true };
        room.localParticipant.publishData(data, options);
        if (DEBUG_MODE) {
          VideoLogger.debug('Shape data published to other participants');
        }
      }
    } catch (error) {
      VideoLogger.error('Error creating shape:', error);
    }
  }, [room]);

  useEffect(() => {
    // Debug log to check component mounting
    VideoLogger.info(`TranscriptionCanvas mounted for room=${roomId}`);
    
    if (!room) {
      VideoLogger.warn('Room context not available in TranscriptionCanvas');
      return;
    }
    
    // Initialize the transcript chunk with current time
    currentChunkRef.current = {
      text: '',
      startTime: getCurrentTimestamp(),
      lastUpdate: getCurrentTimestamp()
    };
    
    // Send a test message to verify the data channel is working
    if (DEBUG_MODE) {
      VideoLogger.debug('Publishing test message on data channel for debugging');
    }
    
    if (room && room.localParticipant) {
      try {
        const testMessage = JSON.stringify({
          topic: 'transcription',
          data: JSON.stringify({
            type: 'transcription',
            participantIdentity: room.localParticipant.identity,
            participantName: room.localParticipant.identity,
            text: '[TEST MESSAGE] Verifying data channel'
          })
        });
        const data = new TextEncoder().encode(testMessage);
        room.localParticipant.publishData(data, { reliable: true });
        if (DEBUG_MODE) {
          VideoLogger.debug('Test message published on data channel');
        }
      } catch (error) {
        VideoLogger.error('Failed to publish test message:', error);
      }
    }

    const handleData = (data: Uint8Array) => {
      if (DEBUG_MODE) {
        VideoLogger.debug('Data received in TranscriptionCanvas:', data?.length || 0, 'bytes');
      }
      
      try {
        // Convert the Uint8Array to a string and parse as JSON
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(data);
        if (DEBUG_MODE) {
          VideoLogger.debug('Decoded data string:', jsonString);
        }
        
        let message;
        try {
          message = JSON.parse(jsonString);
          if (DEBUG_MODE) {
            VideoLogger.debug('Parsed message:', message);
          }
        } catch (parseError) {
          VideoLogger.error('Error parsing JSON:', parseError);
          return;
        }

        // Check if it's a direct transcription message
        if (message.type === 'transcription' && message.text) {
          if (DEBUG_MODE) {
            VideoLogger.debug('Direct transcription message received:', message);
          }
          
          // Add to current chunk instead of directly to canvas
          if (isTimelineActive) {
            addTextToChunk(message.text);
          } else {
            addTranscriptionToCanvas(message.text);
          }
        } 
        // Check if it's a wrapped message with a shape
        else if (message.type === 'transcription' && message.shape) {
          if (DEBUG_MODE) {
            VideoLogger.debug('Transcription with shape received:', message.shape);
          }
          try {
            if (editorRef.current) {
              if (DEBUG_MODE) {
                VideoLogger.debug('Creating shape from received data');
              }
              editorRef.current.createShapes([message.shape]);
              VideoLogger.info('Shape created from received data');
            } else {
              VideoLogger.warn('Editor ref not available to create received shape');
            }
          } catch (shapeError) {
            VideoLogger.error('Error creating shape from received data:', shapeError);
          }
        }
        // Handle wrapped format with topic field (used by CollaborativeBoard)
        else if (message.topic === 'transcription' && message.data) {
          if (DEBUG_MODE) {
            VideoLogger.debug('Wrapped transcription message received:', message);
          }
          try {
            const innerData = JSON.parse(message.data);
            if (DEBUG_MODE) {
              VideoLogger.debug('Successfully parsed inner data:', innerData);
            }
            if (innerData.type === 'transcription' && innerData.text) {
              // Add to current chunk instead of directly to canvas
              if (isTimelineActive) {
                addTextToChunk(innerData.text, innerData.participantName);
              } else {
                const displayText = innerData.participantName 
                  ? `${innerData.participantName}: ${innerData.text}`
                  : innerData.text;
                
                if (DEBUG_MODE) {
                  VideoLogger.debug('Adding wrapped transcription to canvas:', displayText);
                }
                addTranscriptionToCanvas(displayText);
              }
            } else {
              VideoLogger.warn('Inner data missing required fields:', innerData);
            }
          } catch (parseError) {
            VideoLogger.error('Error parsing inner data:', parseError);
          }
        } else if (DEBUG_MODE) {
          VideoLogger.debug('Message does not match expected transcription formats:', message);
        }
      } catch (error) {
        VideoLogger.error('Error handling data:', error);
      }
    };
      
    room.on('dataReceived', handleData);
    if (DEBUG_MODE) {
      VideoLogger.debug('DataReceived event listener added to room');
    }
    
    // Set up interval to finalize chunks that might be inactive
    const chunkCheckInterval = setInterval(() => {
      const chunk = currentChunkRef.current;
      const currentTime = getCurrentTimestamp();
      
      // If there's text in the chunk and it hasn't been updated for 5 seconds, finalize it
      if (chunk.text && currentTime - chunk.lastUpdate > 5000) {
        finalizeTranscriptChunk();
      }
    }, 5000);
    
    return () => {
      if (DEBUG_MODE) {
        VideoLogger.debug('Removing dataReceived event listener');
      }
      room.off('dataReceived', handleData);
      clearInterval(chunkCheckInterval);
      
      // Finalize any remaining transcript chunk
      if (currentChunkRef.current.text) {
        finalizeTranscriptChunk();
      }
    };
  }, [room, addTranscriptionToCanvas, roomId, getCurrentTimestamp, finalizeTranscriptChunk, addTextToChunk, isTimelineActive]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Tldraw
        onMount={(editor: Editor) => {
          editorRef.current = editor;
          console.log('TLDraw editor mounted in TranscriptionCanvas');
          
          // Store the editor instance globally for easier access by other components
          if (typeof window !== 'undefined') {
            window.__editorInstance = editor;
            console.log('Editor attached to window.__editorInstance for global access');
          }
          
          // Try multiple selector strategies to find tldraw element
          const tldrawElement = 
            document.querySelector('[data-testid="tldraw-editor"]') || 
            document.querySelector('.tldraw-editor') ||
            document.querySelector('.tldraw') ||
            document.querySelector('[class*="tldraw"]');
            
          if (tldrawElement) {
            (tldrawElement as TLDrawElementWithEditor).__editorForTranscription = editor;
            console.log('Editor attached to DOM element for sharing:', tldrawElement);
            
            // Test note creation immediately to verify editor works
            setTimeout(() => {
              try {
                console.log('Testing note creation on editor mount');
                const id = createShapeId();
                editor.createShapes([{
                  id,
                  type: 'note',
                  x: editor.getViewportPageBounds().center.x,
                  y: editor.getViewportPageBounds().center.y,
                  props: {
                    richText: toRichText('TEST NOTE - Editor working'),
                    color: 'yellow',
                    size: 'l',
                    font: 'draw',
                    align: 'middle',
                    verticalAlign: 'middle',
                    growY: true,
                  }
                }]);
                console.log('Test note created successfully');
              } catch(e) {
                console.error('Error creating test note:', e);
              }
            }, 1000);
          } else {
            console.warn('Could not find tldraw element to attach editor');
            console.log('Available DOM elements with class containing "tldraw":',
              Array.from(document.querySelectorAll('[class*="tldraw"]'))
                .map(el => ({tag: el.tagName, class: el.className}))
            );
          }
        }}
      />
    </div>
  );
}