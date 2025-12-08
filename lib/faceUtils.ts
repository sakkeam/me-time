import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

// Types
export interface FaceRotation {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface FacePosition {
  x: number;
  y: number;
  z: number;
}

export interface HandCursorPosition {
  x: number;
  y: number;
}

/**
 * Calculate face rotation (yaw, pitch, roll) from MediaPipe landmarks
 * Using specific landmarks for better stability
 */
export function calculateFaceRotation(landmarks: NormalizedLandmark[]): FaceRotation {
  // Key landmarks for face orientation
  // 1: Nose tip
  // 263: Right eye outer corner
  // 33: Left eye outer corner
  // 152: Chin
  // 10: Top of head
  
  const nose = landmarks[1];
  const rightEye = landmarks[263];
  const leftEye = landmarks[33];
  const chin = landmarks[152];
  const headTop = landmarks[10];

  // Calculate Yaw (Left/Right rotation)
  // Compare nose x position relative to eyes center
  const eyesCenterX = (leftEye.x + rightEye.x) / 2;
  const eyesWidth = Math.abs(rightEye.x - leftEye.x);
  
  // Normalized yaw: -1 (left) to 1 (right)
  // Multiplied by a factor to convert to radians (approximate)
  const yaw = (nose.x - eyesCenterX) / eyesWidth * 2.5;

  // Calculate Pitch (Up/Down rotation)
  // Compare nose y position relative to face height center
  const faceCenterY = (headTop.y + chin.y) / 2;
  const faceHeight = Math.abs(chin.y - headTop.y);
  
  // Normalized pitch: -1 (up) to 1 (down)
  // Multiplied by a factor to convert to radians
  const pitch = (nose.y - faceCenterY) / faceHeight * 2.5;

  // Calculate Roll (Tilt)
  // Angle between eyes
  const dy = rightEye.y - leftEye.y;
  const dx = rightEye.x - leftEye.x;
  const roll = Math.atan2(dy, dx);

  return { yaw, pitch, roll };
}

/**
 * Calculate face position (x, y, z) from MediaPipe landmarks
 * Returns normalized coordinates (-1 to 1)
 */
export function calculateFacePosition(landmarks: NormalizedLandmark[]): FacePosition {
  const nose = landmarks[1];
  const rightEye = landmarks[263];
  const leftEye = landmarks[33];

  // X: -1 (left) to 1 (right)
  // Invert X because webcam is mirrored usually, but let's keep it raw here
  // and handle mirroring in the camera logic if needed.
  // Actually, if I move right in the frame, x increases.
  const x = (nose.x - 0.5) * 2;

  // Y: -1 (top) to 1 (bottom)
  const y = (nose.y - 0.5) * 2;

  // Z: Estimate depth based on eye distance
  // Closer = larger distance = smaller Z value (closer to camera)
  // Farther = smaller distance = larger Z value
  const eyeDistance = Math.sqrt(
    Math.pow(rightEye.x - leftEye.x, 2) + 
    Math.pow(rightEye.y - leftEye.y, 2)
  );
  
  // Normalize Z around 0. 
  // Typical eye distance at "normal" distance might be around 0.15?
  // Let's say 0.15 is "0", larger is negative (closer), smaller is positive (farther)
  const z = (0.15 - eyeDistance) * 5;

  return { x, y, z };
}

/**
 * Calculate cursor position from hand landmarks
 * Uses index finger tip (landmark 8) for cursor position
 * Returns screen coordinates (0 to window dimensions)
 */
export function calculateCursorPosition(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number
): HandCursorPosition {
  // Index finger tip is landmark 8
  const indexFingerTip = landmarks[8];
  
  // Convert from normalized coordinates to screen coordinates
  // Mirror X axis for natural interaction (webcam is mirrored)
  const screenX = (1 - indexFingerTip.x) * window.innerWidth;
  const screenY = indexFingerTip.y * window.innerHeight;
  
  return { x: screenX, y: screenY };
}

/**
 * Calculate a stable cursor position that doesn't move when pinching.
 * Uses the Wrist (0) and Index MCP (5) to project a virtual finger tip.
 */
export function calculateStableCursorPosition(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number
): HandCursorPosition {
  const wrist = landmarks[0];
  const indexMCP = landmarks[5];

  // Calculate vector from wrist to MCP
  // This gives us the direction the hand is pointing
  const directionX = indexMCP.x - wrist.x;
  const directionY = indexMCP.y - wrist.y;

  // Project outwards from the MCP to simulate a "stiff" finger tip
  // A scale of ~1.5 approximates the length of the finger
  const projectionScale = 1.5; 
  
  const virtualTipX = indexMCP.x + (directionX * projectionScale);
  const virtualTipY = indexMCP.y + (directionY * projectionScale);

  // Convert to screen coordinates (mirroring X)
  const screenX = (1 - virtualTipX) * window.innerWidth;
  const screenY = virtualTipY * window.innerHeight;

  return { x: screenX, y: screenY };
}

/**
 * Calculate distance between two landmarks (for pinch detection)
 * Returns normalized distance
 */
export function calculateLandmarkDistance(
  landmark1: NormalizedLandmark,
  landmark2: NormalizedLandmark
): number {
  return Math.sqrt(
    Math.pow(landmark1.x - landmark2.x, 2) +
    Math.pow(landmark1.y - landmark2.y, 2) +
    Math.pow(landmark1.z - landmark2.z, 2)
  );
}

/**
 * Detect pinch gesture (thumb tip to index finger tip)
 * Returns true if pinching
 */
export function detectPinch(landmarks: NormalizedLandmark[], threshold: number = 0.08): boolean {
  // Thumb tip is landmark 4
  // Index finger tip is landmark 8
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  
  const distance = calculateLandmarkDistance(thumbTip, indexTip);
  
  return distance < threshold;
}

/**
 * Detect long pinch gesture (pinch held for a certain duration)
 * Returns true if pinch has been held for the specified duration
 */
export function detectLongPinch(
  landmarks: NormalizedLandmark[],
  pinchStartTime: number | null,
  currentTime: number,
  threshold: number = 0.08,
  duration: number = 0.5
): { isLongPinch: boolean; pinchDuration: number } {
  const isPinching = detectPinch(landmarks, threshold);
  
  if (!isPinching) {
    return { isLongPinch: false, pinchDuration: 0 };
  }
  
  if (pinchStartTime === null) {
    return { isLongPinch: false, pinchDuration: 0 };
  }
  
  const elapsed = (currentTime - pinchStartTime) / 1000; // Convert to seconds
  const isLongPinch = elapsed >= duration;
  
  return { isLongPinch, pinchDuration: elapsed };
}

/**
 * Extract hand depth (Z-axis proxy) from landmarks
 * Uses hand size (distance between wrist and middle finger MCP) as a proxy for depth
 * Returns smoothed depth value and normalized depth
 */
export function extractHandDepth(
  landmarks: NormalizedLandmark[],
  referenceDepth: number = 0
): { depth: number; normalizedDepth: number } {
  // Use Wrist (0) and Middle Finger MCP (9) distance as a proxy for hand size/depth
  // When hand is closer to camera, this distance increases
  const wrist = landmarks[0];
  const middleMCP = landmarks[9];
  
  // Calculate 2D Euclidean distance
  // We ignore Z here because we want the apparent size on screen
  const size = Math.sqrt(
    Math.pow(wrist.x - middleMCP.x, 2) + 
    Math.pow(wrist.y - middleMCP.y, 2)
  );
  
  // Normalize depth relative to reference (initial pinch position)
  // Positive normalizedDepth = Hand is larger (Closer)
  // Negative normalizedDepth = Hand is smaller (Farther)
  const normalizedDepth = size - referenceDepth;
  
  return { depth: size, normalizedDepth };
}

/**
 * Smooth depth value using exponential moving average
 */
export function smoothDepth(
  current: number,
  target: number,
  smoothingFactor: number = 0.1
): number {
  return lerp(current, target, smoothingFactor);
}

/**
 * Smooth cursor movement using exponential moving average
 */
export function smoothCursorPosition(
  current: HandCursorPosition,
  target: HandCursorPosition,
  smoothingFactor: number = 0.3
): HandCursorPosition {
  return {
    x: lerp(current.x, target.x, smoothingFactor),
    y: lerp(current.y, target.y, smoothingFactor)
  };
}

/**
 * Clamp rotation values to prevent extreme camera angles
 */
export function clampRotation(rotation: FaceRotation): FaceRotation {
  const MAX_YAW = 45 * (Math.PI / 180);   // 45 degrees
  const MAX_PITCH = 30 * (Math.PI / 180); // 30 degrees

  return {
    yaw: Math.max(-MAX_YAW, Math.min(MAX_YAW, rotation.yaw)),
    pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, rotation.pitch)),
    roll: rotation.roll // Roll is usually not clamped or used for camera orbit
  };
}

