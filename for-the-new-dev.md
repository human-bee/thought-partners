# Thought Partners Transcription System

## Overview
This document provides an overview of the transcription system implemented in the Thought Partners application. It helps you understand how the speech-to-text functionality works and how it integrates with the collaborative canvas.

## Core Components

### Transcription System
- **useSpeechRecognition.ts**: The core hook that interfaces with the browser's Web Speech API
- **TranscriptionCanvas.tsx**: Manages the canvas where transcription notes appear
- **TranscriptionControls.tsx**: UI for starting/stopping transcription
- **TranscriptionContext.tsx**: Provides state management for the transcription feature

## How Transcription Works

1. **Capturing Audio**: The Web Speech API is used to capture audio from the user's microphone
2. **Real-time Processing**: Speech is processed in real-time with interim and final results
3. **Broadcasting Transcriptions**: Transcribed text is published to all participants via LiveKit's data channel
4. **Visualization**: Transcriptions appear as note shapes on the TLDraw canvas

## Data Flow

1. User starts transcription using the UI controls
2. The SpeechRecognition API processes audio input
3. When a final transcription is available, it's formatted and published
4. Other clients receive this data and display it as a note on their canvas

## Transcription Message Format

The system uses a nested message format:
```javascript
{
  topic: 'transcription',
  data: JSON.stringify({
    type: 'transcription',
    participantIdentity: 'user-id',
    participantName: 'Username',
    text: 'The transcribed text content',
    minute: 2, // Which minute this transcription belongs to
    isPartial: false, // Whether this is a partial update or a complete minute chunk
    timestamp: '2024-04-08T12:34:56.789Z'
  })
}
```

## One-Minute Chunking Feature

The application implements a feature that chunks transcriptions into one-minute segments, with each segment displayed as a separate post-it note on the canvas.

### How One-Minute Chunking Works

1. **Time Tracking**:
   - When transcription starts, a timer begins counting elapsed seconds
   - The current minute is calculated from elapsed time (Math.floor(elapsedTime / 60))
   - A progress bar visualizes the current position within the minute

2. **Text Buffering**:
   - As transcription happens, text is added to a buffer for the current minute
   - When a minute boundary is crossed, the buffer is published as a complete chunk
   - The buffer is then reset for the new minute

3. **Visual Organization**:
   - Complete minute chunks are displayed as yellow notes with "Minute X" headers
   - Partial updates (within a minute) are displayed as light yellow notes
   - Notes are organized in columns by minute for better visual structure

4. **Canvas Layout**:
   - Each minute has its own column on the canvas
   - Complete minute chunks are stacked vertically within their column
   - The canvas automatically focuses on new complete minute chunks

### Implementation Details

#### Time Tracking System
```javascript
// When transcription starts, initialize time tracking
const now = Date.now();
setStartTime(now);
setElapsedTime(0);
setCurrentMinute(0);

// Update elapsed time every second
timerRef.current = setInterval(() => {
  const now = Date.now();
  const elapsed = Math.floor((now - startTime) / 1000);
  setElapsedTime(elapsed);
  
  // Check if we've entered a new minute
  const minute = Math.floor(elapsed / 60);
  if (minute > lastMinuteRef.current) {
    lastMinuteRef.current = minute;
    setCurrentMinute(minute);
    
    // Process buffer at minute boundary
    if (transcriptBufferRef.current.trim() !== '') {
      sendTranscriptionChunk(transcriptBufferRef.current, minute - 1);
      transcriptBufferRef.current = '';
    }
  }
}, 1000);
```

#### UI Elements
The transcription controls display:
- Current elapsed time in MM:SS format
- Current minute number
- A progress bar showing position within the current minute

#### Canvas Organization
Transcription notes are positioned based on their minute:
```javascript
// Column-based positioning for minute chunks
const columnWidth = 320; // Width of each "column" for a minute
const columnGap = 30;  // Gap between columns
const baseX = viewport.minX + 50; // Starting X position
const baseY = viewport.minY + 50; // Starting Y position

x = baseX + (minute * (columnWidth + columnGap));
```

## Development Notes

- The TLDraw editor instance is accessible through references and also stored in a global window variable as a fallback
- LiveKit's data channels are used to synchronize transcriptions across participants
- Debugging logs are extensive to help troubleshoot communication issues

## Getting Started

To work on the transcription feature:
1. Familiarize yourself with Web Speech API
2. Understand the LiveKit data channel system
3. Review the TLDraw shape creation API

## Useful Resources

- [Web Speech API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [TLDraw Documentation](https://tldraw.dev/docs)
- [LiveKit Documentation](https://docs.livekit.io/) 