'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface FaceTrackingState {
  yaw: number;
  pitch: number;
  roll: number;
  isDetecting: boolean;
  isLoading: boolean;
  error: string | null;
  permissionDenied: boolean;
  showDebug: boolean;
}

interface FaceTrackingContextType extends FaceTrackingState {
  setRotation: (yaw: number, pitch: number, roll: number) => void;
  setIsDetecting: (isDetecting: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setPermissionDenied: (denied: boolean) => void;
  setShowDebug: (show: boolean) => void;
}

const FaceTrackingContext = createContext<FaceTrackingContextType | undefined>(undefined);

export function FaceTrackingProvider({ children }: { children: ReactNode }) {
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  // Initialize debug state from localStorage if available
  const [showDebug, setShowDebugState] = useState(false);

  const setRotation = (newYaw: number, newPitch: number, newRoll: number) => {
    setYaw(newYaw);
    setPitch(newPitch);
    setRoll(newRoll);
  };

  const setShowDebug = (show: boolean) => {
    setShowDebugState(show);
    if (typeof window !== 'undefined') {
      localStorage.setItem('showDebugPanel', show ? 'true' : 'false');
    }
  };

  // Load initial debug state
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showDebugPanel');
      if (saved === 'true') setShowDebugState(true);
    }
  }, []);

  return (
    <FaceTrackingContext.Provider
      value={{
        yaw,
        pitch,
        roll,
        isDetecting,
        isLoading,
        error,
        permissionDenied,
        showDebug,
        setRotation,
        setIsDetecting,
        setIsLoading,
        setError,
        setPermissionDenied,
        setShowDebug,
      }}
    >
      {children}
    </FaceTrackingContext.Provider>
  );
}

export function useFaceTracking() {
  const context = useContext(FaceTrackingContext);
  if (context === undefined) {
    throw new Error('useFaceTracking must be used within a FaceTrackingProvider');
  }
  return context;
}
