import { create } from 'zustand';

export interface TranscriptionEntry {
  participantIdentity: string;
  participantName: string;
  text: string;
  timestamp: Date;
}

interface TranscriptionStore {
  transcriptions: TranscriptionEntry[];
  addTranscription: (entry: TranscriptionEntry) => void;
  clearTranscriptions: () => void;
}

export const useTranscriptionStore = create<TranscriptionStore>((set) => ({
  transcriptions: [],
  addTranscription: (entry) =>
    set((state) => ({
      transcriptions: [...state.transcriptions, entry].slice(-20), // Keep last 20 entries
    })),
  clearTranscriptions: () => set({ transcriptions: [] }),
})); 