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
export function detectPinch(landmarks: NormalizedLandmark[], threshold: number = 0.04): boolean {
  // Thumb tip is landmark 4
  // Index finger tip is landmark 8
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  
  const distance = calculateLandmarkDistance(thumbTip, indexTip);
  
  return distance < threshold;
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
