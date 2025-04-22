"use client";

import React from 'react';

interface ErrorUIProps {
  connectionError: string | null;
  permissionsError: boolean;
  isRefreshingToken: boolean;
  onRefreshToken: () => void;
}

export const ErrorUI: React.FC<ErrorUIProps> = ({
  connectionError,
  permissionsError,
  isRefreshingToken,
  onRefreshToken
}) => {
  if (!connectionError) return null;
  
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-red-900/80 z-20">
      <div className="text-center p-4 max-w-md">
        <p className="mb-4">{connectionError}</p>
        {permissionsError && (
          <button
            onClick={onRefreshToken}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            disabled={isRefreshingToken}
          >
            {isRefreshingToken ? 'Reconnecting...' : 'Reconnect with New Token'}
          </button>
        )}
      </div>
    </div>
  );
};

export const CameraDisabledUI: React.FC<{
  onEnableCamera: () => void;
  initializeAudioContext: () => void;
}> = ({ onEnableCamera, initializeAudioContext }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
      <div className="text-center">
        <button
          onClick={(e) => {
            e.preventDefault();
            initializeAudioContext(); // Initialize audio context on click
            onEnableCamera();
          }}
          className="px-4 py-2 mb-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Enable Camera
        </button>
        <p className="text-sm text-gray-300">Click to enable your camera</p>
      </div>
    </div>
  );
}; 