import React, { createContext } from 'react';
import { VideoConferenceContextType } from './types';

// Create the context
export const VideoConferenceContext = createContext<VideoConferenceContextType | null>(null); 