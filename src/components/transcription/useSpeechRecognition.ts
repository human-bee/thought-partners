import { useState, useEffect, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { DataPacket_Kind, DataPublishOptions } from 'livekit-client';

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
    
    recognitionInstance.onresult = (event) => {
      console.log('Speech recognition result received:', event);
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        console.log(`Transcript ${i}:`, transcript, 'isFinal:', event.results[i].isFinal);
        
        if (event.results[i].isFinal) {
          const finalTranscript = transcript.trim();
          console.log('Final transcript:', finalTranscript);
          
          // Send the final transcript
          if (room?.localParticipant && finalTranscript !== '') {
            // Updated format to match what CollaborativeBoard expects
            const jsonData = JSON.stringify({
              type: 'transcription',
              participantIdentity: room.localParticipant.identity,
              participantName: room.localParticipant.identity,
              text: finalTranscript
            });
            
            // Wrap in a message with topic for proper handling
            const wrappedData = JSON.stringify({
              topic: 'transcription',
              data: jsonData
            });
            
            console.log('Publishing transcription data:', wrappedData);
            
            const data = new TextEncoder().encode(wrappedData);
            const options: DataPublishOptions = { reliable: true };
            room.localParticipant.publishData(data, options);
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
  }, [room, isTranscribing]);

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