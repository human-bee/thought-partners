"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { VideoLogger } from '@/utils/VideoLogger';
import { publishData } from './BoardUtils';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface UseSpeechRecognitionProps {
  roomContext: any;
  onTranscriptionStateChange?: (isTranscribing: boolean) => void;
}

export function useSpeechRecognition({ 
  roomContext,
  onTranscriptionStateChange
}: UseSpeechRecognitionProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const recognitionInitializedRef = useRef(false);

  // Function to toggle transcription on/off
  const toggleTranscription = useCallback(() => {
    if (isTranscribing && recognition) {
      try {
        recognition.stop();
        setIsTranscribing(false);
        if (onTranscriptionStateChange) {
          onTranscriptionStateChange(false);
        }
      } catch (e) {
        VideoLogger.error('Error stopping recognition:', e);
      }
    } else if (recognition) {
      try {
        recognition.start();
        setIsTranscribing(true);
        if (onTranscriptionStateChange) {
          onTranscriptionStateChange(true);
        }
      } catch (e) {
        VideoLogger.error('Error starting recognition:', e);
      }
    }
  }, [isTranscribing, recognition, onTranscriptionStateChange]);

  // Set up browser speech recognition
  useEffect(() => {
    // Skip if already initialized or if we're in an unmounted state
    if (recognitionInitializedRef.current || !roomContext) return;
    recognitionInitializedRef.current = true;
    
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      VideoLogger.error('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognition();
    
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';
    
    recognitionInstance.onstart = () => {
      VideoLogger.debug('Speech recognition started');
      setIsTranscribing(true);
      if (onTranscriptionStateChange) {
        onTranscriptionStateChange(true);
      }
    };
    
    recognitionInstance.onerror = (event: any) => {
      VideoLogger.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        alert('Microphone access is required for transcription');
      }
    };
    
    recognitionInstance.onend = () => {
      VideoLogger.debug('Speech recognition ended');
      setIsTranscribing(false);
      if (onTranscriptionStateChange) {
        onTranscriptionStateChange(false);
      }
      // Don't auto-restart to avoid cascading issues
    };
    
    let finalTranscript = '';
    
    recognitionInstance.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript = transcript;
          
          // Send the final transcript
          if (roomContext && finalTranscript.trim() !== '') {
            // Use any type to avoid type errors
            const room = roomContext as any;
            if (room.localParticipant) {
              publishData(
                room.localParticipant,
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
        VideoLogger.warn('Error stopping speech recognition on cleanup:', e);
      }
      recognitionInitializedRef.current = false;
    };
  }, [roomContext, onTranscriptionStateChange]);

  return {
    isTranscribing,
    toggleTranscription,
    recognition
  };
} 