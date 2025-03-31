import { useContext } from 'react';
import { VideoConferenceContext } from './context';

// Hook to use VideoConference context
export const useVideoConferenceContext = () => {
  const context = useContext(VideoConferenceContext);
  if (!context) {
    throw new Error('useVideoConferenceContext must be used within a VideoConferenceProvider');
  }
  return context;
}; 