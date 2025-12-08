'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { VRMExpression } from '@/lib/faceUtils';

interface HandCursorState {
  x: number;
  y: number;
  isClicking: boolean;
  isDetected: boolean;
}

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
  // Hand tracking state - dual hand support
  leftHand: HandCursorState;
  rightHand: HandCursorState;
  // Blink state
  blinkLeft: number;
  blinkRight: number;
  // Expression state
  currentExpression: VRMExpression;
  expressionIntensity: number;
  expressionDuration: number;
  // Performance stats
  fps: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
}

interface FaceTrackingContextType extends FaceTrackingState {
  setRotation: (yaw: number, pitch: number, roll: number) => void;
  setPosition: (x: number, y: number, z: number) => void;
  setIsDetecting: (isDetecting: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setPermissionDenied: (denied: boolean) => void;
  setShowDebug: (show: boolean) => void;
  // Hand tracking setters - dual hand support
  setLeftHandState: (state: Partial<HandCursorState>) => void;
  setRightHandState: (state: Partial<HandCursorState>) => void;
  setBlinkValues: (left: number, right: number) => void;
  // Expression control
  setExpression: (expression: VRMExpression, intensity: number, duration: number) => void;
  resetExpression: () => void;
  // Performance setters
  setFpsStats: (fps: number, avg: number, min: number, max: number) => void;
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
  
  // Hand tracking state - dual hand support
  const [leftHand, setLeftHand] = useState<HandCursorState>({
    x: 0,
    y: 0,
    isClicking: false,
    isDetected: false
  });
  
  const [rightHand, setRightHand] = useState<HandCursorState>({
    x: 0,
    y: 0,
    isClicking: false,
    isDetected: false
  });
  
  // Blink state
  const [blinkLeft, setBlinkLeft] = useState(0);
  const [blinkRight, setBlinkRight] = useState(0);
  
  // Expression state
  const [currentExpression, setCurrentExpressionState] = useState<VRMExpression>('neutral');
  const [expressionIntensity, setExpressionIntensity] = useState(0);
  const [expressionDuration, setExpressionDuration] = useState(0);
  
  // Performance state
  const [fps, setFps] = useState(0);
  const [avgFps, setAvgFps] = useState(0);
  const [minFps, setMinFps] = useState(0);
  const [maxFps, setMaxFps] = useState(0);
  
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

  const setLeftHandState = (state: Partial<HandCursorState>) => {
    setLeftHand(prev => ({ ...prev, ...state }));
  };

  const setRightHandState = (state: Partial<HandCursorState>) => {
    setRightHand(prev => ({ ...prev, ...state }));
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

  const setFpsStats = (newFps: number, newAvg: number, newMin: number, newMax: number) => {
    setFps(newFps);
    setAvgFps(newAvg);
    setMinFps(newMin);
    setMaxFps(newMax);
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
        leftHand,
        rightHand,
        blinkLeft,
        blinkRight,
        currentExpression,
        expressionIntensity,
        expressionDuration,
        fps,
        avgFps,
        minFps,
        maxFps,
        setRotation,
        setPosition,
        setIsDetecting,
        setIsLoading,
        setError,
        setPermissionDenied,
        setShowDebug,
        setLeftHandState,
        setRightHandState,
        setBlinkValues,
        setExpression,
        resetExpression,
        setFpsStats,
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
