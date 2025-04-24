"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { DataPacket_Kind, DataPublishOptions, ConnectionState } from 'livekit-client';
import { Editor } from '@tldraw/editor';
import { useTranscriptStore } from '@/contexts/TranscriptStore';

// Add global window type augmentation
declare global {
  interface Window {
    __editorInstance?: Editor;
  }
}

interface SpeechRecognitionHook {
  isTranscribing: boolean;
  startTranscription: () => void;
  stopTranscription: () => void;
  error: string | null;
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const room = useRoomContext();
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addLine: addTranscriptLine } = useTranscriptStore();

  useEffect(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setError('Speech recognition not supported in this browser');
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
      setError(null);
    };
    
    recognitionInstance.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setError(event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access is required for transcription');
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
    
    recognitionInstance.onresult = async (event) => {
      console.log('Speech recognition result received:', event);
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        console.log(`Transcript ${i}:`, transcript, 'isFinal:', event.results[i].isFinal);
        
        if (event.results[i].isFinal) {
          const finalTranscript = transcript.trim();
          console.log('Final transcript:', finalTranscript);
          
          // Send the final transcript
          if (room?.localParticipant && finalTranscript !== '') {
            try {
              // Check room connection state before attempting to publish
              if (room.state !== ConnectionState.Connected) {
                console.warn('Cannot publish transcription data: room is not connected. Current state:',
                  ConnectionState[room.state] || room.state);
                return;
              }
              
              // Create the inner data object
              const transcriptionData = {
                type: 'transcription',
                participantIdentity: room.localParticipant.identity,
                participantName: room.localParticipant.identity,
                text: finalTranscript
              };
              
              console.log('Preparing transcription data object:', transcriptionData);
              
              // Wrap in a message with topic for proper handling
              const wrappedData = {
                topic: 'transcription',
                data: JSON.stringify(transcriptionData)
              };
              
              const jsonString = JSON.stringify(wrappedData);
              console.log('Serialized wrapped data:', jsonString);
              
              // Send to both components with the same format
              const data = new TextEncoder().encode(jsonString);
              const options: DataPublishOptions = { reliable: true };
              console.log('About to publish data with options:', options);
              
              // Log full data chain for debugging
              console.log('Full data chain:', {
                originalTranscript: finalTranscript,
                innerObject: transcriptionData,
                wrappedObject: wrappedData,
                serializedString: jsonString,
                byteLength: data.byteLength
              });
              
              room.localParticipant.publishData(data, options);
              console.log('Transcription data published successfully');
              
              // Immediately push to TranscriptStore locally so devs/agents can see it without waiting for round-trip.
              try {
                addTranscriptLine({
                  authorId: room.localParticipant.identity,
                  authorName: room.localParticipant.identity,
                  text: finalTranscript,
                  timestamp: new Date(),
                });
              } catch (e) {
                console.warn('Failed to add local transcript line:', e);
              }

              // Direct test to verify editor is working
              if (window.__editorInstance) {
                console.log('Test: directly creating note via window.__editorInstance');
                const { createShapeId, toRichText } = await import('@tldraw/editor');
                const id = createShapeId();
                window.__editorInstance.createShapes([{
                  id,
                  type: 'note',
                  x: window.__editorInstance.getViewportPageBounds().center.x,
                  y: window.__editorInstance.getViewportPageBounds().center.y,
                  props: {
                    richText: toRichText(`DIRECT TEST: ${finalTranscript}`),
                    color: 'yellow',
                    size: 'l',
                    font: 'draw',
                    align: 'middle',
                    verticalAlign: 'middle',
                    growY: true,
                  }
                }]);
              }
            } catch (error) {
              console.error('Error publishing transcription data:', error);
            }
          } else {
            console.warn('Could not publish transcription. Room or participant not available, or transcript empty.', {
              roomAvailable: !!room,
              participantAvailable: !!room?.localParticipant,
              transcriptEmpty: finalTranscript === ''
            });
          }
        }
      }
    };
    
    setRecognition(recognitionInstance);
    
    return () => {
      if (recognitionInstance) {
        try {
          recognitionInstance.stop();
        } catch (e) {
          console.warn('Error stopping speech recognition:', e);
        }
      }
    };
  }, [room, isTranscribing, addTranscriptLine]);

  const startTranscription = useCallback(() => {
    if (recognition) {
      try {
        recognition.start();
      } catch (e) {
        console.error('Failed to start speech recognition:', e);
        setError('Failed to start speech recognition');
      }
    }
  }, [recognition]);

  const stopTranscription = useCallback(() => {
    if (recognition) {
      try {
        recognition.stop();
        setIsTranscribing(false);
      } catch (e) {
        console.error('Failed to stop speech recognition:', e);
        setError('Failed to stop speech recognition');
      }
    }
  }, [recognition]);

  return {
    isTranscribing,
    startTranscription,
    stopTranscription,
    error
  };
} 