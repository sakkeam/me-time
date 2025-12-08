'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRealtime } from '@/contexts/RealtimeContext';
import { VoicePreviewPlayer } from '@/lib/audioUtils';
import { Volume2, Loader2, Square, Play, Pause } from 'lucide-react';
import { kagome, type MorphemeToken } from '@/lib/kagomeUtils';
import MorphemeDisplay from '@/components/MorphemeDisplay';

export default function TranscriptionDisplay() {
  const { 
    transcriptionItems, 
    currentDelta, 
    assistantResponses, 
    currentAssistantDelta, 
    isConnected, 
    startSession, 
    stopSession, 
    error,
    selectedVoice,
    setSelectedVoice,
    VOICES,
    isAssistantSpeaking,
    isAudioPaused,
    interruptAudio,
    pauseAudio,
    resumeAudio
  } = useRealtime();

  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewPlayerRef = useRef<VoicePreviewPlayer | null>(null);

  const [morphemeTokens, setMorphemeTokens] = useState<MorphemeToken[]>([]);
  const [userMorphemeTokens, setUserMorphemeTokens] = useState<MorphemeToken[]>([]);
  const [kagomeReady, setKagomeReady] = useState(false);

  // Initialize kagome WASM
  useEffect(() => {
    kagome.init().then(() => {
      setKagomeReady(true);
      console.log('Kagome WASM initialized');
    }).catch(error => {
      console.error('Failed to initialize Kagome:', error);
    });
  }, []);

  // Get the text to display for assistant response
  const assistantDisplayText = currentAssistantDelta || assistantResponses[assistantResponses.length - 1]?.text;

  // Tokenize assistant response with debounce
  useEffect(() => {
    if (!kagomeReady || !assistantDisplayText) {
      setMorphemeTokens([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      try {
        const tokens = kagome.tokenize(assistantDisplayText);
        setMorphemeTokens(tokens);
      } catch (error) {
        console.error('Tokenization failed:', error);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [assistantDisplayText, kagomeReady]);

  useEffect(() => {
    previewPlayerRef.current = new VoicePreviewPlayer(
      (isLoading) => setPreviewLoading(isLoading),
      (error) => {
        console.error('Preview error:', error);
        setPreviewingVoice(null);
        setPreviewLoading(false);
      }
    );
    return () => {
      previewPlayerRef.current?.stop();
    };
  }, []);

  const handlePreview = async (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingVoice === voiceId) {
      previewPlayerRef.current?.stop();
      setPreviewingVoice(null);
      return;
    }
    
    setPreviewingVoice(voiceId);
    await previewPlayerRef.current?.play(voiceId);
  };

  // Get the text to display for user input
  const userDisplayText = currentDelta || transcriptionItems[transcriptionItems.length - 1]?.text;
  
  // Tokenize user input with debounce
  useEffect(() => {
    if (!kagomeReady || !userDisplayText) {
      setUserMorphemeTokens([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      try {
        const tokens = kagome.tokenize(userDisplayText);
        setUserMorphemeTokens(tokens);
      } catch (error) {
        console.error('User tokenization failed:', error);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [userDisplayText, kagomeReady]);

  return (
    <>
      {/* Assistant Response - Top of Screen */}
      {assistantDisplayText && (
        <div className="absolute top-8 left-0 right-0 px-4 z-50 pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            <div className="bg-green-600/80 backdrop-blur-md rounded-lg px-8 py-4 text-white shadow-2xl transition-all text-center relative group">
              <p className={`text-lg font-medium ${currentAssistantDelta ? 'animate-pulse' : ''}`}>
                {kagomeReady && morphemeTokens.length > 0 ? (
                  <MorphemeDisplay tokens={morphemeTokens} />
                ) : (
                  assistantDisplayText
                )}
              </p>
              
              {/* Playback Controls */}
              {(isAssistantSpeaking || isAudioPaused) && (
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isAudioPaused ? (
                    <button
                      onClick={resumeAudio}
                      className="p-2 bg-blue-500/90 hover:bg-blue-600 text-white rounded-full shadow-lg backdrop-blur-sm transition-all"
                      title="Resume Speaking"
                    >
                      <Play size={20} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      onClick={pauseAudio}
                      className="p-2 bg-yellow-500/90 hover:bg-yellow-600 text-white rounded-full shadow-lg backdrop-blur-sm transition-all"
                      title="Pause Speaking"
                    >
                      <Pause size={20} fill="currentColor" />
                    </button>
                  )}
                  <button
                    onClick={interruptAudio}
                    className="p-2 bg-red-500/90 hover:bg-red-600 text-white rounded-full shadow-lg backdrop-blur-sm transition-all"
                    title="Stop Speaking"
                  >
                    <Square size={20} fill="currentColor" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Input and Controls - Bottom of Screen */}
      <div className="absolute bottom-8 left-0 right-0 px-4 z-50 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto flex flex-col items-center gap-4">
          {/* Controls */}
          <div className="flex flex-col items-center gap-4">
            {!isConnected && (
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
                {VOICES.map((voice) => (
                  <div 
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice.id)}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all border backdrop-blur-sm
                      ${selectedVoice === voice.id 
                        ? 'bg-blue-600/80 border-blue-400 text-white shadow-lg scale-105' 
                        : 'bg-gray-800/60 border-gray-600 text-gray-300 hover:bg-gray-700/80'}
                    `}
                  >
                    <span className="text-sm font-medium">{voice.label}</span>
                    <button
                      onClick={(e) => handlePreview(voice.id, e)}
                      className={`
                        p-1 rounded-full hover:bg-white/20 transition-colors
                        ${previewingVoice === voice.id ? 'text-blue-200' : 'text-gray-400'}
                      `}
                    >
                      {previewingVoice === voice.id ? (
                        previewLoading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Square size={14} fill="currentColor" />
                        )
                      ) : (
                        <Volume2 size={14} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

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
                {kagomeReady && userMorphemeTokens.length > 0 ? (
                  <MorphemeDisplay tokens={userMorphemeTokens} />
                ) : (
                  userDisplayText
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
