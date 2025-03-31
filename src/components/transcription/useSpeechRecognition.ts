"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { DataPacket_Kind, DataPublishOptions } from 'livekit-client';
import { Editor } from '@tldraw/editor';

// Add global window type augmentation
declare global {
  interface Window {
    __editorInstance?: Editor;
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

interface SpeechRecognitionHook {
  isTranscribing: boolean;
  startTranscription: () => void;
  stopTranscription: () => void;
  error: string | null;
  lastTranscript: string | null;
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const room = useRoomContext();
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);

  // Create a stable reference to room to avoid unnecessary re-renders
  const roomRef = useCallback(() => room, [room]);

  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;
    
    // Check for speech recognition support
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    // Flag to track if we're unmounting
    let isComponentMounted = true;

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setError('Speech recognition not available');
        return;
      }
      
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onstart = () => {
        console.log('Speech recognition started');
        if (isComponentMounted) {
          setIsTranscribing(true);
          setError(null);
        }
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        if (isComponentMounted) {
          setError(event.error);
          if (event.error === 'not-allowed') {
            setError('Microphone access is required for transcription');
          }
        }
      };
      
      recognitionInstance.onend = () => {
        console.log('Speech recognition ended');
        if (isComponentMounted) {
          setIsTranscribing(false);
          // Try to restart if not intentionally stopped and component is still mounted
          if (isTranscribing && isComponentMounted) {
            try {
              setTimeout(() => {
                if (isComponentMounted && isTranscribing) {
                  try {
                    recognitionInstance.start();
                  } catch (restartError) {
                    console.error('Error restarting recognition:', restartError);
                  }
                }
              }, 1000); // Add a small delay before restarting
            } catch (e) {
              console.warn('Could not restart speech recognition:', e);
              if (isComponentMounted) {
                setError('Failed to restart speech recognition');
              }
            }
          }
        }
      };
      
      recognitionInstance.onresult = (event) => {
        if (!isComponentMounted) return;
        
        try {
          console.log('Speech recognition result received');
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log(`Transcript ${i}:`, transcript, 'isFinal:', event.results[i].isFinal);
            
            if (event.results[i].isFinal) {
              const finalTranscript = transcript.trim();
              console.log('Final transcript:', finalTranscript);
              setLastTranscript(finalTranscript);
              
              // Send the final transcript
              const currentRoom = roomRef();
              if (currentRoom?.localParticipant && finalTranscript !== '' && isComponentMounted) {
                try {
                  // Create the inner data object
                  const transcriptionData = {
                    type: 'transcription',
                    participantIdentity: currentRoom.localParticipant.identity,
                    participantName: currentRoom.localParticipant.identity,
                    text: finalTranscript
                  };
                  
                  // Wrap in a message with topic for proper handling
                  const wrappedData = {
                    topic: 'transcription',
                    data: JSON.stringify(transcriptionData)
                  };
                  
                  const jsonString = JSON.stringify(wrappedData);
                  
                  // Send to both components with the same format
                  const data = new TextEncoder().encode(jsonString);
                  const options: DataPublishOptions = { reliable: true };
                  
                  // Wrap in a promise and handle rejection
                  currentRoom.localParticipant.publishData(data, options)
                    .then(() => {
                      console.log('Transcription data published successfully');
                    })
                    .catch((publishError) => {
                      console.error('Error publishing data:', publishError);
                      if (isComponentMounted) {
                        setError('Failed to publish transcription');
                      }
                    });
                } catch (error) {
                  console.error('Error preparing transcription data:', error);
                  if (isComponentMounted) {
                    setError('Failed to prepare transcription');
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing speech result:', error);
          if (isComponentMounted) {
            setError('Error processing speech recognition result');
          }
        }
      };
      
      setRecognition(recognitionInstance);
      
      return () => {
        isComponentMounted = false;
        if (recognitionInstance) {
          try {
            recognitionInstance.stop();
          } catch (e) {
            console.warn('Error stopping speech recognition:', e);
          }
        }
      };
    } catch (setupError) {
      console.error('Error setting up speech recognition:', setupError);
      if (isComponentMounted) {
        setError('Failed to set up speech recognition');
      }
      return () => {
        isComponentMounted = false;
      };
    }
  }, [roomRef, isTranscribing]);

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
    error,
    lastTranscript
  };
} 