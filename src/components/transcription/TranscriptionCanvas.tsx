"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { Editor, createShapeId, toRichText } from '@tldraw/editor';
import { Tldraw } from '@tldraw/tldraw';
import { useTimelineContext } from '@/contexts/TimelineContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { addTranscriptionToCanvas, findEditor, handleLiveKitData } from './TranscriptionUtils';
import { useTranscriptionChunking } from './TranscriptionChunking';
import { NoteShapeProps } from './TranscriptionUtils';

interface TranscriptionCanvasProps {
  roomId: string;
}

export function TranscriptionCanvas({ roomId }: TranscriptionCanvasProps) {
  const room = useRoomContext();
  const editorRef = useRef<Editor | null>(null);
  const editorFoundRef = useRef(false);
  
  // Get timeline context
  const { 
    isTimelineActive = false, 
    addTimelineNote = () => {}, 
    getCurrentTimestamp = () => Date.now(),
  } = useTimelineContext() || {};

  // Find editor wrapper
  const findEditorWrapper = useCallback(() => {
    findEditor(editorRef);
    return editorFoundRef.current;
  }, []);

  // Create wrapper for addTranscriptionToCanvas
  const addTranscriptionToCanvasWrapper = useCallback((text: string) => {
    addTranscriptionToCanvas(text, editorRef, room);
  }, [room]);

  // Set up transcript chunking
  const {
    currentChunkRef,
    initializeChunk,
    finalizeTranscriptChunk,
    addTextToChunk
  } = useTranscriptionChunking({
    isTimelineActive,
    addTimelineNote,
    getCurrentTimestamp,
    addTranscriptionToCanvas: addTranscriptionToCanvasWrapper,
    findEditor: findEditorWrapper
  });

  // Main effect for LiveKit data handling
  useEffect(() => {
    // Debug log to check component mounting
    console.log(`TranscriptionCanvas mounted for room=${roomId}`);
    
    if (!room) {
      console.warn('Room context not available in TranscriptionCanvas');
      return;
    }
    
    // Initialize the transcript chunk with current time
    initializeChunk();
    
    // Send a test message to verify the data channel is working
    console.log('Publishing test message on data channel for debugging');
    
    let isComponentMounted = true;
    
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
        room.localParticipant.publishData(data, { reliable: true })
          .then(() => console.log('Test message published successfully'))
          .catch(error => {
            if (isComponentMounted) {
              console.error('Failed to publish test message:', error);
            }
          });
      } catch (error) {
        console.error('Failed to publish test message:', error);
      }
    }

    // Create data handler that uses our utility
    const handleData = (data: Uint8Array) => {
      handleLiveKitData(data, editorRef, isTimelineActive, addTextToChunk);
    };
      
    room.on('dataReceived', handleData);
    console.log('DataReceived event listener added to room');
    
    // Set up interval to finalize chunks that might be inactive
    const chunkCheckInterval = setInterval(() => {
      const chunk = currentChunkRef.current;
      const currentTime = getCurrentTimestamp();
      
      // If there's text in the chunk and it hasn't been updated for 5 seconds, finalize it
      if (chunk.text && currentTime - chunk.lastUpdate > 5000) {
        finalizeTranscriptChunk();
      }
    }, 5000);
    
    return () => {
      isComponentMounted = false;
      console.log('Removing dataReceived event listener');
      try {
        room.off('dataReceived', handleData);
        clearInterval(chunkCheckInterval);
      } catch (error) {
        console.error('Error cleaning up event listeners:', error);
      }
      
      // Finalize any remaining transcript chunk
      if (currentChunkRef.current.text) {
        finalizeTranscriptChunk();
      }
    };
  }, [room, roomId, getCurrentTimestamp, finalizeTranscriptChunk, addTextToChunk, isTimelineActive, initializeChunk, currentChunkRef]);

  return (
    <ErrorBoundary>
      <div style={{ width: '100%', height: '100%' }}>
        <Tldraw
          onMount={(editor: Editor) => {
            editorRef.current = editor;
            editorFoundRef.current = true;
            console.log('TLDraw editor mounted in TranscriptionCanvas');
            
            // Store the editor instance globally for easier access by other components
            if (typeof window !== 'undefined') {
              window.__editorInstance = editor;
              console.log('Editor attached to window.__editorInstance for global access');
              
              // Create a test note to verify editor is working properly
              setTimeout(() => {
                try {
                  const id = createShapeId();
                  const props: NoteShapeProps = {
                    color: 'green',
                    size: 'l',
                    font: 'draw',
                    align: 'middle',
                    growY: true,
                    w: 300,
                  };
                  
                  // Check which property to use for text content
                  const noteUtil = editor.getShapeUtil('note');
                  if (noteUtil) {
                    const defaultProps = noteUtil.getDefaultProps?.() || {};
                    if ('richText' in defaultProps) {
                      props.richText = toRichText('Editor successfully mounted!');
                    } else {
                      props.text = 'Editor successfully mounted!';
                    }
                  } else {
                    props.text = 'Editor successfully mounted!';
                  }
                  
                  const viewport = editor.getViewportPageBounds();
                  editor.createShapes([{
                    id,
                    type: 'note',
                    x: viewport.center.x,
                    y: viewport.center.y,
                    props
                  }]);
                  console.log('Initialization test note created successfully');
                } catch(e) {
                  console.error('Error creating test note:', e);
                }
              }, 2000);
            }
          }}
        />
      </div>
    </ErrorBoundary>
  );
}