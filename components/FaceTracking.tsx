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
  const smoothedCursorRef = useRef<HandCursorPosition>({ x: 0, y: 0 });
  
  const { 
    setRotation, 
    setPosition,
    setIsDetecting, 
    setIsLoading, 
    setError, 
    setPermissionDenied,
    showDebug,
    setCursorPosition,
    setIsClicking,
    setIsHandDetected
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
          numHands: 1
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

        // Process hand results
        if (handResults.landmarks && handResults.landmarks.length > 0) {
          setIsHandDetected(true);
          const handLandmarks = handResults.landmarks[0];

          // Calculate cursor position
          const rawCursorPos = calculateStableCursorPosition(handLandmarks, video.videoWidth, video.videoHeight);
          
          // Smooth cursor movement
          const smoothedPos = smoothCursorPosition(smoothedCursorRef.current, rawCursorPos, 0.3);
          smoothedCursorRef.current = smoothedPos;
          
          // Update cursor position
          setCursorPosition(smoothedPos.x, smoothedPos.y);

          // Detect pinch gesture
          const isPinching = detectPinch(handLandmarks, 0.04);
          setIsClicking(isPinching);

          // Draw hand landmarks if debug mode is on
          if (showDebug) {
            // Draw connections
            drawingUtils.drawConnectors(
              handLandmarks,
              HandLandmarker.HAND_CONNECTIONS,
              { color: "#00FF00", lineWidth: 2 }
            );
            
            // Draw landmarks
            drawingUtils.drawLandmarks(
              handLandmarks,
              { color: "#FF0000", lineWidth: 1, radius: 3 }
            );

            // Draw cursor indicator at projected position
            // We need to recalculate the projected position in canvas coordinates for visualization
            // Or just use the smoothed position we already calculated
            // Since smoothedPos is in screen coordinates, we need to convert back to canvas coordinates
            // Canvas is 320x240, Screen is window.innerWidth x window.innerHeight
            
            const canvasX = (smoothedPos.x / window.innerWidth) * canvas.width;
            // Mirror X for display
            const mirroredCanvasX = canvas.width - canvasX;
            
            const canvasY = (smoothedPos.y / window.innerHeight) * canvas.height;

            ctx!.beginPath();
            ctx!.arc(
              mirroredCanvasX,
              canvasY,
              10,
              0,
              2 * Math.PI
            );
            ctx!.strokeStyle = isPinching ? "#FF00FF" : "#00FFFF";
            ctx!.lineWidth = 3;
            ctx!.stroke();
            
            // Draw line from MCP to projected tip to visualize the projection
            const indexMCP = handLandmarks[5];
            ctx!.beginPath();
            ctx!.moveTo(indexMCP.x * canvas.width, indexMCP.y * canvas.height);
            ctx!.lineTo(mirroredCanvasX, canvasY);
            ctx!.strokeStyle = "#FFFF00";
            ctx!.setLineDash([5, 5]);
            ctx!.stroke();
            ctx!.setLineDash([]);
          }
        } else {
          setIsHandDetected(false);
          setIsClicking(false);
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
