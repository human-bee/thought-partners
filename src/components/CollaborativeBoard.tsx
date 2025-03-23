import { Tldraw, createTLStore, defaultShapeUtils, createShapeId, TLTextShape } from 'tldraw';
import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import 'tldraw/tldraw.css';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';

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
  const editorRef = useRef<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

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
        recognition.stop();
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
    if (!store || !roomContext?.room || !roomContext.room.dataReceived) return;
    
    const room = roomContext.room;
    
    // Set up handler for incoming data messages
    const handleDataReceived = (dataMessage: any) => {
      try {
        if (dataMessage.topic !== 'tldraw' && dataMessage.topic !== 'transcription') return;
        
        const data = JSON.parse(dataMessage.data);
        
        // Handle tldraw updates
        if (dataMessage.topic === 'tldraw' && data.type === 'tlDrawUpdate' && store) {
          store.mergeRemoteChanges(() => {
            store.put(data.changes);
          });
        }
        
        // Handle transcription
        if (dataMessage.topic === 'transcription' && data.type === 'transcription' && editorRef.current) {
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
      if (room && room.dataReceived) {
        try {
          room.dataReceived.off(handleDataReceived);
        } catch (e) {
          console.warn('Error removing data listener:', e);
        }
      }
    };
  }, [store, roomContext]);

  // Function to add transcription to the canvas
  const addTranscriptionToCanvas = useCallback((entry: TranscriptionEntry) => {
    if (!editorRef.current) return;
    
    const editor = editorRef.current;
    
    // Create a new text shape
    const id = createShapeId();
    const textShape: TLTextShape = {
      id,
      type: 'text',
      x: 50 + Math.random() * 400, // Random position
      y: 50 + Math.random() * 400,
      props: {
        // @ts-ignore - The type definition may not match the actual implementation
        text: `${entry.participantName}: ${entry.text}`,
        color: 'black',
        size: 'm',
        w: 300,
        font: 'draw',
        align: 'start',
        autoSize: true,
      },
    };
    
    // Add the shape to the canvas
    editor.createShapes([textShape]);
  }, []);

  // Memoize publishData function to reduce dependency changes
  const publishData = useCallback((data: string, topic: string) => {
    if (!localParticipant) return;
    localParticipant.publishData(data, topic);
  }, [localParticipant]);

  // Handle editor changes with stable dependencies
  const handleEditorChange = useCallback((editor: any) => {
    if (!localParticipant || !roomContext?.room) return;
    editorRef.current = editor;
    
    try {
      // Get changes from the editor
      const changes = editor.getChanges();
      if (changes.length === 0) return;
      
      // Send changes to other participants using memoized function
      publishData(
        JSON.stringify({
          type: 'tlDrawUpdate',
          changes: changes,
        }),
        'tldraw'
      );
    } catch (error) {
      console.error('Error publishing drawing updates:', error);
    }
  }, [localParticipant, roomContext, publishData]);

  // Set up browser speech recognition
  useEffect(() => {
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
      // Try to restart if not intentionally stopped
      if (isTranscribing) {
        try {
          recognitionInstance.start();
        } catch (e) {
          console.warn('Could not restart speech recognition:', e);
        }
      }
    };
    
    let finalTranscript = '';
    
    recognitionInstance.onresult = (event) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript = transcript;
          
          // Send the final transcript
          if (roomContext?.room?.localParticipant && finalTranscript.trim() !== '') {
            publishData(
              JSON.stringify({
                type: 'transcription',
                participantIdentity: roomContext.room.localParticipant.identity,
                participantName: roomContext.room.localParticipant.name || 'You',
                text: finalTranscript.trim()
              }),
              'transcription'
            );
          }
          
          finalTranscript = '';
        } else {
          interimTranscript = transcript;
        }
      }
    };
    
    setRecognition(recognitionInstance);
  }, [roomContext, publishData, isTranscribing]);

  // UI control for transcription
  const toggleTranscription = useCallback(() => {
    if (isTranscribing && recognition) {
      recognition.stop();
      setIsTranscribing(false);
    } else if (recognition) {
      recognition.start();
      setIsTranscribing(true);
    }
  }, [isTranscribing, recognition]);

  // Memoize the entire Tldraw component to prevent unnecessary re-renders
  const tldrawComponent = useMemo(() => {
    if (!store) return <div className="w-full h-full flex items-center justify-center">Loading whiteboard...</div>;

    return (
      <div className="w-full h-full">
        <Tldraw
          store={store}
          persistenceKey={roomId}
          onEditorStateChange={handleEditorChange}
        />
      </div>
    );
  }, [store, roomId, handleEditorChange]);

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