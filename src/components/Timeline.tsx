"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTimelineContext, TimelineNote } from '@/contexts/TimelineContext';

const TIMELINE_MINUTES = 60; // Show 1 hour timeline by default
const PIXELS_PER_MINUTE = 100; // Height allocated per minute
const NOTE_WIDTH = 300; // Width of each note in pixels
const TIMELINE_WIDTH = 2; // Width of the timeline line in pixels

export function Timeline() {
  const {
    isTimelineActive,
    timelineNotes,
    currentTime,
    setCurrentTime,
    autoScroll,
    timelineRef,
    startTimeRef
  } = useTimelineContext();
  
  const [timelineHeight, setTimelineHeight] = useState(TIMELINE_MINUTES * PIXELS_PER_MINUTE);
  const timeMarkerRef = useRef<HTMLDivElement>(null);
  
  // Update current time every second
  useEffect(() => {
    if (!isTimelineActive) return;
    
    const interval = setInterval(() => {
      const newTime = Date.now() - startTimeRef.current;
      setCurrentTime(newTime);
      
      // Extend timeline if we're approaching the bottom
      const timeInMinutes = newTime / (1000 * 60);
      if (timeInMinutes > TIMELINE_MINUTES - 5) {
        setTimelineHeight((TIMELINE_MINUTES + 15) * PIXELS_PER_MINUTE);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isTimelineActive, setCurrentTime, startTimeRef]);
  
  // Auto-scroll to keep current time marker in view
  useEffect(() => {
    if (!autoScroll || !timeMarkerRef.current || !timelineRef.current) return;
    
    const markerPosition = timeMarkerRef.current.offsetTop;
    const timelineContainer = timelineRef.current;
    const containerHeight = timelineContainer.clientHeight;
    const scrollPosition = timelineContainer.scrollTop;
    
    // If the marker is below the visible area or too close to the top,
    // scroll to keep it centered in the visible area
    if (markerPosition > scrollPosition + containerHeight * 0.7 || 
        markerPosition < scrollPosition + containerHeight * 0.3) {
      timelineContainer.scrollTo({
        top: markerPosition - containerHeight / 2,
        behavior: 'smooth'
      });
    }
  }, [currentTime, autoScroll, timelineRef]);
  
  // Convert milliseconds to MM:SS format
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Calculate position on timeline based on time (in milliseconds)
  const getPositionFromTime = (ms: number): number => {
    return (ms / (1000 * 60)) * PIXELS_PER_MINUTE;
  };
  
  // Create time markers (every minute)
  const renderTimeMarkers = () => {
    const markers = [];
    const minutesShown = timelineHeight / PIXELS_PER_MINUTE;
    
    for (let i = 0; i <= minutesShown; i++) {
      const position = i * PIXELS_PER_MINUTE;
      markers.push(
        <div 
          key={`marker-${i}`}
          className="absolute left-0 right-0 flex items-center" 
          style={{ top: `${position}px` }}
        >
          <div className="text-gray-500 text-sm w-16 text-right pr-2">
            {`${i}:00`}
          </div>
          <div className="flex-1 border-t border-gray-200" />
        </div>
      );
    }
    
    return markers;
  };
  
  // Render notes on timeline
  const renderNotes = () => {
    return timelineNotes.map((note: TimelineNote) => {
      const topPosition = getPositionFromTime(note.startTime);
      const leftPosition = note.position.x < 0 ? -NOTE_WIDTH - 20 : 20;
      
      return (
        <div
          key={note.id}
          className="absolute bg-yellow-200 p-4 rounded shadow-md"
          style={{
            top: `${topPosition}px`,
            left: note.position.x < 0 ? 'auto' : `${leftPosition}px`,
            right: note.position.x < 0 ? `${leftPosition}px` : 'auto',
            width: `${NOTE_WIDTH}px`,
            maxHeight: '200px',
            overflow: 'auto'
          }}
        >
          <div className="text-sm mb-1 text-gray-500">
            {formatTime(note.startTime)}
          </div>
          <div>{note.text}</div>
        </div>
      );
    });
  };
  
  if (!isTimelineActive) return null;
  
  return (
    <div 
      ref={timelineRef}
      className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto bg-white/80 backdrop-blur-sm shadow-lg z-10"
    >
      <div className="relative" style={{ height: `${timelineHeight}px` }}>
        {/* Time markers */}
        {renderTimeMarkers()}
        
        {/* Center timeline */}
        <div 
          className="absolute h-full bg-black"
          style={{ 
            left: '50%', 
            width: `${TIMELINE_WIDTH}px`,
            transform: 'translateX(-50%)'
          }}
        />
        
        {/* Current time marker */}
        <div 
          ref={timeMarkerRef}
          className="absolute left-0 right-0 flex items-center z-20"
          style={{ top: `${getPositionFromTime(currentTime)}px` }}
        >
          <div className="text-blue-600 font-bold text-sm w-16 text-right pr-2">
            {formatTime(currentTime)}
          </div>
          <div 
            className="absolute left-1/2 w-4 h-4 rounded-full bg-blue-600"
            style={{ transform: 'translate(-50%, -50%)' }}
          />
        </div>
        
        {/* Notes */}
        {renderNotes()}
      </div>
      
      {/* Controls */}
      <div className="absolute top-4 right-4 flex gap-2">
        <button 
          className={`px-3 py-1 rounded text-white text-sm ${autoScroll ? 'bg-green-500' : 'bg-gray-500'}`}
          onClick={() => autoScroll}
        >
          Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
} 