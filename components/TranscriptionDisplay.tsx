'use client';

import { useRealtime } from '@/contexts/RealtimeContext';

export default function TranscriptionDisplay() {
  const { 
    transcriptionItems, 
    currentDelta, 
    assistantResponses, 
    currentAssistantDelta, 
    isConnected, 
    startSession, 
    stopSession, 
    error 
  } = useRealtime();

  // Get the text to display for user input
  const userDisplayText = currentDelta || transcriptionItems[transcriptionItems.length - 1]?.text;
  
  // Get the text to display for assistant response
  const assistantDisplayText = currentAssistantDelta || assistantResponses[assistantResponses.length - 1]?.text;

  return (
    <>
      {/* Assistant Response - Top of Screen */}
      {assistantDisplayText && (
        <div className="absolute top-8 left-0 right-0 px-4 z-50 pointer-events-none">
          <div className="max-w-3xl mx-auto">
            <div className="bg-green-600/80 backdrop-blur-md rounded-lg px-8 py-4 text-white shadow-2xl transition-all text-center">
              <p className={`text-lg font-medium ${currentAssistantDelta ? 'animate-pulse' : ''}`}>
                {assistantDisplayText}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User Input and Controls - Bottom of Screen */}
      <div className="absolute bottom-8 left-0 right-0 px-4 z-50 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto flex flex-col items-center gap-4">
          {/* Controls */}
          <div className="flex justify-center gap-2">
            {!isConnected ? (
              <button
                onClick={startSession}
                className="px-6 py-2 bg-blue-600/90 hover:bg-blue-700 text-white rounded-full shadow-lg backdrop-blur-sm transition-all font-medium text-sm"
              >
                Start Conversation
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="px-6 py-2 bg-red-600/90 hover:bg-red-700 text-white rounded-full shadow-lg backdrop-blur-sm transition-all font-medium text-sm"
              >
                Stop
              </button>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/80 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm">
              {error}
            </div>
          )}

          {/* User Transcription Area */}
          {userDisplayText && (
            <div className="bg-black/60 backdrop-blur-md rounded-full px-8 py-3 text-white shadow-2xl transition-all text-center max-w-full">
              <p className={`text-xl font-medium truncate ${currentDelta ? 'text-blue-200 animate-pulse' : 'text-white/90'}`}>
                {userDisplayText}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
