"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { ANIMATION_REGISTRY } from "@/lib/animations";

export { ANIMATION_REGISTRY };
export type { AnimationDefinition, AnimationCategory } from "@/lib/animations";

interface AnimationContextType {
  currentAnimation: string;
  playAnimation: (name: string) => void;
  stopAnimation: () => void;
  isPlaying: boolean;
}

const AnimationContext = createContext<AnimationContextType | undefined>(undefined);

export function AnimationProvider({ children }: { children: ReactNode }) {
  const [currentAnimation, setCurrentAnimation] = useState<string>("idle");
  const [isPlaying, setIsPlaying] = useState(false);

  const playAnimation = useCallback((name: string) => {
    if (ANIMATION_REGISTRY[name]) {
      console.log(`Playing animation: ${name}`);
      setCurrentAnimation(name);
      setIsPlaying(name !== "idle");
    } else {
      console.warn(`Animation not found: ${name}`);
    }
  }, []);

  const stopAnimation = useCallback(() => {
    setCurrentAnimation("idle");
    setIsPlaying(false);
  }, []);

  return (
    <AnimationContext.Provider value={{ currentAnimation, playAnimation, stopAnimation, isPlaying }}>
      {children}
    </AnimationContext.Provider>
  );
}

export function useAnimation() {
  const context = useContext(AnimationContext);
  if (context === undefined) {
    throw new Error("useAnimation must be used within an AnimationProvider");
  }
  return context;
}
