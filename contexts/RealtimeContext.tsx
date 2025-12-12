'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AudioRecorder, AudioPlayer, parseWAVFile, chunkPCMData, arrayBufferToBase64 } from '@/lib/audioUtils';
import { useAnimation, ANIMATION_REGISTRY } from '@/contexts/AnimationContext';
import { useFaceTracking } from '@/contexts/FaceTrackingContext';

export type TTSProvider = 'openai' | 'aivisspeech';

export interface AivisSpeaker {
  name: string;
  speaker_uuid: string;
  styles: {
    name: string;
    id: number;
  }[];
  version: string;
}

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
  mouthOpenAmount: number;
  provider: TTSProvider;
  setProvider: (provider: TTSProvider) => void;
  aivisSpeaker: number;
  setAivisSpeaker: (styleId: number) => void;
  aivisSpeakersList: AivisSpeaker[];
  isAivisSpeechAvailable: boolean;
  isSynthesizing: boolean;
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
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [mouthOpenAmount, setMouthOpenAmount] = useState(0);
  
  const [provider, setProviderState] = useState<TTSProvider>('openai');
  const [aivisSpeaker, setAivisSpeakerState] = useState<number>(888753760); // Default style ID
  const [aivisSpeakersList, setAivisSpeakersList] = useState<AivisSpeaker[]>([]);
  const [isAivisSpeechAvailable, setIsAivisSpeechAvailable] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  
  const isAssistantSpeaking = isAudioPlaying || isSynthesizing;

  const wsRef = useRef<WebSocket | null>(null);
  const aivisSpeakerRef = useRef(aivisSpeaker);

  useEffect(() => {
    aivisSpeakerRef.current = aivisSpeaker;
  }, [aivisSpeaker]);

  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const currentItemIdRef = useRef<string | null>(null);
  const currentResponseIdRef = useRef<string | null>(null);

  const { playAnimation } = useAnimation();
  const { setExpression } = useFaceTracking();

  // Initialize audio player
  useEffect(() => {
    audioPlayerRef.current = new AudioPlayer((isPlaying) => {
      setIsAudioPlaying(isPlaying);
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

  // Fetch AivisSpeech speakers
  useEffect(() => {
    fetch('/api/aivisspeech-speakers')
      .then(res => res.json())
      .then(data => {
        if (data.speakers && data.speakers.length > 0) {
          setAivisSpeakersList(data.speakers);
          setIsAivisSpeechAvailable(true);
        } else {
          setIsAivisSpeechAvailable(false);
        }
      })
      .catch(err => {
        console.error('Failed to fetch AivisSpeech speakers:', err);
        setIsAivisSpeechAvailable(false);
      });
  }, []);

  // Load saved provider and speaker
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedProvider = localStorage.getItem('ttsProvider') as TTSProvider;
      if (savedProvider === 'openai' || savedProvider === 'aivisspeech') {
        setProviderState(savedProvider);
      }
      const savedSpeaker = localStorage.getItem('aivisSpeaker');
      if (savedSpeaker) {
        setAivisSpeakerState(parseInt(savedSpeaker, 10));
      }
    }
  }, []);

  const setProvider = useCallback((newProvider: TTSProvider) => {
    setProviderState(newProvider);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ttsProvider', newProvider);
    }
    // Update session if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
       wsRef.current.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: newProvider === 'openai' ? ['text', 'audio'] : ['text'],
        }
      }));
    }
  }, []);

  const setAivisSpeaker = useCallback((styleId: number) => {
    setAivisSpeakerState(styleId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('aivisSpeaker', styleId.toString());
    }
  }, []);

  const synthesizeAndPlay = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    setIsSynthesizing(true);
    try {
      const res = await fetch('/api/aivisspeech-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, styleId: aivisSpeakerRef.current })
      });
      
      if (!res.ok) throw new Error('TTS failed');
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      const { pcmData, sampleRate } = parseWAVFile(data.audio);
      const chunks = chunkPCMData(pcmData, 150, sampleRate);
      
      for (const chunk of chunks) {
        const base64Chunk = arrayBufferToBase64(chunk);
        await audioPlayerRef.current?.play(base64Chunk);
      }
    } catch (err) {
      console.error('Synthesis error:', err);
      setError('TTS Synthesis failed');
    } finally {
      setIsSynthesizing(false);
    }
  }, []);

  // Add effect to update mouth open amount based on audio volume
  useEffect(() => {
    if (!isAssistantSpeaking || isAudioPaused) {
      setMouthOpenAmount(0);
      return;
    }

    const intervalId = setInterval(() => {
      if (audioPlayerRef.current) {
        const volume = audioPlayerRef.current.getVolume();
        setMouthOpenAmount(volume);
      }
    }, 1000 / 30); // Update at 30fps

    return () => clearInterval(intervalId);
  }, [isAssistantSpeaking, isAudioPaused]);

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
        
        // Prepare tool definition
        const animationNames = Object.keys(ANIMATION_REGISTRY);
        const animationDescriptions = Object.values(ANIMATION_REGISTRY)
          .map(a => `- ${a.name} (${a.category}): ${a.description} [Tags: ${a.tags.join(", ")}]`)
          .join("\n");

        // Configure session with tools
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: provider === 'openai' ? ['text', 'audio'] : ['text'],
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
            },
            tools: [
              {
                type: "function",
                name: "play_animation",
                description: `Play a VRM animation on the avatar. Choose the most appropriate animation based on the emotion and intent of the conversation.
Available animations:
${animationDescriptions}`,
                parameters: {
                  type: "object",
                  properties: {
                    animation: { 
                      type: "string", 
                      enum: animationNames,
                      description: "The name of the animation to play" 
                    },
                    reason: { 
                      type: "string",
                      description: "The reason for choosing this animation based on the context"
                    }
                  },
                  required: ["animation", "reason"]
                }
              },
              {
                type: "function",
                name: "set_expression",
                description: `Set a facial expression on the avatar with specified intensity and duration. Choose expressions that match the emotional tone of the conversation. The expression will automatically return to neutral after the duration expires.

Available expressions:
- neutral: Default calm expression
- happy: Smile, joy, excitement
- sad: Sadness, disappointment
- angry: Anger, frustration, annoyance
- relaxed: Calm, content, peaceful
- surprised: Shock, amazement, curiosity`,
                parameters: {
                  type: "object",
                  properties: {
                    expression: {
                      type: "string",
                      enum: ["neutral", "happy", "sad", "angry", "relaxed", "surprised"],
                      description: "The facial expression to display"
                    },
                    intensity: {
                      type: "number",
                      minimum: 0.0,
                      maximum: 1.0,
                      description: "Expression strength from 0.0 (subtle) to 1.0 (strong). Default 0.7"
                    },
                    duration_seconds: {
                      type: "number",
                      minimum: 0.5,
                      maximum: 30.0,
                      description: "How long to hold the expression before returning to neutral. Default 3.0 seconds"
                    }
                  },
                  required: ["expression"]
                }
              }
            ],
            tool_choice: "auto"
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

          case 'response.text.delta':
            setCurrentAssistantDelta(prev => prev + message.delta);
            if (!currentResponseIdRef.current) {
              currentResponseIdRef.current = message.response_id;
            }
            break;

          case 'response.text.done':
            const text = message.text;
            if (text) {
              setAssistantResponses(prev => [
                ...prev,
                {
                  id: message.response_id,
                  text: text,
                  timestamp: Date.now()
                }
              ]);
              setCurrentAssistantDelta('');
              
              if (provider === 'aivisspeech') {
                synthesizeAndPlay(text);
              }
            }
            break;

          case 'response.audio.delta':
            if (provider === 'openai') {
              audioPlayerRef.current?.play(message.delta);
            }
            break;

          case 'response.audio.done':
            // Handled by AudioPlayer state change
            break;

          case 'response.function_call_arguments.done':
            // Handle tool call
            try {
              const args = JSON.parse(message.arguments);
              if (message.name === 'play_animation') {
                console.log(`Realtime API triggered animation: ${args.animation} (${args.reason})`);
                playAnimation(args.animation);
                
                // Send function output back to server
                ws.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: message.call_id,
                    output: JSON.stringify({ success: true, animation: args.animation })
                  }
                }));
                
                // Trigger another response if needed (usually the model continues after tool use)
                ws.send(JSON.stringify({
                  type: 'response.create'
                }));
              } else if (message.name === 'set_expression') {
                console.log(`Realtime API triggered expression: ${args.expression} (intensity: ${args.intensity ?? 0.7}, duration: ${args.duration_seconds ?? 3.0}s)`);
                setExpression(
                  args.expression,
                  args.intensity ?? 0.7,
                  args.duration_seconds ?? 3.0
                );
                
                // Send function output back to server
                ws.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: message.call_id,
                    output: JSON.stringify({ 
                      success: true, 
                      expression: args.expression,
                      intensity: args.intensity ?? 0.7,
                      duration: args.duration_seconds ?? 3.0
                    })
                  }
                }));
                
                // Trigger another response
                ws.send(JSON.stringify({
                  type: 'response.create'
                }));
              }
            } catch (e) {
              console.error('Failed to parse function arguments:', e);
            }
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
  }, [selectedVoice, playAnimation, setExpression, provider, synthesizeAndPlay]);

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
        resumeAudio,
        mouthOpenAmount,
        provider,
        setProvider,
        aivisSpeaker,
        setAivisSpeaker,
        aivisSpeakersList,
        isAivisSpeechAvailable,
        isSynthesizing
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
