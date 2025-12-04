'use client'

import React, { useEffect, useRef } from 'react';
import { useFaceTracking } from '@/contexts/FaceTrackingContext';

export default function VirtualCursor() {
  const { cursorX, cursorY, isClicking, isHandDetected } = useFaceTracking();
  const cursorRef = useRef<HTMLDivElement>(null);
  const clickSoundRef = useRef<number>(0);

  // Update cursor position
  useEffect(() => {
    if (cursorRef.current && isHandDetected) {
      cursorRef.current.style.left = `${cursorX}px`;
      cursorRef.current.style.top = `${cursorY}px`;
    }
  }, [cursorX, cursorY, isHandDetected]);

  // Handle click events
  useEffect(() => {
    if (!isHandDetected) return;

    if (isClicking) {
      // Simulate mouse click at cursor position
      const element = document.elementFromPoint(cursorX, cursorY);
      if (element && element instanceof HTMLElement) {
        // Prevent multiple rapid clicks
        const now = Date.now();
        if (now - clickSoundRef.current > 300) {
          clickSoundRef.current = now;
          
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
  }, [isClicking, cursorX, cursorY, isHandDetected]);

  if (!isHandDetected) return null;

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
          isClicking 
            ? 'border-pink-500 bg-pink-500/30' 
            : 'border-cyan-500 bg-cyan-500/20'
        } shadow-lg transition-colors`}
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
    </div>
  );
}
