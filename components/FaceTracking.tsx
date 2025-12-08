'use client'

import React, { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, HandLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { useFaceTracking } from '@/contexts/FaceTrackingContext';
import { 
  calculateFaceRotation, 
  calculateFacePosition, 
  clampRotation,
  calculateStableCursorPosition,
  detectPinch,
  detectLongPinch,
  extractHandDepth,
  smoothDepth,
  smoothCursorPosition,
  HandCursorPosition
} from '@/lib/faceUtils';

export default function FaceTracking() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const leftHandRef = useRef<HandCursorPosition>({ x: 0, y: 0 });
  const rightHandRef = useRef<HandCursorPosition>({ x: 0, y: 0 });
  
  // Long pinch & depth tracking refs
  const leftPinchStartTimeRef = useRef<number | null>(null);
  const rightPinchStartTimeRef = useRef<number | null>(null);
  const leftReferenceDepthRef = useRef<number>(0);
  const rightReferenceDepthRef = useRef<number>(0);
  const leftCurrentDepthRef = useRef<number>(0);
  const rightCurrentDepthRef = useRef<number>(0);

  const { 
    setRotation,  
    setPosition,
    setIsDetecting, 
    setIsLoading, 
    setError, 
    setPermissionDenied,
    showDebug,
    setLeftHandState,
    setRightHandState,
    leftHand,
    rightHand
  } = useFaceTracking();

  // Initialize MediaPipe Face Landmarker
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "/models/face_landmarker.task",
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
        
        // Initialize Hand Landmarker
        const handLandmarkerInstance = await HandLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "/models/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
        
        setFaceLandmarker(landmarker);
        setHandLandmarker(handLandmarkerInstance);
        setIsLoading(false);
      } catch (err) {
        console.error("Error initializing MediaPipe:", err);
        setError("Failed to load tracking models");
        setIsLoading(false);
      }
    };

    initMediaPipe();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Start Webcam
  useEffect(() => {
    if (!faceLandmarker || !handLandmarker) return;

    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 320, height: 240 } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener("loadeddata", predictWebcam);
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setPermissionDenied(true);
        setError("Camera access denied");
      }
    };

    startWebcam();
  }, [faceLandmarker, handLandmarker]);

  const predictWebcam = () => {
    if (!faceLandmarker || !handLandmarker || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const drawingUtils = new DrawingUtils(ctx!);

    // Run detection at 30fps (approx 33ms interval)
    intervalRef.current = setInterval(() => {
      if (video.currentTime > 0 && !video.paused && !video.ended) {
        const startTimeMs = performance.now();
        
        // Detect face
        const faceResults = faceLandmarker.detectForVideo(video, startTimeMs);
        
        // Detect hand
        const handResults = handLandmarker.detectForVideo(video, startTimeMs);

        // Clear canvas
        ctx!.clearRect(0, 0, canvas.width, canvas.height);

        if (faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0) {
          setIsDetecting(true);
          const landmarks = faceResults.faceLandmarks[0];

          // Calculate rotation
          const rawRotation = calculateFaceRotation(landmarks);
          const clamped = clampRotation(rawRotation);
          
          // Calculate position
          const position = calculateFacePosition(landmarks);

          // Update context
          setRotation(clamped.yaw, clamped.pitch, clamped.roll);
          setPosition(position.x, position.y, position.z);

          // Draw landmarks if debug mode is on
          if (showDebug) {
            drawingUtils.drawConnectors(
              landmarks,
              FaceLandmarker.FACE_LANDMARKS_TESSELATION,
              { color: "#C0C0C070", lineWidth: 1 }
            );
            drawingUtils.drawConnectors(
              landmarks,
              FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
              { color: "#FF3030" }
            );
            drawingUtils.drawConnectors(
              landmarks,
              FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
              { color: "#FF3030" }
            );
            drawingUtils.drawConnectors(
              landmarks,
              FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
              { color: "#30FF30" }
            );
            drawingUtils.drawConnectors(
              landmarks,
              FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
              { color: "#30FF30" }
            );
            drawingUtils.drawConnectors(
              landmarks,
              FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
              { color: "#E0E0E0" }
            );
          }
        } else {
          setIsDetecting(false);
        }

        // Process hand results - support both hands
        if (handResults.landmarks && handResults.landmarks.length > 0) {
          // Reset detection flags
          let leftDetected = false;
          let rightDetected = false;

          // Process each detected hand
          for (let i = 0; i < handResults.landmarks.length; i++) {
            const handLandmarks = handResults.landmarks[i];
            const handedness = handResults.handedness[i][0];
            const isLeftHand = handedness.categoryName === 'Left';
            
            // Calculate cursor position
            const rawCursorPos = calculateStableCursorPosition(handLandmarks, video.videoWidth, video.videoHeight);
            
            // Detect pinch gesture
            const isPinching = detectPinch(handLandmarks, 0.04);
            const currentTime = performance.now();

            // Update appropriate hand state
            if (isLeftHand) {
              // Handle pinch timing and depth
              if (isPinching) {
                if (leftPinchStartTimeRef.current === null) {
                  leftPinchStartTimeRef.current = currentTime;
                  // Set reference depth when pinch starts
                  const { depth } = extractHandDepth(handLandmarks);
                  leftReferenceDepthRef.current = depth;
                }
              } else {
                leftPinchStartTimeRef.current = null;
              }

              // Calculate long pinch status
              const { isLongPinch, pinchDuration } = detectLongPinch(
                handLandmarks,
                leftPinchStartTimeRef.current,
                currentTime
              );

              // Calculate depth
              const { depth } = extractHandDepth(handLandmarks);
              let normalizedDepth = 0;
              
              if (isLongPinch) {
                // Calculate relative depth change since pinch started
                // depth is now "hand size"
                // normalizedDepth > 0 means hand is larger (closer)
                normalizedDepth = depth - leftReferenceDepthRef.current;
              }
              
              // Smooth depth
              leftCurrentDepthRef.current = smoothDepth(
                leftCurrentDepthRef.current,
                normalizedDepth,
                0.1
              );

              // Smooth cursor movement for left hand
              const smoothedPos = smoothCursorPosition(
                leftHandRef.current, 
                rawCursorPos, 
                0.3
              );
              leftHandRef.current = smoothedPos;
              
              setLeftHandState({
                x: smoothedPos.x,
                y: smoothedPos.y,
                isClicking: isPinching,
                isDetected: true,
                z: leftCurrentDepthRef.current,
                isPinching,
                isLongPinch,
                pinchDuration
              });
              leftDetected = true;

              // Draw left hand landmarks if debug mode is on
              if (showDebug) {
                drawingUtils.drawConnectors(
                  handLandmarks,
                  HandLandmarker.HAND_CONNECTIONS,
                  { color: "#0000FF", lineWidth: 2 } // Blue for left
                );
                drawingUtils.drawLandmarks(
                  handLandmarks,
                  { color: "#0088FF", lineWidth: 1, radius: 3 }
                );

                // Draw cursor indicator
                const canvasX = (smoothedPos.x / window.innerWidth) * canvas.width;
                const mirroredCanvasX = canvas.width - canvasX;
                const canvasY = (smoothedPos.y / window.innerHeight) * canvas.height;

                ctx!.beginPath();
                ctx!.arc(mirroredCanvasX, canvasY, 10, 0, 2 * Math.PI);
                ctx!.strokeStyle = isLongPinch ? "#FF00FF" : (isPinching ? "#0000FF" : "#00FFFF");
                ctx!.lineWidth = isLongPinch ? 5 : 3;
                ctx!.stroke();
              }
            } else {
              // Handle pinch timing and depth for right hand
              if (isPinching) {
                if (rightPinchStartTimeRef.current === null) {
                  rightPinchStartTimeRef.current = currentTime;
                  // Set reference depth when pinch starts
                  const { depth } = extractHandDepth(handLandmarks);
                  rightReferenceDepthRef.current = depth;
                }
              } else {
                rightPinchStartTimeRef.current = null;
              }

              // Calculate long pinch status
              const { isLongPinch, pinchDuration } = detectLongPinch(
                handLandmarks,
                rightPinchStartTimeRef.current,
                currentTime
              );

              // Calculate depth
              const { depth } = extractHandDepth(handLandmarks);
              let normalizedDepth = 0;
              
              if (isLongPinch) {
                // Calculate relative depth change since pinch started
                // depth is now "hand size"
                // normalizedDepth > 0 means hand is larger (closer)
                normalizedDepth = depth - rightReferenceDepthRef.current;
              }
              
              // Smooth depth
              rightCurrentDepthRef.current = smoothDepth(
                rightCurrentDepthRef.current,
                normalizedDepth,
                0.1
              );

              // Smooth cursor movement for right hand
              const smoothedPos = smoothCursorPosition(
                rightHandRef.current, 
                rawCursorPos, 
                0.3
              );
              rightHandRef.current = smoothedPos;
              
              setRightHandState({
                x: smoothedPos.x,
                y: smoothedPos.y,
                isClicking: isPinching,
                isDetected: true,
                z: rightCurrentDepthRef.current,
                isPinching,
                isLongPinch,
                pinchDuration
              });
              rightDetected = true;

              // Draw right hand landmarks if debug mode is on
              if (showDebug) {
                drawingUtils.drawConnectors(
                  handLandmarks,
                  HandLandmarker.HAND_CONNECTIONS,
                  { color: "#00FF00", lineWidth: 2 } // Green for right
                );
                drawingUtils.drawLandmarks(
                  handLandmarks,
                  { color: "#88FF00", lineWidth: 1, radius: 3 }
                );

                // Draw cursor indicator
                const canvasX = (smoothedPos.x / window.innerWidth) * canvas.width;
                const mirroredCanvasX = canvas.width - canvasX;
                const canvasY = (smoothedPos.y / window.innerHeight) * canvas.height;

                ctx!.beginPath();
                ctx!.arc(mirroredCanvasX, canvasY, 10, 0, 2 * Math.PI);
                ctx!.strokeStyle = isLongPinch ? "#FF00FF" : (isPinching ? "#00FF00" : "#00FFFF");
                ctx!.lineWidth = isLongPinch ? 5 : 3;
                ctx!.stroke();
              }
            }
          }

          // Update detection states for hands that weren't detected
          if (!leftDetected) {
            setLeftHandState({ isDetected: false, isClicking: false, isPinching: false, isLongPinch: false, z: 0 });
            leftPinchStartTimeRef.current = null;
          }
          if (!rightDetected) {
            setRightHandState({ isDetected: false, isClicking: false, isPinching: false, isLongPinch: false, z: 0 });
            rightPinchStartTimeRef.current = null;
          }
        } else {
          // No hands detected
          setLeftHandState({ isDetected: false, isClicking: false, isPinching: false, isLongPinch: false, z: 0 });
          setRightHandState({ isDetected: false, isClicking: false, isPinching: false, isLongPinch: false, z: 0 });
          leftPinchStartTimeRef.current = null;
          rightPinchStartTimeRef.current = null;
        }
      }
    }, 33);
  };

  // We render the video and canvas here, positioned fixed in bottom-right
  // controlled by showDebug
  return (
    <div 
      className={`fixed bottom-4 right-4 z-50 flex flex-col items-end ${showDebug ? 'visible' : 'invisible pointer-events-none'}`}
    >
      <div className="relative w-[320px] h-[240px] bg-black rounded-lg overflow-hidden border border-gray-700 shadow-lg">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100"
        />
        <canvas 
          ref={canvasRef}
          width={320}
          height={240}
          className="absolute top-0 left-0 w-full h-full transform -scale-x-100"
        />
      </div>
    </div>
  );
}
