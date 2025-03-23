import { Tldraw, createTLStore, defaultShapeUtils } from 'tldraw';
import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import 'tldraw/tldraw.css';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';

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
  
  console.time(`CollaborativeBoard render ${renderCountRef.current}`);
  
  const [store, setStore] = useState<ReturnType<typeof createTLStore> | null>(null);
  const localParticipantData = useLocalParticipant();
  const roomContext = useRoomContext();
  const localParticipant = localParticipantData?.localParticipant;
  const storeInitializedRef = useRef(false);

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
        console.warn('Error disposing TLDraw store:', e);
      }
    };
  }, []);

  // Set up LiveKit data channel for store synchronization with stable dependencies
  useEffect(() => {
    if (!store || !roomContext?.room || !roomContext.room.dataReceived) return;
    
    const room = roomContext.room;
    
    // Set up handler for incoming data messages
    const handleDataReceived = (dataMessage: any) => {
      try {
        if (dataMessage.topic !== 'tldraw') return;
        
        const data = JSON.parse(dataMessage.data);
        // Apply received changes to the local store
        if (data.type === 'tlDrawUpdate' && store) {
          store.mergeRemoteChanges(() => {
            store.put(data.changes);
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

  // Memoize publishData function to reduce dependency changes
  const publishData = useCallback((data: string, topic: string) => {
    if (!localParticipant) return;
    localParticipant.publishData(data, topic);
  }, [localParticipant]);

  // Handle editor changes with stable dependencies
  const handleEditorChange = useCallback((editor: any) => {
    if (!localParticipant || !roomContext?.room) return;
    
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
    <div className="h-full w-full overflow-hidden bg-white">
      {tldrawComponent}
    </div>
  );
});

export default CollaborativeBoard; 