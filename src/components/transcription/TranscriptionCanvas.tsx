import { useEffect, useRef, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { Editor, createShapeId, toRichText } from '@tldraw/editor';
import { Tldraw } from '@tldraw/tldraw';
import { DataPublishOptions } from 'livekit-client';

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

  const addTranscriptionToCanvas = useCallback((text: string) => {
    console.log('Adding transcription to canvas:', text);
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
    
    const id = createShapeId();
    console.log('Generated shape ID:', id);

    try {
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

      console.log('Creating transcription note shape:', shape);
      console.log('Editor instance before createShapes:', editor);
      console.log('Available shape utils:', Object.keys(editor.shapeUtils));
      
      // Debug check if 'note' shape type is supported
      const noteUtil = editor.getShapeUtil('note');
      console.log('Note shape util:', noteUtil, 'Default props:', noteUtil?.getDefaultProps?.());
      
      editor.createShapes([shape]);
      console.log('createShapes method called');
      
      // Verify the shape was created in the editor
      const createdShape = editor.getShape(id);
      console.log('Created shape verification:', createdShape);
      
      // Also select and focus on the new shape
      editor.select(id);
      editor.zoomToSelection();
      
      console.log('Transcription note shape created successfully');

      // Publish the shape data to other participants
      if (room && room.localParticipant) {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify({ type: 'transcription', shape }));
        const options: DataPublishOptions = { reliable: true };
        room.localParticipant.publishData(data, options);
        console.log('Shape data published to other participants');
      }
    } catch (error) {
      console.error('Error creating shape:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
  }, [room]);

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

        // Check if it's a direct transcription message
        if (message.type === 'transcription' && message.text) {
          console.log('Direct transcription message received:', message);
          addTranscriptionToCanvas(message.text);
        } 
        // Check if it's a wrapped message with a shape
        else if (message.type === 'transcription' && message.shape) {
          console.log('Transcription with shape received:', message.shape);
          try {
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
              const displayText = innerData.participantName 
                ? `${innerData.participantName}: ${innerData.text}`
                : innerData.text;
              console.log('Adding wrapped transcription to canvas:', displayText);
              addTranscriptionToCanvas(displayText);
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
  }, [room, addTranscriptionToCanvas]);

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