/**
 * Convert spherical coordinates (yaw, pitch) to Cartesian coordinates (x, y, z)
 * for camera position orbiting around a target, with positional offset
 */
export function getCameraPosition(
  yaw: number, 
  pitch: number, 
  radius: number, 
  center: [number, number, number],
  offset: { x: number, y: number, z: number } = { x: 0, y: 0, z: 0 }
): [number, number, number] {
  // Invert yaw to mirror movement (natural feel)
  const targetYaw = -yaw;
  const targetPitch = pitch;

  // Calculate position on sphere
  const sphereX = radius * Math.sin(targetYaw) * Math.cos(targetPitch);
  const sphereY = radius * Math.sin(targetPitch);
  const sphereZ = radius * Math.cos(targetYaw) * Math.cos(targetPitch);

  // Apply positional offset (parallax effect)
  // If user moves right (positive x), camera should move right (positive x)
  // If user moves up (negative y in screen space, but let's check), camera moves up
  // Scale the offset to be reasonable
  const offsetX = offset.x * 0.5; // Scale factor
  const offsetY = -offset.y * 0.5; // Invert Y because screen Y is top-down
  const offsetZ = offset.z * 0.5;

  return [
    sphereX + center[0] + offsetX, 
    sphereY + center[1] + offsetY, 
    sphereZ + center[2] + offsetZ
  ];
}

