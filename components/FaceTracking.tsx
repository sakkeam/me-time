'use client'

import React, { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { useFaceTracking } from '@/contexts/FaceTrackingContext';
import { calculateFaceRotation, clampRotation } from '@/lib/faceUtils';

export default function FaceTracking() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { 
    setRotation, 
    setIsDetecting, 
    setIsLoading, 
    setError, 
    setPermissionDenied,
    showDebug
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
        
        setFaceLandmarker(landmarker);
        setIsLoading(false);
      } catch (err) {
        console.error("Error initializing MediaPipe:", err);
        setError("Failed to load face tracking model");
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
    if (!faceLandmarker) return;

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
  }, [faceLandmarker]);

  const predictWebcam = () => {
    if (!faceLandmarker || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const drawingUtils = new DrawingUtils(ctx!);

    // Run detection at 30fps (approx 33ms interval)
    intervalRef.current = setInterval(() => {
      if (video.currentTime > 0 && !video.paused && !video.ended) {
        const startTimeMs = performance.now();
        const results = faceLandmarker.detectForVideo(video, startTimeMs);

        // Clear canvas
        ctx!.clearRect(0, 0, canvas.width, canvas.height);

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          setIsDetecting(true);
          const landmarks = results.faceLandmarks[0];

          // Calculate rotation
          const rawRotation = calculateFaceRotation(landmarks);
          const clamped = clampRotation(rawRotation);
          
          // Update context
          setRotation(clamped.yaw, clamped.pitch, clamped.roll);

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
