'use client';

import { useRealtime } from '@/contexts/RealtimeContext';
import { useEffect, useRef } from 'react';

export default function TranscriptionDisplay() {
  const { transcriptionItems, currentDelta, isConnected, startSession, stopSession, error } = useRealtime();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptionItems, currentDelta]);

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 z-50 pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto">
        {/* Controls */}
        <div className="flex justify-center mb-4 gap-2">
          {!isConnected ? (
            <button
              onClick={startSession}
              className="px-6 py-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Start Conversation
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="px-6 py-2 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-colors font-medium"
            >
              Stop
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/80 text-white px-4 py-2 rounded-lg mb-2 text-center backdrop-blur-sm">
            {error}
          </div>
        )}

        {/* Transcription Area */}
        {(transcriptionItems.length > 0 || currentDelta) && (
          <div 
            ref={scrollRef}
            className="bg-black/50 backdrop-blur-md rounded-xl p-4 max-h-60 overflow-y-auto text-white shadow-xl transition-all"
          >
            <div className="space-y-2">
              {transcriptionItems.map((item) => (
                <div key={item.id} className="opacity-90 text-lg">
                  {item.text}
                </div>
              ))}
              {currentDelta && (
                <div className="font-bold text-blue-200 text-lg animate-pulse">
                  {currentDelta}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