/**
 * Linear interpolation for smooth movement
 */
export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

/**
 * Automatic blinking system with natural randomness
 */
export class AutoBlink {
  private leftBlinkState: number = 0;
  private rightBlinkState: number = 0;
  private timer: number = 0;
  private nextBlinkTime: number;
  
  // Blink execution state
  private isBlinking: boolean = false;
  private blinkStartTime: number = 0;
  private leftDelay: number = 0;
  private rightDelay: number = 0;
  
  // Configuration
  private readonly BLINK_DURATION = 0.15; // seconds (150ms)
  private readonly MIN_INTERVAL = 3.0; // seconds
  private readonly MAX_INTERVAL = 5.0; // seconds
  private readonly LEFT_RIGHT_DELAY_MAX = 0.02; // Reduced to 20ms for tighter sync
  
  constructor() {
    this.nextBlinkTime = this.getRandomBlinkInterval();
  }
  
  /**
   * Get random interval between blinks
   */
  private getRandomBlinkInterval(): number {
    return this.MIN_INTERVAL + Math.random() * (this.MAX_INTERVAL - this.MIN_INTERVAL);
  }
  
  /**
   * Easing function for natural blink motion (ease-in-out)
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  /**
   * Calculate blink value at given time in blink cycle
   */
  private calculateBlinkValue(elapsedTime: number): number {
    if (elapsedTime < 0) return 0;
    
    const progress = Math.min(elapsedTime / this.BLINK_DURATION, 1.0);
    
    // Blink goes: 0 -> 1 -> 0 (close -> open)
    const easedProgress = this.easeInOutCubic(progress);
    
    if (progress < 0.5) {
      // Closing phase (0 -> 1)
      return easedProgress * 2;
    } else {
      // Opening phase (1 -> 0)
      return 1 - (easedProgress - 0.5) * 2;
    }
  }
  
