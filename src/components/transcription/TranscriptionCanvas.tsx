"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { Editor, createShapeId, toRichText } from '@tldraw/editor';
import { Tldraw } from '@tldraw/tldraw';
import { DataPublishOptions, ConnectionState } from 'livekit-client';
import { useTranscriptStore } from '@/contexts/TranscriptStore';

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

// This file now only hosts a TLDraw editor for debugging / overlay purposes.
// CollaborativeBoard is the single source of truth for transcription handling.

// Toggle this to true if we want TranscriptionCanvas itself to create sticky notes (legacy behaviour).
const SHOULD_CREATE_NOTE_SHAPES = false;

// Toggle this to true if we want TranscriptionCanvas to handle incoming transcription
// events and push to the TranscriptStore. In normal operation this should remain false
// to avoid duplicate lines (CollaborativeBoard already handles it).
const SHOULD_PROCESS_TRANSCRIPTION = false;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TranscriptionCanvas({ roomId }: TranscriptionCanvasProps) {
  const room = useRoomContext();
  const editorRef = useRef<Editor | null>(null);
  // Map to track each participant's current note ID
  const participantNoteRefs = useRef(new Map<string, string>());

  // Transcript store
  const { addLine: addTranscriptLine } = useTranscriptStore();

  const addTranscriptionToCanvas = useCallback((text: string, participantId?: string) => {
    console.log('Adding transcription to canvas:', text);

    // Push to transcript store only if this canvas is the designated handler
    if (SHOULD_PROCESS_TRANSCRIPTION) {
      addTranscriptLine({
        authorId: participantId ?? 'unknown',
        authorName: participantId ?? 'Unknown',
        text,
        timestamp: new Date(),
      });
    }

    // If this instance is not responsible for creating sticky notes, bail out here.
    if (!SHOULD_CREATE_NOTE_SHAPES) {
      return;
    }

    if (!editorRef.current) {
      console.warn('Editor ref is not available', { 
        editorRefCurrent: editorRef.current,
        editorRefType: typeof editorRef.current
      });
      console.log('Attempting to find editor from DOM');
      // Try to locate editor in DOM as fallback
      const tldrawElement = document.querySelector('[data-testid="tldraw-editor"]');
      if (tldrawElement && (tldrawElement as TLDrawElementWithEditor).__editorForTranscription) {
        const foundEditor = (tldrawElement as TLDrawElementWithEditor).__editorForTranscription;
        if (foundEditor) {
          editorRef.current = foundEditor;
          console.log('Editor found from DOM element');
        }
      } else if (window.__editorInstance) {
        editorRef.current = window.__editorInstance;
        console.log('Editor found from window global');
      } else {
        console.error('Cannot find any editor reference - transcription note creation will fail');
        return;
      }
    }

    const editor = editorRef.current;
    if (!editor) {
      console.error('Editor still null after recovery attempts');
      return;
    }
    
    // Participant ID fallback - if not provided, use a default value
    // This helps maintain backward compatibility
    const safeParticipantId = participantId || 'default-participant';
    
    try {
      // Check if we already have a note for this participant
      const existingNoteId = participantNoteRefs.current.get(safeParticipantId);
      
      if (existingNoteId) {
        // Get the existing shape
        const existingShape = editor.getShape(existingNoteId);
        
        if (existingShape && existingShape.type === 'note') {
          console.log('Found existing note for participant:', safeParticipantId, 'with ID:', existingNoteId);
          
          // Get the existing text and append new text
          const existingProps = existingShape.props || {};
          
          // Handle different rich text property names (richText or content)
          let existingRichText;
          if ('richText' in existingProps) {
            existingRichText = existingProps.richText;
          } else if ('content' in existingProps) {
            // Convert content to rich text if needed
            existingRichText = typeof existingProps.content === 'string' 
              ? toRichText(existingProps.content) 
              : existingProps.content;
          } else {
            // Fallback to empty string if no text property found
            existingRichText = toRichText('');
          }
          
          // Get text content from richText (simplified approach)
          let existingTextContent = '';
          try {
            // This is a simplification - in a real app you'd parse the rich text structure
            if (existingRichText && existingRichText.text) {
              existingTextContent = existingRichText.text;
            }
          } catch (error) {
            console.warn('Error extracting text from rich text:', error);
          }
          
          // Append the new text with a newline
          const updatedText = existingTextContent ? `${existingTextContent}\n${text}` : text;
          const updatedRichText = toRichText(updatedText);
          
          console.log('Updating existing note with appended text:', updatedText);
          
          // Update the shape with the new content
          editor.updateShapes([
            {
              id: existingNoteId,
              type: 'note',
              props: {
                ...existingProps,
                richText: updatedRichText
              }
            }
          ]);
          
          console.log('Note updated successfully');
          
          // Select and focus on the updated shape
          editor.select(existingNoteId);
          editor.zoomToSelection();
          
          // Publish the updated shape data to other participants
          if (room && room.localParticipant) {
            const updatedShape = editor.getShape(existingNoteId);
            if (updatedShape) {
              const encoder = new TextEncoder();
              const data = encoder.encode(JSON.stringify({ 
                type: 'transcription', 
                participantId: safeParticipantId,
                isUpdate: true,
                shape: updatedShape
              }));
              const options: DataPublishOptions = { reliable: true };
              room.localParticipant.publishData(data, options);
              console.log('Updated shape data published to other participants');
            }
          }
          
          return;
        } else {
          console.warn('Referenced note ID not found in editor, creating new note');
          // If note not found (maybe deleted), remove the reference and create a new one
          participantNoteRefs.current.delete(safeParticipantId);
        }
      }
      
      // Create a new note if we don't have an existing one or couldn't update it
      const id = createShapeId();
      console.log('Generated new shape ID:', id);

      // Create a random position that's centered on the screen
      const viewport = editor.getViewportPageBounds();
      console.log('Viewport bounds:', viewport);
      const x = viewport.center.x + (Math.random() * 300 - 150);
      const y = viewport.center.y + (Math.random() * 200 - 100);
      console.log('Calculated position for note:', { x, y });

      // Create a note shape with transcription text
      const richTextValue = toRichText(text);
      console.log('Created rich text value:', richTextValue);
      
      const shape = {
        id,
        type: 'note',
        parentId: editor.getCurrentPageId() as any,
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
        },
        meta: { group: 'transcript' },
      };

      console.log('Creating new transcription note shape:', shape);
      console.log('Editor instance before createShapes:', editor);
      console.log('Available shape utils:', Object.keys(editor.shapeUtils));
      
      // Debug check if 'note' shape type is supported
      const noteUtil = editor.getShapeUtil('note');
      console.log('Note shape util:', noteUtil, 'Default props:', noteUtil?.getDefaultProps?.());
      
      editor.createShapes([shape]);
      console.log('createShapes method called');
      
      // Store the note ID for this participant
      participantNoteRefs.current.set(safeParticipantId, id);
      console.log('Stored note ID for participant:', safeParticipantId, 'ID:', id);
      
      // Verify the shape was created in the editor
      const createdShape = editor.getShape(id);
      console.log('Created shape verification:', createdShape);
      
      // Also select and focus on the new shape
      editor.select(id);
      editor.zoomToSelection();
      
      console.log('Transcription note shape created successfully');

      // Publish the shape data to other participants
      if (room && room.localParticipant) {
        try {
          // Check connection state before publishing
          if (room.state !== ConnectionState.Connected) {
            console.warn('Cannot publish shape data: room is not connected. Current state:', 
              ConnectionState[room.state] || room.state);
            return;
          }
          
          const encoder = new TextEncoder();
          const data = encoder.encode(JSON.stringify({ 
            type: 'transcription', 
            participantId: safeParticipantId,
            isUpdate: false,
            shape 
          }));
          const options: DataPublishOptions = { reliable: true };
          room.localParticipant.publishData(data, options);
          console.log('Shape data published to other participants');
        } catch (error) {
          console.error('Error publishing shape data:', error);
        }
      }
    } catch (error) {
      console.error('Error creating/updating shape:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
  }, [room, addTranscriptLine]);

  useEffect(() => {
    // Debug log to check component mounting
    console.log('TranscriptionCanvas component mounted for room:', roomId);
    console.log('Room context available:', !!room);
    
    if (!room) {
      console.warn('Room context not available in TranscriptionCanvas');
      return;
    }
    
    console.log('Setting up data listener for room:', room);
    console.log('DATA CHANNEL TEST - Publishing test message to verify data channel');
    
    // Send a test message to verify the data channel is working
    if (room && room.localParticipant) {
      try {
        // Check connection state before publishing test message
        if (room.state !== ConnectionState.Connected) {
          console.warn('Cannot publish test message: room is not connected. Current state:', 
            ConnectionState[room.state] || room.state);
        } else {
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
          console.log('Test message published on data channel');
        }
      } catch (error) {
        console.error('Failed to publish test message:', error);
      }
    }

    const handleData = (data: Uint8Array) => {
      console.log('!!!! DATA RECEIVED IN TRANSCRIPTION CANVAS !!!!', data?.length || 0, 'bytes');
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

        // ---- Transcription handling disabled to avoid duplication (handled by CollaborativeBoard) ----
        if (!SHOULD_PROCESS_TRANSCRIPTION) {
          // ignore transcription messages entirely
          return;
        }

        // Legacy path (only active if SHOULD_PROCESS_TRANSCRIPTION)
        if (message.type === 'transcription' && message.text) {
          console.log('Direct transcription message received:', message);
          addTranscriptionToCanvas(message.text, message.participantId || message.participantIdentity);
        }
        // Check if it's a wrapped message with a shape
        else if (message.type === 'transcription' && message.shape) {
          console.log('Transcription with shape received:', message.shape);
          try {
            if (editorRef.current) {
              console.log('Creating shape from received data');
              
              // Store participant ID mapping if present
              if (message.participantId && message.shape.id) {
                participantNoteRefs.current.set(message.participantId, message.shape.id);
                console.log('Stored remote participant note ID mapping:', message.participantId, message.shape.id);
              }
              
              if (message.isUpdate && message.shape.id) {
                // Handle updates to existing shapes
                const existingShape = editorRef.current.getShape(message.shape.id);
                if (existingShape) {
                  editorRef.current.updateShapes([message.shape]);
                  console.log('Shape updated from received data');
                } else {
                  // If shape doesn't exist, create it
                  editorRef.current.createShapes([message.shape]);
                  console.log('Shape created from received data (update for non-existent shape)');
                }
              } else {
                // Create new shape
                editorRef.current.createShapes([message.shape]);
                console.log('Shape created from received data');
              }
            } else {
              console.warn('Editor ref not available to create received shape');
            }
          } catch (shapeError) {
            console.error('Error creating shape from received data:', shapeError);
          }
        }
        // Handle wrapped format with topic field (legacy path) only if enabled
        else if (SHOULD_PROCESS_TRANSCRIPTION && message.topic === 'transcription' && message.data) {
          console.log('Wrapped transcription message received:', message);
          try {
            const innerData = JSON.parse(message.data);
            console.log('Successfully parsed inner data:', innerData);
            if (innerData.type === 'transcription' && innerData.text) {
              const displayText = innerData.participantName 
                ? `${innerData.participantName}: ${innerData.text}`
                : innerData.text;
              console.log('Adding wrapped transcription to canvas:', displayText);
              
              // Use participant identity for tracking notes
              const participantId = innerData.participantIdentity || 'unknown-participant';
              addTranscriptionToCanvas(displayText, participantId);
            } else {
              console.warn('Inner data missing required fields:', innerData);
            }
          } catch (parseError) {
            console.error('Error parsing inner data:', parseError);
          }
        } else {
          console.log('Message does not match expected transcription formats or is ignored:', message);
        }
      } catch (error) {
        console.error('Error handling data:', error);
      }
    };

    // Log all event listeners on the room object
    console.log('Room event listeners BEFORE adding our handler:', 
      (room as any)._events ? Object.keys((room as any)._events) : 'No events object',
      'EventCount:', (room as any)._eventsCount);
      
    room.on('dataReceived', handleData);
    
    console.log('Room event listeners AFTER adding our handler:', 
      (room as any)._events ? Object.keys((room as any)._events) : 'No events object',
      'EventCount:', (room as any)._eventsCount);
      
    console.log('DataReceived event listener added to room');
    
    return () => {
      console.log('Removing dataReceived event listener');
      room.off('dataReceived', handleData);
    };
  }, [room, addTranscriptionToCanvas, roomId]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Tldraw
        onMount={(editor: Editor) => {
          editorRef.current = editor;
          console.log('TLDraw editor mounted in TranscriptionCanvas');
          
          // Store the editor instance globally for easier access by other components
          window.__editorInstance = editor;
          console.log('Editor instance stored in window.__editorInstance');
          
          // Find the actual DOM element for direct editor access
          const tldrawElement = document.querySelector('[data-testid="tldraw-editor"]');
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