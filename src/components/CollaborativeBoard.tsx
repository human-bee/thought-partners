import { Tldraw, createTLStore, defaultShapeUtils, createShapeId } from 'tldraw';
import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import 'tldraw/tldraw.css';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { DataPacket_Kind } from 'livekit-client';

// Add render counter
let renderCount = 0;

interface CollaborativeBoardProps {
  roomId: string;
}

interface TranscriptionEntry {
  participantIdentity: string;
  participantName: string;
  text: string;
  timestamp: Date;
}

interface DataMessage {
  topic: string;
  data: string;
}

// Extend the Room type to include LiveKit's actual properties
interface ExtendedRoom extends Room {
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
interface TLTextShapeProps {
  text: string;
  color: string;
  size: string;
  width: number;
  font: string;
  align: string;
  autoSize: boolean;
  verticalAlign?: string;
}

// Extend the Editor type to include missing methods
interface ExtendedEditor extends Editor {
  getChanges: () => any[];
  createShapes: (shapes: any[]) => void;
}

// Wrap with memo to prevent unnecessary rerenders
const CollaborativeBoard = memo(function CollaborativeBoard({ roomId }: CollaborativeBoardProps) {
  // Debug: Track renders
  const renderCountRef = useRef(0);
  renderCount++;
  renderCountRef.current++;
  
  console.time(`CollaborativeBoard render ${renderCountRef.current}`);
  
  const [store, setStore] = useState<ReturnType<typeof createTLStore> | null>(null);
  const localParticipantData = useLocalParticipant();
  const roomContext = useRoomContext();
  const localParticipant = localParticipantData?.localParticipant;
  const storeInitializedRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const recognitionInitializedRef = useRef(false);

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
      console.log(`CollaborativeBoard unmounting: render count was ${renderCountRef.current}`);
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
    console.log('Editor instance is available:', editor);
    
    try {
      // Create a new note shape (better for transcriptions than text)
      const id = createShapeId();
      console.log('Generated shape ID:', id);
      
      // Format the transcription content
      const displayText = `${entry.participantName}: ${entry.text}`;
      console.log('Creating note with text:', displayText);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noteShape: any = {
        id,
        type: 'note',
        x: 50 + Math.random() * 400, // Random position
        y: 50 + Math.random() * 400,
        props: {
          content: displayText,
          color: 'yellow',
          size: 'm',
          width: 300,
          font: 'draw',
          align: 'start',
          verticalAlign: 'middle',
          growY: true,
        },
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
      
      // Add the shape to the canvas
      console.log('About to call editor.createShapes');
      editor.createShapes([noteShape]);
      console.log('Successfully called createShapes');
      
      // Verify the shape was created
      const createdShape = editor.getShape(id);
      console.log('Shape created verification:', createdShape);
      
    } catch (error) {
      console.error('Error adding transcription to canvas:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
  }, []);

  // Memoize publishData function to reduce dependency changes
  const publishData = useCallback((data: string, topic: string) => {
    if (!localParticipant) return;
    
    try {
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
  }, [localParticipant]);

  // Store editor reference and handle changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMount = useCallback((editor: any) => {
    editorRef.current = editor;
    
    // Add a watermark "PRESENT" with very low opacity
    try {
      const viewport = editor.getViewportPageBounds();
      const watermarkId = createShapeId();
      
      // Create a very light text watermark
      editor.createShapes([{
        id: watermarkId,
        type: 'text',
        x: viewport.center.x - 300, // Better horizontal centering for large text
        y: viewport.center.y - 80,  // Better vertical centering for large text
        props: {
          text: 'PRESENT',
          color: 'black',
          size: 'xl',
          font: 'draw',
          align: 'middle',
          opacity: 0.15, // Increased from 0.03 to 0.15 for better visibility
          scale: 5,      // Increased from 4 to 5 for larger size
        }
      }]);
      
      console.log('Added PRESENT watermark to canvas as a tldraw text shape');
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
        <Tldraw
          store={store}
          onMount={handleMount}
        />
      </div>
    );
  }, [store, handleMount]);

  console.timeEnd(`CollaborativeBoard render ${renderCountRef.current}`);
  
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