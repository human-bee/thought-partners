import { useEffect, useState, useCallback, useRef } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { Tldraw, createTLStore, defaultShapeUtils, TLTextShape, createShapeId, track } from 'tldraw';
import 'tldraw/tldraw.css';

interface TranscriptionEntry {
  participantIdentity: string;
  participantName: string;
  text: string;
  timestamp: Date;
}

export default function TranscriptionBoard({ roomId }: { roomId: string }) {
  const roomContext = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [store, setStore] = useState<ReturnType<typeof createTLStore> | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const storeInitializedRef = useRef(false);
  const editorRef = useRef<any>(null);

  // Initialize TLDraw store
  useEffect(() => {
    if (storeInitializedRef.current) return;
    storeInitializedRef.current = true;
    
    const newStore = createTLStore({
      shapeUtils: defaultShapeUtils,
    });
    setStore(newStore);

    return () => {
      if (newStore) newStore.dispose();
      // Stop transcription when component unmounts
      if (recognition) {
        recognition.stop();
      }
    };
  }, [recognition]);

  // Handle incoming transcription messages
  useEffect(() => {
    if (!roomContext?.room) return;
    
    const room = roomContext.room;

    const handleTranscriptionMessage = (payload: any) => {
      try {
        if (payload.topic !== 'transcription') return;
        
        const data = JSON.parse(payload.data);
        if (data.type === 'transcription') {
          const newEntry = {
            participantIdentity: data.participantIdentity,
            participantName: data.participantName,
            text: data.text,
            timestamp: new Date()
          };
          
          setTranscriptions(prev => [...prev, newEntry].slice(-20)); // Keep only the last 20 entries
          
          // Add the transcription to the tldraw canvas
          addTranscriptionToCanvas(newEntry);
        }
      } catch (error) {
        console.error('Error processing transcription data:', error);
      }
    };

    // Listen for transcription data
    room.dataReceived.on(handleTranscriptionMessage);

    return () => {
      if (room && room.dataReceived) {
        try {
          room.dataReceived.off(handleTranscriptionMessage);
        } catch (e) {
          console.warn('Could not remove data listener:', e);
        }
      }
    };
  }, [roomContext]);

  // Function to add transcription to the canvas
  const addTranscriptionToCanvas = useCallback((entry: TranscriptionEntry) => {
    if (!store || !editorRef.current) return;
    
    const editor = editorRef.current;
    
    // Create a new text shape
    const id = createShapeId();
    const textShape: TLTextShape = {
      id,
      type: 'text',
      x: 100 + Math.random() * 400, // Random position
      y: 100 + Math.random() * 400,
      props: {
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
    
    // Publish the change to other participants
    if (localParticipant) {
      try {
        localParticipant.publishData(
          JSON.stringify({
            type: 'tlDrawUpdate',
            changes: editor.getChanges(),
          }),
          'tldraw'
        );
      } catch (error) {
        console.error('Error publishing drawing updates:', error);
      }
    }
  }, [store, localParticipant]);

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
            roomContext.room.localParticipant.publishData(
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
    
    // Start recognition
    try {
      recognitionInstance.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
    }
    
    return () => {
      try {
        recognitionInstance.stop();
      } catch (e) {
        console.warn('Error stopping speech recognition:', e);
      }
    };
  }, [roomContext]);

  // Handle editor reference
  const handleMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  // UI controls for transcription
  const toggleTranscription = useCallback(() => {
    if (isTranscribing && recognition) {
      recognition.stop();
      setIsTranscribing(false);
    } else if (recognition) {
      recognition.start();
      setIsTranscribing(true);
    }
  }, [isTranscribing, recognition]);

  if (!store) {
    return <div className="w-full h-full flex items-center justify-center">Loading transcription board...</div>;
  }

  return (
    <div className="relative w-full h-full">
      <Tldraw
        store={store}
        persistenceKey={`transcription-${roomId}`}
        onMount={handleMount}
      />
      
      <div className="absolute top-4 right-4 bg-white rounded shadow-md p-2 z-10">
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
} 