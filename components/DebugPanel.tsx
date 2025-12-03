'use client'

import React from 'react';
import { useFaceTracking } from '@/contexts/FaceTrackingContext';

export default function DebugPanel() {
  const { 
    yaw, 
    pitch, 
    x, y, z,
    isDetecting, 
    isLoading, 
    error, 
    permissionDenied,
    showDebug,
    setShowDebug
  } = useFaceTracking();

  return (
    <>
      {/* Toggle Button - Top Right */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="fixed top-4 right-4 z-50 px-4 py-2 bg-gray-800/80 text-white text-sm rounded-full backdrop-blur-sm hover:bg-gray-700 transition-colors border border-gray-600"
      >
        {showDebug ? 'Hide Debug' : 'Show Debug'}
      </button>

      {/* Stats Panel - Bottom Right (above video) */}
      {showDebug && (
        <div className="fixed bottom-[270px] right-4 z-50 w-[320px] p-4 bg-gray-900/90 text-white rounded-lg backdrop-blur-md border border-gray-700 shadow-xl font-mono text-xs">
          <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
            <span className="font-bold text-blue-400">Face Tracking Stats</span>
            <span className={`px-2 py-0.5 rounded-full ${isDetecting ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
              {isDetecting ? 'DETECTED' : 'NO FACE'}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Yaw:</span>
              <span>{(yaw * 180 / Math.PI).toFixed(1)}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pitch:</span>
              <span>{(pitch * 180 / Math.PI).toFixed(1)}°</span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
              <span className="text-gray-400">Pos X:</span>
              <span>{x.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pos Y:</span>
              <span>{y.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pos Z:</span>
              <span>{z.toFixed(2)}</span>
            </div>
            
            {isLoading && (
              <div className="mt-2 text-yellow-400 animate-pulse">
                Loading model...
              </div>
            )}

            {error && (
              <div className="mt-2 text-red-400 break-words">
                Error: {error}
              </div>
            )}

            {permissionDenied && (
              <div className="mt-2 text-red-400 font-bold">
                Camera permission denied. Please allow camera access.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
