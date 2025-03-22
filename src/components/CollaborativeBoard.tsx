import { Tldraw, TldrawEditor, createTLStore, defaultShapeUtils, useEditor } from 'tldraw';
import { useEffect, useState, useCallback } from 'react';
import 'tldraw/tldraw.css';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';

interface CollaborativeBoardProps {
  roomId: string;
}

export default function CollaborativeBoard({ roomId }: CollaborativeBoardProps) {
  const [store, setStore] = useState<ReturnType<typeof createTLStore> | null>(null);
  const localParticipantData = useLocalParticipant();
  const roomContext = useRoomContext();
  const localParticipant = localParticipantData?.localParticipant;

  // Initialize TLDraw store
  useEffect(() => {
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

  // Set up LiveKit data channel for store synchronization
  useEffect(() => {
    if (!store || !roomContext?.room) return;
    
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

  // Send local changes to other participants
  const handleEditorChange = useCallback((editor: any) => {
    if (!localParticipant || !roomContext?.room) return;
    
    try {
      // Get changes from the editor
      const changes = editor.getChanges();
      if (changes.length === 0) return;
      
      // Send changes to other participants
      localParticipant.publishData(
        JSON.stringify({
          type: 'tlDrawUpdate',
          changes: changes,
        }),
        'tldraw'
      );
    } catch (error) {
      console.error('Error publishing drawing updates:', error);
    }
  }, [localParticipant, roomContext]);

  if (!store) return <div>Loading whiteboard...</div>;

  return (
    <div className="h-full w-full">
      <Tldraw
        store={store}
        persistenceKey={roomId}
        onEditorStateChange={handleEditorChange}
      />
    </div>
  );
} 