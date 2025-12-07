'use client'

import { Canvas } from '@react-three/fiber'
import { Suspense, useState } from 'react'
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
import PerlinTerrain from '@/components/PerlinTerrain'
import PerlinOcean, { WaveParams } from '@/components/PerlinOcean'
import PerlinCelestialBody from '@/components/PerlinCelestialBody'
import PerformanceMonitor from '@/components/PerformanceMonitor'
import * as THREE from 'three'

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
  const [terrainScale, setTerrainScale] = useState(0.03)
  const [terrainAmplitude, setTerrainAmplitude] = useState(8.0)
  const [terrainOctaves, setTerrainOctaves] = useState(4)
  const [terrainDebug, setTerrainDebug] = useState(false)

  // Sky Settings
  const [cloudDensity, setCloudDensity] = useState(0.4)
  const [cloudCoverage, setCloudCoverage] = useState(0.3)
  const [cloudSpeed, setCloudSpeed] = useState(0.5)
  const [noiseOctaves, setNoiseOctaves] = useState(3)

  // Celestial Body Settings
  const [celestialSize, setCelestialSize] = useState(2)
  const [celestialPosition, setCelestialPosition] = useState<[number, number, number]>([0, 5, -15])
  const [sunIntensity, setSunIntensity] = useState(1.5)
  const [moonIntensity, setMoonIntensity] = useState(0.8)

  // Ocean Settings
  const [oceanWaves, setOceanWaves] = useState<WaveParams[]>([
    { amplitude: 0.3, wavelength: 8, direction: [1, 0.3], speed: 1.2, steepness: 0.8 },
    { amplitude: 0.2, wavelength: 5, direction: [0.7, 1], speed: 1.0, steepness: 0.7 },
    { amplitude: 0.15, wavelength: 3, direction: [-0.5, 0.8], speed: 0.8, steepness: 0.5 },
    { amplitude: 0.08, wavelength: 1.5, direction: [0.3, -1], speed: 1.5, steepness: 0.3 }
  ])
  const [oceanOpacity, setOceanOpacity] = useState(0.85)
  const [oceanFoamThreshold, setOceanFoamThreshold] = useState(0.7)
  const [terrainHeightMap, setTerrainHeightMap] = useState<THREE.DataTexture | null>(null)
  const [terrainSize, setTerrainSize] = useState(30)
  const [oceanDebug, setOceanDebug] = useState(false)

  const setSkyPreset = (preset: 'clear' | 'sunny' | 'cloudy') => {
    switch (preset) {
      case 'clear':
        setCloudCoverage(0.1)
        setCloudDensity(0.3)
        break
      case 'sunny':
        setCloudCoverage(0.3)
        setCloudDensity(0.4)
        break
      case 'cloudy':
        setCloudCoverage(0.7)
        setCloudDensity(0.6)
        break
    }
  }

  const setOceanPreset = (preset: 'calm' | 'normal' | 'rough' | 'storm') => {
    const baseWaves = [
      { amplitude: 0.3, wavelength: 8, direction: [1, 0.3], speed: 1.2, steepness: 0.8 },
      { amplitude: 0.2, wavelength: 5, direction: [0.7, 1], speed: 1.0, steepness: 0.7 },
      { amplitude: 0.15, wavelength: 3, direction: [-0.5, 0.8], speed: 0.8, steepness: 0.5 },
      { amplitude: 0.08, wavelength: 1.5, direction: [0.3, -1], speed: 1.5, steepness: 0.3 }
    ] as WaveParams[]

    switch (preset) {
      case 'calm':
        setOceanWaves(baseWaves.map(w => ({
          ...w,
          amplitude: w.amplitude * 0.3,
          speed: w.speed * 0.6,
          steepness: w.steepness * 0.5
        })))
        break
      case 'normal':
        setOceanWaves(baseWaves)
        break
      case 'rough':
        setOceanWaves(baseWaves.map(w => ({
          ...w,
          amplitude: w.amplitude * 1.5,
          speed: w.speed * 1.3,
          steepness: Math.min(1.0, w.steepness * 1.2)
        })))
        break
      case 'storm':
        setOceanWaves(baseWaves.map(w => ({
          ...w,
          amplitude: w.amplitude * 2.2,
          speed: w.speed * 1.8,
          steepness: Math.min(1.0, w.steepness + 0.2)
        })))
        break
    }
  }

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
                <PerformanceMonitor />
                <PerlinBackground 
                  cloudDensity={cloudDensity}
                  cloudCoverage={cloudCoverage}
                  cloudSpeed={cloudSpeed}
                  noiseOctaves={noiseOctaves}
                />
                <PerlinCelestialBody
                  size={celestialSize}
                  position={celestialPosition}
                  sunIntensity={sunIntensity}
                  moonIntensity={moonIntensity}
                />
                <PerlinTerrain 
                  scale={terrainScale} 
                  amplitude={terrainAmplitude} 
                  octaves={terrainOctaves} 
                  debug={terrainDebug}
                  onHeightTextureReady={(tex, size) => {
                    setTerrainHeightMap(tex)
                    setTerrainSize(size)
                  }}
                />
                <PerlinOcean 
                  waves={oceanWaves}
                  terrainHeightMap={terrainHeightMap}
                  terrainSize={terrainSize}
                  terrainPosition={[0, -2, 0]}
                  opacity={oceanOpacity}
                  foamThreshold={oceanFoamThreshold}
                  debug={oceanDebug}
                />
                <Suspense fallback={<Loader />}>
                  <VRMViewer />
                </Suspense>
              </Canvas>
            </ErrorBoundary>
            
            {/* Face Tracking Components */}
            <FaceTracking />
            <VirtualCursor />
            <DebugPanel 
              terrainSettings={{
                scale: terrainScale,
                setScale: setTerrainScale,
                amplitude: terrainAmplitude,
                setAmplitude: setTerrainAmplitude,
                octaves: terrainOctaves,
                setOctaves: setTerrainOctaves,
                debug: terrainDebug,
                setDebug: setTerrainDebug
              }}
              skySettings={{
                cloudDensity,
                setCloudDensity,
                cloudCoverage,
                setCloudCoverage,
                cloudSpeed,
                setCloudSpeed,
                noiseOctaves,
                setNoiseOctaves,
                setPreset: setSkyPreset
              }}
              celestialSettings={{
                size: celestialSize,
                setSize: setCelestialSize,
                position: celestialPosition,
                setPosition: setCelestialPosition,
                sunIntensity,
                setSunIntensity,
                moonIntensity,
                setMoonIntensity
              }}
              oceanSettings={{
                waves: oceanWaves,
                setWaves: setOceanWaves,
                opacity: oceanOpacity,
                setOpacity: setOceanOpacity,
                foamThreshold: oceanFoamThreshold,
                setFoamThreshold: setOceanFoamThreshold,
                setPreset: setOceanPreset,
                debug: oceanDebug,
                setDebug: setOceanDebug
              }}
            />
            <TranscriptionDisplay />
            <AnimationDebug />
          </div>
        </RealtimeProvider>
      </AnimationProvider>
    </FaceTrackingProvider>
  )
}
