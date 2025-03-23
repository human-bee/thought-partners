import { useEffect, useRef, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { Editor, createShapeId } from '@tldraw/editor';
import { Tldraw } from '@tldraw/tldraw';
import { DataPublishOptions } from 'livekit-client';

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
      console.warn('Editor ref is not available');
      return;
    }

    const editor = editorRef.current;
    const id = createShapeId();

    try {
      // Create a note shape instead of text (better for transcriptions)
      const shape = {
        id,
        type: 'note',
        x: Math.random() * 600,
        y: Math.random() * 400,
        props: {
          content: text,
          color: 'yellow',
          size: 'l',
          font: 'draw',
          align: 'middle',
          verticalAlign: 'middle',
          growY: true,
          width: 300,
        }
      };

      console.log('Creating shape:', shape);
      editor.createShapes([shape]);
      console.log('Shape created successfully');

      // Publish the shape data to other participants
      if (room && room.localParticipant) {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify({ type: 'transcription', shape }));
        const options: DataPublishOptions = { reliable: true };
        room.localParticipant.publishData(data, options);
      }
    } catch (error) {
      console.error('Error creating shape:', error);
    }
  }, [room]);

  useEffect(() => {
    // Debug log to check component mounting
    console.log('TranscriptionCanvas component mounted, room is available:', !!room);
    
    if (!room) {
      console.warn('Room is not available');
      return;
    }

    // Debug log to check event binding
    console.log('Setting up dataReceived event listener on room:', room);

    const handleData = (data: Uint8Array) => {
      console.log('DATA RECEIVED EVENT TRIGGERED with data length:', data.length);
      try {
        const decoder = new TextDecoder();
        const jsonStr = decoder.decode(data);
        console.log('Received raw data message:', jsonStr);
        
        // Try to parse the message
        const message = JSON.parse(jsonStr);
        console.log('Parsed data message:', message);
        
        // Handle direct transcription format
        if (message.type === 'transcription') {
          if (message.text) {
            console.log('Adding received transcription text to canvas:', message.text);
            addTranscriptionToCanvas(message.text);
          } else if (message.shape) {
            console.log('Received transcription shape message:', message.shape);
          } else {
            console.warn('Received transcription message without text or shape:', message);
          }
        } 
        // Handle wrapped format with topic field (used by CollaborativeBoard)
        else if (message.topic === 'transcription' && message.data) {
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

    room.on('dataReceived', handleData);
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
          console.log('TLDraw editor mounted');
        }}
      />
    </div>
  );
}