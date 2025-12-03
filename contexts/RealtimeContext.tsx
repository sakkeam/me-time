'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AudioRecorder } from '@/lib/audioUtils';

interface RealtimeContextType {
  isConnected: boolean;
  isRecording: boolean;
  startSession: () => Promise<void>;
  stopSession: () => void;
  transcriptionItems: TranscriptionItem[];
  currentDelta: string;
  error: string | null;
}

interface TranscriptionItem {
  id: string;
  text: string;
  timestamp: number;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptionItems, setTranscriptionItems] = useState<TranscriptionItem[]>([]);
  const [currentDelta, setCurrentDelta] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const currentItemIdRef = useRef<string | null>(null);

  const connect = useCallback(async () => {
    try {
      // Get ephemeral token
      const tokenResponse = await fetch('/api/realtime-token', {
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
            
          case 'error':
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
  }, []);

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
        error
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
