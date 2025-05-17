import { Tldraw, createTLStore, defaultShapeUtils, createShapeId, toRichText } from 'tldraw';
import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import 'tldraw/tldraw.css';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { DataPacket_Kind, Room, ConnectionState } from 'livekit-client';
import { WhiteboardController } from '@/controllers/WhiteboardController';
import { useTranscriptStore } from '@/contexts/TranscriptStore';

interface TranscriptionEntry {
  participantIdentity: string;
  participantName: string;
  text: string;
  timestamp: Date;
}

interface CollaborativeBoardProps {
  transcriptVisible: boolean;
  agentsVisible: boolean;
}

// Wrap with memo to prevent unnecessary rerenders
const CollaborativeBoard = memo(function CollaborativeBoard({ transcriptVisible, agentsVisible }: CollaborativeBoardProps) {
  const [store, setStore] = useState<ReturnType<typeof createTLStore> | null>(null);
  const localParticipantData = useLocalParticipant();
  const roomContext = useRoomContext();
  const localParticipant = localParticipantData?.localParticipant;
  const storeInitializedRef = useRef(false);
  // Use any type for editor to avoid complex type issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const recognitionInitializedRef = useRef(false);

  // Central change-based controller
  const controllerRef = useRef<WhiteboardController | null>(null);

  // Transcript store context
  const { addLine: addTranscriptLine } = useTranscriptStore();

  // Debug: Track state changes
  const prevStoreRef = useRef(store);
  const prevRoomContextRef = useRef(roomContext);
  const prevLocalParticipantRef = useRef(localParticipant);
  
  useEffect(() => {
    if (prevStoreRef.current !== store) {
      console.log('CollaborativeBoard: store changed');
      prevStoreRef.current = store;
    }
    if (prevRoomContextRef.current !== roomContext) {
      console.log('CollaborativeBoard: roomContext changed');
      prevRoomContextRef.current = roomContext;
    }
    if (prevLocalParticipantRef.current !== localParticipant) {
      console.log('CollaborativeBoard: localParticipant changed');
      prevLocalParticipantRef.current = localParticipant;
    }
  }, [store, roomContext, localParticipant]);
  
  // Debug: Log unmounting
  useEffect(() => {
    return () => {
      // Stop transcription when component unmounts
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          console.warn('Error stopping recognition on unmount:', e);
        }
      }
    };
  }, [recognition]);

  // Initialize TLDraw store only once
  useEffect(() => {
    // Skip if already initialized
    if (storeInitializedRef.current) return;
    storeInitializedRef.current = true;
    
    const newStore = createTLStore({
      shapeUtils: defaultShapeUtils,
    });
    setStore(newStore);

    return () => {
      // Clean up store on unmount
      try {
        if (newStore) newStore.dispose();
      } catch (e) {
        console.warn('Error disposing TLDraw store:', e);
      }
    };
  }, []);

  // Set up LiveKit data channel for store synchronization and transcriptions
  useEffect(() => {
    // Use safe type assertions for LiveKit
    if (!store || !roomContext) return;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const room = roomContext as any;
    if (!room.dataReceived) return;
    
    // Set up handler for incoming data messages
    const handleDataReceived = (dataPacket: Uint8Array) => {
      try {
        // Convert the Uint8Array to string
        const jsonString = new TextDecoder().decode(dataPacket);
        console.log('CollaborativeBoard received data:', jsonString);
        
        const dataMessage = JSON.parse(jsonString);
        console.log('CollaborativeBoard parsed data message:', dataMessage);
        
        if (dataMessage.topic !== 'tldraw' && dataMessage.topic !== 'transcription') {
          console.log('CollaborativeBoard ignoring message with topic:', dataMessage.topic);
          return;
        }
        
        let data;
        try {
          data = JSON.parse(dataMessage.data);
          console.log('CollaborativeBoard parsed inner data:', data);
        } catch (error) {
          console.error('CollaborativeBoard error parsing inner data:', error);
          return;
        }
        
        // Handle tldraw updates
        if (dataMessage.topic === 'tldraw' && data.type === 'tlDrawUpdate' && store) {
          console.log('CollaborativeBoard handling tldraw update');
          store.mergeRemoteChanges(() => {
            store.put(data.changes);
          });
        }
        
        // Handle transcription
        if (dataMessage.topic === 'transcription' && data.type === 'transcription' && editorRef.current) {
          console.log('CollaborativeBoard handling transcription:', {
            data: data,
            editorAvailable: !!editorRef.current,
            editorRef: editorRef
          });
          
          addTranscriptionToCanvas({
            participantIdentity: data.participantIdentity,
            participantName: data.participantName,
            text: data.text,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Error processing data message:', error);
      }
    };

    // Listen for data messages from other participants
    try {
      room.dataReceived.on(handleDataReceived);
    } catch (e) {
      console.error('Error setting up data listener:', e);
    }
    
    return () => {
      // Safely remove event listener
      try {
        if (room && room.dataReceived) {
          room.dataReceived.off(handleDataReceived);
        }
      } catch (e) {
        console.warn('Error removing data listener:', e);
      }
    };
  }, [store, roomContext]);

  // Function to add transcription to the canvas
  const addTranscriptionToCanvas = useCallback((entry: TranscriptionEntry) => {
    console.log('CollaborativeBoard: Adding transcription to canvas:', entry);
    if (!editorRef.current) {
      console.warn('Editor ref is not available in CollaborativeBoard', {
        editorRefExists: !!editorRef,
        editorRefCurrent: !!editorRef.current
      });
      return;
    }
    
    const editor = editorRef.current;
    const controller = controllerRef.current;
    if (!controller) {
      console.warn('WhiteboardController not ready');
      return;
    }
    console.log('Editor instance is available:', editor);
    
    try {
      // First, push to transcript store
      addTranscriptLine({
        authorId: entry.participantIdentity,
        authorName: entry.participantName,
        text: entry.text,
        timestamp: entry.timestamp,
      });

      // Track notes per participant to append instead of creating new ones
      const participantNoteRefs = editorRef.current._participantNoteRefs = editorRef.current._participantNoteRefs || new Map();
      const existingNoteId = participantNoteRefs.get(entry.participantIdentity);
      
      // If we have an existing note for this participant, update it instead of creating a new one
      if (existingNoteId) {
        const existingShape = editor.getShape(existingNoteId);
        
        if (existingShape && existingShape.type === 'note') {
          console.log('Found existing note for participant:', entry.participantIdentity);
          
          // Get the existing content
          const existingProps = existingShape.props || {};
          
          // Handle different property formats (content or richText)
          let currentText = '';
          if (existingProps.content) {
            currentText = typeof existingProps.content === 'string' 
              ? existingProps.content 
              : (existingProps.content.text || '');
          } else if (existingProps.richText) {
            // Extract text from rich text format (simplified)
            try {
              currentText = existingProps.richText.text || '';
            } catch (e) {
              console.warn('Error extracting text from rich text:', e);
            }
          }
          
          // Format the transcription content
          const displayText = `${entry.participantName}: ${entry.text}`;
          
          // Append new text to existing content
          const updatedText = currentText ? `${currentText}\n${displayText}` : displayText;
          
          // Update the shape with appended text
          console.log('Updating note with appended text:', updatedText);
          
          try {
            controller.applyChange({
              type: 'updateShape',
              description: 'Update transcription note',
              shape: {
                id: existingNoteId,
                type: 'note',
                props: {
                  ...existingProps,
                  richText: editor.textUtils
                    ? editor.textUtils.toRichText(updatedText)
                    : updatedText,
                },
              },
            });
            
            console.log('Note updated successfully');
            return;
          } catch (updateError) {
            console.error('Error updating existing note:', updateError);
            // Fall through to create a new note if update fails
          }
        } else {
          console.warn('Referenced note no longer exists, creating new note');
          participantNoteRefs.delete(entry.participantIdentity);
        }
      }
      
      // Create a new note if no existing note or update failed
      const id = createShapeId();
      console.log('Generated shape ID:', id);
      
      // Format the transcription content
      const displayText = `${entry.participantName}: ${entry.text}`;
      console.log('Creating note with text:', displayText);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageId = editor.getCurrentPageId();
      const noteShape: any = {
        id,
        type: 'note',
        parentId: pageId as any,
        x: 50 + Math.random() * 400,
        y: 50 + Math.random() * 400,
        props: {
          richText: toRichText(displayText),
          color: 'yellow',
          size: 'm',
          w: 300,
          font: 'draw',
          align: 'start',
          verticalAlign: 'middle',
          growY: true,
        },
        meta: { group: 'transcript' },
      };
      
      console.log('Note shape object:', noteShape);
      console.log('Editor shape utils available:', Object.keys(editor.shapeUtils));
      
      // Check if note shape is supported
      try {
        const noteUtil = editor.getShapeUtil('note');
        console.log('Note shape util:', noteUtil, 'Default props:', noteUtil?.getDefaultProps?.());
      } catch (e) {
        console.warn('Error getting note shape util:', e);
      }
      
      // Add the shape via controller
      console.log('About to apply createShape via controller');
      controller.applyChange({
        type: 'createShape',
        description: 'Create transcription note',
        shape: noteShape,
      });
      console.log('Successfully applied createShape');
      
      // Store reference to this note for the participant
      participantNoteRefs.set(entry.participantIdentity, id);
      console.log('Stored note ID for participant:', entry.participantIdentity);
      
    } catch (error) {
      console.error('Error creating/updating note shape:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
  }, [addTranscriptLine]);

  // Memoize publishData function to reduce dependency changes
  const publishData = useCallback((data: string, topic: string) => {
    if (!localParticipant || !roomContext) return;
    
    try {
      // Check connection state before publishing
      const room = roomContext as Room;
      if (room.state !== ConnectionState.Connected) {
        console.warn('Cannot publish data: room is not connected. Current state:', 
          room.state);
        return;
      }
      
      // Convert string to Uint8Array for LiveKit's publishData
      const jsonString = JSON.stringify({ topic, data });
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(jsonString);
      
      // Use any type to avoid type errors
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (localParticipant as any).publishData(uint8Array, DataPacket_Kind.RELIABLE);
    } catch (error) {
      console.error('Error publishing data:', error);
    }
  }, [localParticipant, roomContext]);

  // Store editor reference and handle changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMount = useCallback((editor: any) => {
    editorRef.current = editor;
    
    // Instantiate whiteboard controller
    controllerRef.current = new WhiteboardController(editor);
    
    // Expose controller globally for agents
    if (typeof window !== 'undefined') {
      (window as any).__whiteboardController = controllerRef.current;
    }
    
    // Add a watermark "PRESENT" with very low opacity
    try {
      const viewport = editor.getViewportPageBounds();
      const watermarkId = createShapeId();
      
      // Slight delay to make sure it's placed on top
      setTimeout(() => {
        // Create a fully opaque text watermark
        editor.createShapes([{
          id: watermarkId,
          type: 'text',
          x: viewport.center.x - 300, // Better horizontal centering for large text
          y: viewport.center.y - 80,  // Better vertical centering for large text
          props: {
            richText: toRichText('PRESENT'),
            color: 'black',
            size: 'xl',
            font: 'draw',
            textAlign: 'middle',
            scale: 5,     // Large size
          },
          meta: { group: 'watermark' },
        }]);
        
        console.log('Added fully visible PRESENT watermark to canvas as a tldraw text shape');
        
        // Make sure it's on top by bringing it to front
        editor.bringToFront([watermarkId]);
      }, 500); // Half-second delay to ensure it's on top

    } catch (error) {
      console.error('Error adding watermark:', error);
    }
    
    // Set up editor change listener
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.store.listen((event: any) => {
      if (!localParticipant || !roomContext) return;
      
      try {
        if (event.source !== 'user') return;
        
        // Get changes from the editor if available
        if (typeof editor.getChanges === 'function') {
          const changes = editor.getChanges();
          
          if (changes && changes.length > 0) {
            publishData(
              JSON.stringify({
                type: 'tlDrawUpdate',
                changes: changes,
              }),
              'tldraw'
            );
          }
        }
      } catch (error) {
        console.error('Error publishing drawing updates:', error);
      }
    });

    // --- Layer initialization ---
    // (Removed: no custom layer creation)
    // --- End layer initialization ---
  }, [localParticipant, roomContext, publishData]);

  // Set up browser speech recognition
  useEffect(() => {
    // Skip if already initialized or if we're in an unmounted state
    if (recognitionInitializedRef.current || !roomContext) return;
    recognitionInitializedRef.current = true;
    
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      console.error('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognition();
    
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';
    
    recognitionInstance.onstart = () => {
      console.log('Speech recognition started');
      setIsTranscribing(true);
    };
    
    recognitionInstance.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        alert('Microphone access is required for transcription');
      }
    };
    
    recognitionInstance.onend = () => {
      console.log('Speech recognition ended');
      setIsTranscribing(false);
      // Don't auto-restart to avoid cascading issues
    };
    
    let finalTranscript = '';
    
    recognitionInstance.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript = transcript;
          
          // Send the final transcript
          if (roomContext && finalTranscript.trim() !== '') {
            // Use any type to avoid type errors
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const room = roomContext as any;
            if (room.localParticipant) {
              publishData(
                JSON.stringify({
                  type: 'transcription',
                  participantIdentity: room.localParticipant.identity,
                  participantName: room.localParticipant.name || 'You',
                  text: finalTranscript.trim()
                }),
                'transcription'
              );
            }
          }
          
          finalTranscript = '';
        }
      }
    };
    
    setRecognition(recognitionInstance);
    
    return () => {
      // Cleanup properly to avoid repetitive start/stops
      try {
        if (recognitionInstance) {
          recognitionInstance.stop();
        }
      } catch (e) {
        console.warn('Error stopping speech recognition on cleanup:', e);
      }
      recognitionInitializedRef.current = false;
    };
  }, [roomContext, publishData]);

  // UI control for transcription
  const toggleTranscription = useCallback(() => {
    if (isTranscribing && recognition) {
      try {
        recognition.stop();
        setIsTranscribing(false);
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    } else if (recognition) {
      try {
        recognition.start();
        setIsTranscribing(true);
      } catch (e) {
        console.error('Error starting recognition:', e);
      }
    }
  }, [isTranscribing, recognition]);

  // Memoize the entire Tldraw component to prevent unnecessary re-renders
  const tldrawComponent = useMemo(() => {
    if (!store) return <div className="w-full h-full flex items-center justify-center">Loading whiteboard...</div>;

    return (
      <div className="w-full h-full">
        {/*
          getShapeVisibility is not yet typed in tldraw@2.x, so we cast as any to allow the prop.
          See: https://tldraw.dev/docs/shapes#Meta-information
        */}
        {(
          <Tldraw
            store={store}
            onMount={handleMount}
            getShapeVisibility={(shape: { meta?: { group?: string } }) => {
              if (shape.meta?.group === 'agent' && !agentsVisible) return 'hidden';
              if (shape.meta?.group === 'transcript' && !transcriptVisible) return 'hidden';
              return 'visible';
            }}
          />
        ) as any}
      </div>
    );
  }, [store, handleMount, transcriptVisible, agentsVisible]);

  return (
    <div className="h-full w-full overflow-hidden bg-white relative">
      {tldrawComponent}
      
      <div className="absolute top-4 right-4 bg-white rounded-md shadow-md p-2 z-10 flex items-center">
        <button
          onClick={toggleTranscription}
          className={`px-3 py-1 rounded text-white ${isTranscribing ? 'bg-red-500' : 'bg-green-500'}`}
        >
          {isTranscribing ? 'Stop Transcribing' : 'Start Transcribing'}
        </button>
        {isTranscribing && (
          <span className="ml-2 inline-block w-3 h-3 bg-red-500 rounded-full animate-pulse" 
                title="Recording in progress"></span>
        )}
      </div>
    </div>
  );
});

export default CollaborativeBoard; 