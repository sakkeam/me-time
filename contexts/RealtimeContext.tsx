'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AudioRecorder, AudioPlayer } from '@/lib/audioUtils';
import { useChat } from '@ai-sdk/react';
import { useAnimation } from '@/contexts/AnimationContext';
import { Message } from 'ai';

interface RealtimeContextType {
  isConnected: boolean;
  isRecording: boolean;
  startSession: () => Promise<void>;
  stopSession: () => void;
  transcriptionItems: TranscriptionItem[];
  currentDelta: string;
  assistantResponses: TranscriptionItem[];
  currentAssistantDelta: string;
  error: string | null;
  selectedVoice: string;
  setSelectedVoice: (voice: string) => void;
  VOICES: typeof VOICES;
  isAssistantSpeaking: boolean;
  isAudioPaused: boolean;
  interruptAudio: () => void;
  pauseAudio: () => void;
  resumeAudio: () => void;
}

interface TranscriptionItem {
  id: string;
  text: string;
  timestamp: number;
}

export const VOICES = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'echo', label: 'Echo' },
  { id: 'shimmer', label: 'Shimmer' },
  { id: 'ash', label: 'Ash' },
  { id: 'ballad', label: 'Ballad' },
  { id: 'coral', label: 'Coral' },
  { id: 'sage', label: 'Sage' },
  { id: 'verse', label: 'Verse' },
] as const;

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptionItems, setTranscriptionItems] = useState<TranscriptionItem[]>([]);
  const [currentDelta, setCurrentDelta] = useState('');
  const [assistantResponses, setAssistantResponses] = useState<TranscriptionItem[]>([]);
  const [currentAssistantDelta, setCurrentAssistantDelta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoiceState] = useState<string>('alloy');
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const currentItemIdRef = useRef<string | null>(null);
  const currentResponseIdRef = useRef<string | null>(null);
  const lastProcessedResponseId = useRef<string | null>(null);

  const { playAnimation } = useAnimation();

  // Voltagent integration
  const chat = useChat({
    id: 'animation-agent',
    api: '/api/chat',
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === 'play_animation') {
        const args = toolCall.args as any;
        playAnimation(args.animation);
      }
    },
  });
  
  const { append, setMessages } = chat;

  // Trigger agent analysis when a new assistant response is complete
  useEffect(() => {
    if (assistantResponses.length > 0) {
      const lastResponse = assistantResponses[assistantResponses.length - 1];
      
      if (lastResponse.id !== lastProcessedResponseId.current) {
        lastProcessedResponseId.current = lastResponse.id;
        
        // Construct history
        const history: Message[] = [
          ...transcriptionItems.map(t => ({ id: t.id, role: 'user' as const, content: t.text, createdAt: new Date(t.timestamp) })),
          ...assistantResponses.map(a => ({ id: a.id, role: 'assistant' as const, content: a.text, createdAt: new Date(a.timestamp) }))
        ].sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));

        // Take last 10 messages for context
        const recentHistory = history.slice(-10);
        
        setMessages(recentHistory);
        
        if (append) {
          append({ role: 'user', content: 'Analyze the conversation and play an animation if appropriate.' });
        } else {
          console.warn('useChat append function is missing', chat);
        }
      }
    }
  }, [assistantResponses, transcriptionItems, append, setMessages, chat]);

  // Initialize audio player
  useEffect(() => {
    audioPlayerRef.current = new AudioPlayer((isPlaying) => {
      setIsAssistantSpeaking(isPlaying);
    });
    return () => {
      audioPlayerRef.current?.stop();
    };
  }, []);

  const interruptAudio = useCallback(() => {
    audioPlayerRef.current?.interrupt();
    setIsAudioPaused(false);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentResponseIdRef.current) {
        wsRef.current.send(JSON.stringify({
            type: 'response.cancel'
        }));
    }
  }, []);

  const pauseAudio = useCallback(() => {
    audioPlayerRef.current?.pause();
    setIsAudioPaused(true);
  }, []);

  const resumeAudio = useCallback(() => {
    audioPlayerRef.current?.resume();
    setIsAudioPaused(false);
  }, []);

  // Load saved voice preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedVoice');
      if (saved && VOICES.some(v => v.id === saved)) {
        setSelectedVoiceState(saved);
      }
    }
  }, []);

  const setSelectedVoice = useCallback((voice: string) => {
    setSelectedVoiceState(voice);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedVoice', voice);
    }

    // Update active session if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'session.update',
        session: {
          voice: voice
        }
      }));
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      // Get ephemeral token
      const tokenResponse = await fetch(`/api/realtime-token?voice=${selectedVoice}`, {
        method: 'POST',
      });
      
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || 'Failed to get token');
      }
      
      const data = await tokenResponse.json();
      const clientSecret = data.client_secret.value;

      // Connect to WebSocket
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
        ['realtime', `openai-insecure-api-key.${clientSecret}`, 'openai-beta.realtime-v1']
      );

      ws.onopen = () => {
        console.log('Connected to OpenAI Realtime API');
        setIsConnected(true);
        
        // Configure session
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            voice: selectedVoice,
            input_audio_transcription: {
              model: 'whisper-1',
              language: 'ja'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            }
          }
        }));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'session.created':
            console.log('Session created:', message);
            break;

          case 'input_audio_buffer.speech_started':
            interruptAudio();
            break;
            
          case 'conversation.item.input_audio_transcription.delta':
            setCurrentDelta(prev => prev + message.delta);
            if (!currentItemIdRef.current) {
              currentItemIdRef.current = message.item_id;
            }
            break;
            
          case 'conversation.item.input_audio_transcription.completed':
            const text = message.transcript;
            if (text) {
              setTranscriptionItems(prev => [
                ...prev,
                {
                  id: message.item_id,
                  text: text,
                  timestamp: Date.now()
                }
              ]);
              setCurrentDelta('');
              currentItemIdRef.current = null;
            }
            break;

          case 'response.created':
            currentResponseIdRef.current = message.response.id;
            break;

          case 'response.done':
            currentResponseIdRef.current = null;
            break;

          case 'response.audio_transcript.delta':
            setCurrentAssistantDelta(prev => prev + message.delta);
            if (!currentResponseIdRef.current) {
              currentResponseIdRef.current = message.response_id;
            }
            break;

          case 'response.audio_transcript.done':
            const responseText = message.transcript;
            if (responseText) {
              setAssistantResponses(prev => [
                ...prev,
                {
                  id: message.response_id,
                  text: responseText,
                  timestamp: Date.now()
                }
              ]);
              setCurrentAssistantDelta('');
            }
            break;

          case 'response.audio.delta':
            audioPlayerRef.current?.play(message.delta);
            break;

          case 'response.audio.done':
            // Handled by AudioPlayer state change
            break;
            
          case 'error':
            // Ignore specific errors that are expected during normal operation
            if (message.error?.code === 'cancellation_failed' || 
                message.error?.message?.includes('no active response found')) {
              console.warn('Ignored cancellation error:', message);
              return;
            }
            console.error('Realtime API error:', message);
            setError(message.error?.message || 'Unknown error');
            break;
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from OpenAI Realtime API');
        setIsConnected(false);
        setIsRecording(false);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('Connection error');
      };

      wsRef.current = ws;

    } catch (err) {
      console.error('Failed to connect:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [selectedVoice]);

  const startSession = async () => {
    setError(null);
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      await connect();
    }

    // Start audio recording
    if (!audioRecorderRef.current) {
      audioRecorderRef.current = new AudioRecorder((base64Data) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Data
          }));
        }
      });
    }

    try {
      await audioRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      setError('Failed to start microphone');
      console.error(err);
    }
  };

  const stopSession = () => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsRecording(false);
    setIsConnected(false);
    setCurrentDelta('');
    setCurrentAssistantDelta('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        isRecording,
        startSession,
        stopSession,
        transcriptionItems,
        currentDelta,
        assistantResponses,
        currentAssistantDelta,
        error,
        selectedVoice,
        setSelectedVoice,
        VOICES,
        isAssistantSpeaking,
        isAudioPaused,
        interruptAudio,
        pauseAudio,
        resumeAudio
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
