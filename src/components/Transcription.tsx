import { useEffect, useState, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { LocalParticipant, RemoteParticipant, Track } from 'livekit-client';

interface TranscriptionEntry {
  participantIdentity: string;
  participantName: string;
  text: string;
  timestamp: Date;
}

export default function Transcription() {
  const roomContext = useRoomContext();
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  useEffect(() => {
    if (!roomContext?.room) return;
    
    const room = roomContext.room;

    const handleTranscriptionMessage = (payload: any) => {
      try {
        const data = JSON.parse(payload);
        if (data.type === 'transcription') {
          setTranscriptions(prev => [
            ...prev, 
            {
              participantIdentity: data.participantIdentity,
              participantName: data.participantName,
              text: data.text,
              timestamp: new Date()
            }
          ].slice(-20)); // Keep only the last 20 entries
        }
      } catch (error) {
        console.error('Error processing transcription data:', error);
      }
    };

    const setupTranscription = async () => {
      // In a real implementation, this would connect to a speech-to-text service
      setIsTranscribing(true);
    };

    // Setup transcription when the room is connected
    setupTranscription();

    // Listen for transcription data
    room.dataReceived.on(handleTranscriptionMessage);

    return () => {
      // Safety check before removing listener
      if (room && room.dataReceived) {
        try {
          room.dataReceived.off(handleTranscriptionMessage);
        } catch (e) {
          console.warn('Could not remove data listener:', e);
        }
      }
      setIsTranscribing(false);
    };
  }, [roomContext]);

  // In a real implementation, this would run speech recognition on audio tracks
  const simulateTranscription = useCallback((text: string) => {
    if (!roomContext?.room || !roomContext.room.localParticipant) return;
    
    try {
      // Send a simulated transcription message
      roomContext.room.localParticipant.publishData(
        JSON.stringify({
          type: 'transcription',
          participantIdentity: roomContext.room.localParticipant.identity,
          participantName: roomContext.room.localParticipant.name || 'You',
          text: text
        }),
        'transcription'
      );
    } catch (error) {
      console.error('Error publishing transcription data:', error);
    }
  }, [roomContext]);

  const handleSimulate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    simulateTranscription("Hello, this is a test transcription message.");
  }, [simulateTranscription]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.stopPropagation(); // Prevent event bubbling
      simulateTranscription(e.currentTarget.value);
      e.currentTarget.value = '';
    }
  }, [simulateTranscription]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-800 text-white" onClick={(e) => e.stopPropagation()}>
      <div className="p-2 bg-gray-900 font-medium border-b border-gray-700">
        Real-time Transcript {isTranscribing && <span className="text-green-400">• Live</span>}
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {transcriptions.length === 0 ? (
          <div className="text-gray-400 text-center py-4">
            Transcriptions will appear here.
            <div className="mt-2">
              <button 
                onClick={handleSimulate}
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
              >
                Simulate Transcription
              </button>
            </div>
          </div>
        ) : (
          transcriptions.map((entry, index) => (
            <div key={index} className="bg-gray-700 rounded p-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">{entry.participantName}</span>
                <span className="text-xs text-gray-400">
                  {entry.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm mt-1">{entry.text}</p>
            </div>
          ))
        )}
      </div>
      
      {isTranscribing && (
        <div className="p-3 border-t border-gray-700">
          <input
            type="text"
            placeholder="Type to simulate transcription..."
            className="w-full p-2 bg-gray-700 text-white rounded"
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
} 