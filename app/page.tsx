'use client'

import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { Html, useProgress } from '@react-three/drei'
import VRMViewer from '@/components/VRMViewer'
import ErrorBoundary from '@/components/ErrorBoundary'
import { FaceTrackingProvider } from '@/contexts/FaceTrackingContext'
import FaceTracking from '@/components/FaceTracking'
import DebugPanel from '@/components/DebugPanel'
import { RealtimeProvider } from '@/contexts/RealtimeContext'
import { AnimationProvider } from '@/contexts/AnimationContext'
import TranscriptionDisplay from '@/components/TranscriptionDisplay'
import VirtualCursor from '@/components/VirtualCursor'
import AnimationDebug from '@/components/AnimationDebug'
import PerlinBackground from '@/components/PerlinBackground'

function Loader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="text-gray-800 dark:text-white font-mono">
        {progress.toFixed(1)} % loaded
      </div>
    </Html>
  )
}

export default function Home() {
  return (
    <FaceTrackingProvider>
      <AnimationProvider>
        <RealtimeProvider>
          <div className="h-screen w-full bg-zinc-50 dark:bg-black relative">
            <ErrorBoundary>
              <Canvas
                camera={{ position: [0, 1.4, 1.5], fov: 40 }}
                // Camera lookAt is now handled in VRMViewer via useFrame
              >
                <ambientLight intensity={0.5} />
                <directionalLight position={[1, 1, 1]} intensity={1} />
                <PerlinBackground />
                <Suspense fallback={<Loader />}>
                  <VRMViewer />
                </Suspense>
              </Canvas>
            </ErrorBoundary>
            
            {/* Face Tracking Components */}
            <FaceTracking />
            <VirtualCursor />
            <DebugPanel />
            <TranscriptionDisplay />
            <AnimationDebug />
          </div>
        </RealtimeProvider>
      </AnimationProvider>
    </FaceTrackingProvider>
  )
}