  /**
   * Update blink state (call every frame)
   * @param delta Time elapsed since last frame in seconds
   */
  public update(delta: number): void {
    this.timer += delta;
    
    if (!this.isBlinking) {
      if (this.timer >= this.nextBlinkTime) {
        // Start blinking sequence
        this.isBlinking = true;
        this.blinkStartTime = this.timer;
        
        // Determine slight offset for each eye
        const delay = (Math.random() - 0.5) * this.LEFT_RIGHT_DELAY_MAX;
        if (delay > 0) {
            this.leftDelay = 0;
            this.rightDelay = delay;
        } else {
            this.leftDelay = -delay;
            this.rightDelay = 0;
        }
      }
    } else {
      // Currently blinking
      const timeSinceStart = this.timer - this.blinkStartTime;
      
      // Calculate for left eye
      const leftElapsed = timeSinceStart - this.leftDelay;
      if (leftElapsed >= 0 && leftElapsed < this.BLINK_DURATION) {
        this.leftBlinkState = this.calculateBlinkValue(leftElapsed);
      } else if (leftElapsed >= this.BLINK_DURATION) {
        this.leftBlinkState = 0;
      } else {
        this.leftBlinkState = 0;
      }
      
      // Calculate for right eye
      const rightElapsed = timeSinceStart - this.rightDelay;
      if (rightElapsed >= 0 && rightElapsed < this.BLINK_DURATION) {
        this.rightBlinkState = this.calculateBlinkValue(rightElapsed);
      } else if (rightElapsed >= this.BLINK_DURATION) {
        this.rightBlinkState = 0;
      } else {
        this.rightBlinkState = 0;
      }
      
      // Check if both finished
      const maxDelay = Math.max(this.leftDelay, this.rightDelay);
      if (timeSinceStart >= this.BLINK_DURATION + maxDelay) {
        this.isBlinking = false;
        this.leftBlinkState = 0;
        this.rightBlinkState = 0;
        this.nextBlinkTime = this.timer + this.getRandomBlinkInterval();
      }
    }
  }
  
  /**
   * Get current blink values for both eyes
   */
  public getBlinkValues(): { left: number; right: number } {
    return {
      left: this.leftBlinkState,
      right: this.rightBlinkState
    };
  }
  
  /**
   * Reset timers (useful when starting/stopping)
   */
  public reset(): void {
    this.leftBlinkState = 0;
    this.rightBlinkState = 0;
    this.timer = 0;
    this.nextBlinkTime = this.getRandomBlinkInterval();
    this.isBlinking = false;
  }
}

/**
 * VRM Expression presets
 */
export type VRMExpression = 'neutral' | 'happy' | 'sad' | 'angry' | 'relaxed' | 'surprised';

export interface ExpressionState {
  expression: VRMExpression;
  intensity: number;
  duration: number;
}

/**
 * Manages VRM facial expressions with smooth transitions and auto-reset
 */
export class ExpressionManager {
  private currentExpression: VRMExpression = 'neutral';
  private targetExpression: VRMExpression = 'neutral';
  private currentIntensity: number = 0;
  private targetIntensity: number = 0;
  private transitionProgress: number = 1.0; // 1.0 = completed
  private timer: number = 0;
  private duration: number = 0;
  private isActive: boolean = false;
  
  // Smooth transition speed
  private readonly TRANSITION_SPEED = 3.0; // How fast to transition (higher = faster)
  
