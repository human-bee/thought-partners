"use client";

import { Tldraw, createTLStore, defaultShapeUtils, createShapeId } from 'tldraw';
import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import 'tldraw/tldraw.css';
import { VideoLogger } from '@/utils/VideoLogger';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { addTranscriptionToCanvas, publishData, TranscriptionEntry } from './BoardUtils';
import { useSpeechRecognition } from './SpeechRecognition';

// Add render counter
let renderCount = 0;

interface CollaborativeBoardProps {
  roomId: string;
}

// Wrap with memo to prevent unnecessary rerenders
const CollaborativeBoard = memo(function CollaborativeBoard({ roomId }: CollaborativeBoardProps) {
  // Debug: Track renders
  const renderCountRef = useRef(0);
  renderCount++;
  renderCountRef.current++;
  
  VideoLogger.debug(`CollaborativeBoard rendering, count=${renderCountRef.current}`);
  
  const [store, setStore] = useState<ReturnType<typeof createTLStore> | null>(null);
  const localParticipantData = useLocalParticipant();
  const roomContext = useRoomContext();
  const localParticipant = localParticipantData?.localParticipant;
  const storeInitializedRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);

  // Debug: Track state changes
  const prevStoreRef = useRef(store);
  const prevRoomContextRef = useRef(roomContext);
  const prevLocalParticipantRef = useRef(localParticipant);
  
  useEffect(() => {
    if (prevStoreRef.current !== store) {
      VideoLogger.debug('CollaborativeBoard: store changed');
      prevStoreRef.current = store;
    }
    if (prevRoomContextRef.current !== roomContext) {
      VideoLogger.debug('CollaborativeBoard: roomContext changed');
      prevRoomContextRef.current = roomContext;
    }
    if (prevLocalParticipantRef.current !== localParticipant) {
      VideoLogger.debug('CollaborativeBoard: localParticipant changed');
      prevLocalParticipantRef.current = localParticipant;
    }
  }, [store, roomContext, localParticipant]);
  
  // Debug: Log unmounting
  useEffect(() => {
    return () => {
      VideoLogger.info(`Unmounting CollaborativeBoard, final render count=${renderCountRef.current}`);
    };
  }, []);

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
        VideoLogger.warn('Error disposing TLDraw store:', e);
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
        VideoLogger.debug(`CollaborativeBoard received data: ${jsonString}`);
        
        const dataMessage = JSON.parse(jsonString);
        VideoLogger.debug('CollaborativeBoard parsed data message:', dataMessage);
        
        if (dataMessage.topic !== 'tldraw' && dataMessage.topic !== 'transcription') {
          VideoLogger.debug('CollaborativeBoard ignoring message with topic:', dataMessage.topic);
          return;
        }
        
        let data;
        try {
          data = JSON.parse(dataMessage.data);
          VideoLogger.debug('CollaborativeBoard parsed inner data:', data);
        } catch (error) {
          VideoLogger.error('CollaborativeBoard error parsing inner data:', error);
          return;
        }
        
        // Handle tldraw updates
        if (dataMessage.topic === 'tldraw' && data.type === 'tlDrawUpdate' && store) {
          VideoLogger.debug('CollaborativeBoard handling tldraw update');
          store.mergeRemoteChanges(() => {
            store.put(data.changes);
          });
        }
        
        // Handle transcription
        if (dataMessage.topic === 'transcription' && data.type === 'transcription' && editorRef.current) {
          VideoLogger.debug('CollaborativeBoard handling transcription:', {
            data: data,
            editorAvailable: !!editorRef.current,
            editorRef: editorRef
          });
          
          const transcriptionEntry: TranscriptionEntry = {
            participantIdentity: data.participantIdentity,
            participantName: data.participantName,
            text: data.text,
            timestamp: new Date()
          };
          
          addTranscriptionToCanvas(transcriptionEntry, editorRef.current);
        }
      } catch (error) {
        VideoLogger.error('Error processing data message:', error);
      }
    };

    // Listen for data messages from other participants
    try {
      room.dataReceived.on(handleDataReceived);
    } catch (e) {
      VideoLogger.error('Error setting up data listener:', e);
    }
    
    return () => {
      // Safely remove event listener
      try {
        if (room && room.dataReceived) {
          room.dataReceived.off(handleDataReceived);
        }
      } catch (e) {
        VideoLogger.warn('Error removing data listener:', e);
      }
    };
  }, [store, roomContext]);

  // Set up speech recognition
  const { isTranscribing, toggleTranscription } = useSpeechRecognition({ 
    roomContext 
  });

  // Store editor reference and handle changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMount = useCallback((editor: any) => {
    editorRef.current = editor;
    
    // Add a watermark "PRESENT" with very low opacity
    try {
      const viewport = editor.getViewportPageBounds();
      const watermarkId = createShapeId();
      
      // Slight delay to make sure it's placed on top
      setTimeout(() => {
        try {
          // Get proper text shape props based on the editor's schema
          const textShapeUtils = editor.getShapeUtil('text');
          const defaultTextProps = textShapeUtils?.getDefaultProps?.() || {};
          
          // Create a text watermark using a safer approach with schema-compatible properties
          const textShape = {
            id: watermarkId,
            type: 'text',
            x: viewport.center.x - 300,
            y: viewport.center.y - 80,
            props: {
              // Use schema-compatible props
              text: 'PRESENT',
              color: 'black',
              size: 'xl',
              font: 'draw',
              align: 'middle',
              w: 600, // Set explicit width for text
              growY: true,
            }
          };
          
          // Check if we need to use richText instead of text based on schema
          if ('richText' in defaultTextProps && !('text' in defaultTextProps)) {
            const { toRichText } = require('@tldraw/editor');
            textShape.props.richText = toRichText('PRESENT');
            delete textShape.props.text; // Remove text if richText is used
          }
          
          // Use batch to wrap the shape creation for error handling
          editor.batch(() => {
            editor.createShapes([textShape]);
            // Safely try to bring to front if the method exists
            if (typeof editor.bringToFront === 'function') {
              editor.bringToFront([watermarkId]);
            }
          });
          
          VideoLogger.debug('Successfully added PRESENT watermark to canvas');
        } catch (innerError) {
          VideoLogger.error('Error creating watermark shape:', innerError);
        }
      }, 500);
    } catch (error) {
      VideoLogger.error('Error setting up watermark:', error);
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
              localParticipant,
              JSON.stringify({
                type: 'tlDrawUpdate',
                changes: changes,
              }),
              'tldraw'
            );
          }
        }
      } catch (error) {
        VideoLogger.error('Error publishing drawing updates:', error);
      }
    });
  }, [localParticipant, roomContext]);

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