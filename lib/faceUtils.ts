import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

// Types
export interface FaceRotation {
  yaw: number;
  pitch: number;
  roll: number;
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
 * for camera position orbiting around a target
 */
export function getCameraPosition(
  yaw: number, 
  pitch: number, 
  radius: number, 
  center: [number, number, number]
): [number, number, number] {
  // Invert yaw to mirror movement (natural feel)
  // or keep as is depending on preference. Let's try mirroring first.
  const targetYaw = -yaw;
  const targetPitch = pitch;

  // Calculate position on sphere
  // x = r * sin(yaw) * cos(pitch)
  // y = r * sin(pitch) + center_y
  // z = r * cos(yaw) * cos(pitch)
  
  const x = radius * Math.sin(targetYaw) * Math.cos(targetPitch);
  const y = radius * Math.sin(targetPitch) + center[1];
  const z = radius * Math.cos(targetYaw) * Math.cos(targetPitch);

  return [x + center[0], y, z + center[2]];
}

/**
 * Linear interpolation for smooth movement
 */
export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}