  // Expression blend values for each VRM expression
  private expressionValues: Record<VRMExpression, number> = {
    neutral: 1.0,
    happy: 0,
    sad: 0,
    angry: 0,
    relaxed: 0,
    surprised: 0
  };
  
  /**
   * Set a new expression with intensity and duration
   * @param expression Target expression
   * @param intensity Expression strength (0.0 to 1.0)
   * @param duration How long to hold the expression before returning to neutral (seconds)
   */
  public setExpression(expression: VRMExpression, intensity: number = 1.0, duration: number = 3.0): void {
    this.targetExpression = expression;
    this.targetIntensity = Math.max(0, Math.min(1, intensity)); // Clamp 0-1
    this.duration = duration;
    this.timer = 0;
    this.transitionProgress = 0;
    this.isActive = true;
  }
  
  /**
   * Immediately reset to neutral
   */
  public reset(): void {
    this.setExpression('neutral', 0, 0);
  }
  
  /**
   * Update expression state (call every frame)
   * @param delta Time elapsed since last frame in seconds
   * @param isEmotionAnimationPlaying Whether an emotion-category animation is currently playing
   */
  public update(delta: number, isEmotionAnimationPlaying: boolean = false): void {
    if (!this.isActive) return;
    
    // Update transition progress
    if (this.transitionProgress < 1.0) {
      this.transitionProgress = Math.min(1.0, this.transitionProgress + delta * this.TRANSITION_SPEED);
      
      // Smooth interpolation using ease-out cubic
      const easedProgress = 1 - Math.pow(1 - this.transitionProgress, 3);
      
      // Interpolate expression change
      if (this.currentExpression !== this.targetExpression) {
        // Cross-fade: reduce current, increase target
        if (easedProgress > 0.5) {
          this.currentExpression = this.targetExpression;
        }
      }
      
      // Interpolate intensity
      this.currentIntensity = lerp(this.currentIntensity, this.targetIntensity, easedProgress);
    } else {
      // Transition complete, hold the expression
      this.currentIntensity = this.targetIntensity;
      this.currentExpression = this.targetExpression;
      
      // Update timer for auto-reset
      if (this.currentExpression !== 'neutral' && this.duration > 0) {
        this.timer += delta;
        
        if (this.timer >= this.duration) {
          // Auto-reset to neutral
          this.setExpression('neutral', 0, 0);
        }
      }
    }
    
    // Calculate expression blend values
    this.calculateExpressionValues(isEmotionAnimationPlaying);
  }
  
  /**
   * Calculate blend values for all expressions
   * @param isEmotionAnimationPlaying Reduce expression intensity if emotion animation is playing
   */
  private calculateExpressionValues(isEmotionAnimationPlaying: boolean): void {
    // Reset all to 0
    for (const key in this.expressionValues) {
      this.expressionValues[key as VRMExpression] = 0;
    }
    
    // Apply current expression with intensity
    let effectiveIntensity = this.currentIntensity;
    
    // Reduce expression intensity when emotion animations are playing
    if (isEmotionAnimationPlaying) {
      effectiveIntensity *= 0.3; // Reduce to 30%
    }
    
    if (this.currentExpression === 'neutral') {
      this.expressionValues.neutral = 1.0 - effectiveIntensity;
    } else {
      this.expressionValues[this.currentExpression] = effectiveIntensity;
      this.expressionValues.neutral = 1.0 - effectiveIntensity;
    }
  }
  
  /**
   * Get current expression values to apply to VRM
   */
  public getExpressionValues(): Record<VRMExpression, number> {
    return { ...this.expressionValues };
  }
  
  /**
   * Get current active expression and intensity (for debugging/UI)
   */
  public getCurrentState(): { expression: VRMExpression; intensity: number; timeRemaining: number } {
    return {
      expression: this.currentExpression,
      intensity: this.currentIntensity,
      timeRemaining: Math.max(0, this.duration - this.timer)
    };
  }
}
