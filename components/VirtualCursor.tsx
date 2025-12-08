'use client'

import React, { useEffect, useRef } from 'react';
import { useFaceTracking } from '@/contexts/FaceTrackingContext';

function SingleCursor({ 
  x, 
  y, 
  isClicking, 
  isDetected, 
  isLongPinch,
  color,
  handLabel 
}: { 
  x: number; 
  y: number; 
  isClicking: boolean; 
  isDetected: boolean;
  isLongPinch?: boolean;
  color: 'blue' | 'green';
  handLabel: string;
}) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const lastClickTimeRef = useRef<number>(0);

  // Update cursor position
  useEffect(() => {
    if (cursorRef.current && isDetected) {
      cursorRef.current.style.left = `${x}px`;
      cursorRef.current.style.top = `${y}px`;
    }
  }, [x, y, isDetected]);

  // Handle click events
  useEffect(() => {
    if (!isDetected) return;

    // Only click if it's a short pinch (not long pinch)
    if (isClicking && !isLongPinch) {
      // Simulate mouse click at cursor position
      const element = document.elementFromPoint(x, y);
      if (element && element instanceof HTMLElement) {
        // Prevent multiple rapid clicks
        const now = Date.now();
        if (now - lastClickTimeRef.current > 300) {
          lastClickTimeRef.current = now;
          
          // Trigger click event
          element.click();
          
          // Visual feedback
          if (cursorRef.current) {
            cursorRef.current.classList.add('clicking');
            setTimeout(() => {
              cursorRef.current?.classList.remove('clicking');
            }, 100);
          }
        }
      }
    }
  }, [isClicking, isLongPinch, x, y, isDetected]);

  if (!isDetected) return null;

  const colorClasses = {
    blue: {
      border: 'border-blue-500',
      bg: 'bg-blue-500/20',
      clickBorder: 'border-blue-600',
      clickBg: 'bg-blue-600/30',
      longPinchBorder: 'border-purple-500',
      longPinchBg: 'bg-purple-500/40'
    },
    green: {
      border: 'border-green-500',
      bg: 'bg-green-500/20',
      clickBorder: 'border-green-600',
      clickBg: 'bg-green-600/30',
      longPinchBorder: 'border-purple-500',
      longPinchBg: 'bg-purple-500/40'
    }
  };

  const colors = colorClasses[color];

  return (
    <div
      ref={cursorRef}
      className={`fixed pointer-events-none z-[9999] transition-transform ${
        isClicking ? 'scale-75' : 'scale-100'
      }`}
      style={{
        width: '24px',
        height: '24px',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className={`w-full h-full rounded-full border-4 ${
          isLongPinch
            ? `${colors.longPinchBorder} ${colors.longPinchBg}`
            : isClicking 
              ? `${colors.clickBorder} ${colors.clickBg}` 
              : `${colors.border} ${colors.bg}`
        } shadow-lg transition-colors`}
      />
      {isLongPinch && (
        <div className="absolute inset-0 rounded-full border-2 border-purple-400 animate-ping opacity-75" />
      )}
    </div>
  );
}

export default function VirtualCursor() {
  const { leftHand, rightHand } = useFaceTracking();

  return (
    <>
      <SingleCursor 
        x={leftHand.x} 
        y={leftHand.y} 
        isClicking={leftHand.isClicking}
        isDetected={leftHand.isDetected}
        isLongPinch={leftHand.isLongPinch}
        color="blue"
        handLabel="Left"
      />
      <SingleCursor 
        x={rightHand.x} 
        y={rightHand.y} 
        isClicking={rightHand.isClicking}
        isDetected={rightHand.isDetected}
        isLongPinch={rightHand.isLongPinch}
        color="green"
        handLabel="Right"
      />
      <style>{`
        .clicking {
          animation: clickPulse 0.1s ease-out;
        }
        @keyframes clickPulse {
          0% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(0.8); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  );
}
