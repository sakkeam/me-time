'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { VRMExpression } from '@/lib/faceUtils';

interface FaceTrackingState {
  yaw: number;
  pitch: number;
  roll: number;
  x: number;
  y: number;
  z: number;
  isDetecting: boolean;
  isLoading: boolean;
  error: string | null;
  permissionDenied: boolean;
  showDebug: boolean;
  // Hand tracking state
  cursorX: number;
  cursorY: number;
  isClicking: boolean;
  isHandDetected: boolean;
  // Blink state
  blinkLeft: number;
  blinkRight: number;
  // Expression state
  currentExpression: VRMExpression;
  expressionIntensity: number;
  expressionDuration: number;
}

interface FaceTrackingContextType extends FaceTrackingState {
  setRotation: (yaw: number, pitch: number, roll: number) => void;
  setPosition: (x: number, y: number, z: number) => void;
  setIsDetecting: (isDetecting: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setPermissionDenied: (denied: boolean) => void;
  setShowDebug: (show: boolean) => void;
  // Hand tracking setters
  setCursorPosition: (x: number, y: number) => void;
  setIsClicking: (clicking: boolean) => void;
  setIsHandDetected: (detected: boolean) => void;
  setBlinkValues: (left: number, right: number) => void;
  // Expression control
  setExpression: (expression: VRMExpression, intensity: number, duration: number) => void;
  resetExpression: () => void;
}

const FaceTrackingContext = createContext<FaceTrackingContextType | undefined>(undefined);

export function FaceTrackingProvider({ children }: { children: ReactNode }) {
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [z, setZ] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  // Hand tracking state
  const [cursorX, setCursorX] = useState(0);
  const [cursorY, setCursorY] = useState(0);
  const [isClicking, setIsClicking] = useState(false);
  const [isHandDetected, setIsHandDetected] = useState(false);
  
  // Blink state
  const [blinkLeft, setBlinkLeft] = useState(0);
  const [blinkRight, setBlinkRight] = useState(0);
  
  // Expression state
  const [currentExpression, setCurrentExpressionState] = useState<VRMExpression>('neutral');
  const [expressionIntensity, setExpressionIntensity] = useState(0);
  const [expressionDuration, setExpressionDuration] = useState(0);
  
  // Initialize debug state from localStorage if available
  const [showDebug, setShowDebugState] = useState(false);

  const setRotation = (newYaw: number, newPitch: number, newRoll: number) => {
    setYaw(newYaw);
    setPitch(newPitch);
    setRoll(newRoll);
  };

  const setPosition = (newX: number, newY: number, newZ: number) => {
    setX(newX);
    setY(newY);
    setZ(newZ);
  };

  const setCursorPosition = (newX: number, newY: number) => {
    setCursorX(newX);
    setCursorY(newY);
  };

  const setBlinkValues = (left: number, right: number) => {
    setBlinkLeft(left);
    setBlinkRight(right);
  };

  const setExpression = (expression: VRMExpression, intensity: number, duration: number) => {
    setCurrentExpressionState(expression);
    setExpressionIntensity(intensity);
    setExpressionDuration(duration);
  };
  
  const resetExpression = () => {
    setCurrentExpressionState('neutral');
    setExpressionIntensity(0);
    setExpressionDuration(0);
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
        x,
        y,
        z,
        isDetecting,
        isLoading,
        error,
        permissionDenied,
        showDebug,
        cursorX,
        cursorY,
        isClicking,
        isHandDetected,
        blinkLeft,
        blinkRight,
        currentExpression,
        expressionIntensity,
        expressionDuration,
        setRotation,
        setPosition,
        setIsDetecting,
        setIsLoading,
        setError,
        setPermissionDenied,
        setShowDebug,
        setCursorPosition,
        setIsClicking,
        setIsHandDetected,
        setBlinkValues,
        setExpression,
        resetExpression,
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
