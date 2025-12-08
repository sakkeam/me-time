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
import PerlinTree from '@/components/PerlinTree'
import PerlinGrass from '@/components/PerlinGrass'
import PerlinFlower from '@/components/PerlinFlower'
import PerlinRoad from '@/components/PerlinRoad'
import PerlinBuilding from '@/components/PerlinBuilding'
import { RoadContextProvider } from '@/contexts/RoadContext'
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

  // Tree Settings
  const [treeDensity, setTreeDensity] = useState(0.3)
  const [treeSizeRange, setTreeSizeRange] = useState<[number, number]>([0.8, 1.5])
  const [treeVarieties, setTreeVarieties] = useState<string[]>(['conifer', 'deciduous', 'bush'])
  const [treeSeed, setTreeSeed] = useState(42)
  const [treeWindStrength, setTreeWindStrength] = useState(0.5)
  const [treeLoadingProgress, setTreeLoadingProgress] = useState(0)
  const [treeDebug, setTreeDebug] = useState(false)

  // Grass Settings
  const [grassDensity, setGrassDensity] = useState(1.0)
  const [grassThreshold, setGrassThreshold] = useState(0.0)
  const [grassWindStrength, setGrassWindStrength] = useState(0.5)
  const [grassWindDirection, setGrassWindDirection] = useState<[number, number]>([1, 0.5])
  const [grassSeedOffset, setGrassSeedOffset] = useState(1000)
  const [grassUseCrossQuad, setGrassUseCrossQuad] = useState(true)
  const [grassEnableShadows, setGrassEnableShadows] = useState(false)
  const [grassDebug, setGrassDebug] = useState(false)

  // Flower Settings
  const [flowerDensity, setFlowerDensity] = useState(1.0)
  const [flowerThreshold, setFlowerThreshold] = useState(0.2)
  const [flowerWindStrength, setFlowerWindStrength] = useState(0.3)
  const [flowerWindDirection, setFlowerWindDirection] = useState<[number, number]>([1, 0.5])
  const [flowerPetalCount, setFlowerPetalCount] = useState(5)
  const [flowerSeedOffset, setFlowerSeedOffset] = useState(2000)
  const [flowerEnableShadows, setFlowerEnableShadows] = useState(false)
  const [flowerDebug, setFlowerDebug] = useState(false)

  // Building Settings
  const [buildingSeed, setBuildingSeed] = useState(12345)

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
                <RoadContextProvider>
                  <PerlinRoad 
                    terrainHeightMap={terrainHeightMap}
                    terrainSize={terrainSize}
                    terrainPosition={[0, -2, 0]}
                  />
                  <PerlinBuilding 
                    terrainHeightMap={terrainHeightMap}
                    terrainSize={terrainSize}
                    terrainPosition={[0, -2, 0]}
                    seed={buildingSeed}
                  />
                </RoadContextProvider>
                <PerlinTree 
                  terrainHeightMap={terrainHeightMap}
                  terrainSize={terrainSize}
                  terrainPosition={[0, -2, 0]}
                  density={treeDensity}
                  sizeRange={treeSizeRange}
                  varieties={treeVarieties}
                  seed={treeSeed}
                  windStrength={treeWindStrength}
                  debug={treeDebug}
                  onProgress={setTreeLoadingProgress}
                />
                <PerlinGrass 
                  terrainHeightMap={terrainHeightMap}
                  terrainSize={terrainSize}
                  terrainPosition={[0, -2, 0]}
                  density={grassDensity}
                  threshold={grassThreshold}
                  oceanLevel={-0.8}
                  baseWindStrength={grassWindStrength}
                  windDirection={grassWindDirection}
                  seedOffset={grassSeedOffset}
                  useCrossQuad={grassUseCrossQuad}
                  enableShadows={grassEnableShadows}
                  debug={grassDebug}
                />
                <PerlinFlower 
                  terrainHeightMap={terrainHeightMap}
                  terrainSize={terrainSize}
                  terrainPosition={[0, -2, 0]}
                  density={flowerDensity}
                  threshold={flowerThreshold}
                  oceanLevel={-0.8}
                  baseWindStrength={flowerWindStrength}
                  windDirection={flowerWindDirection}
                  seedOffset={flowerSeedOffset}
                  petalCount={flowerPetalCount}
                  enableShadows={flowerEnableShadows}
                  debug={flowerDebug}
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
              treeSettings={{
                density: treeDensity,
                setDensity: setTreeDensity,
                sizeRange: treeSizeRange,
                setSizeRange: setTreeSizeRange,
                varieties: treeVarieties,
                setVarieties: setTreeVarieties,
                seed: treeSeed,
                setSeed: setTreeSeed,
                windStrength: treeWindStrength,
                setWindStrength: setTreeWindStrength,
                debug: treeDebug,
                setDebug: setTreeDebug,
                loadingProgress: treeLoadingProgress
              }}
              grassSettings={{
                density: grassDensity,
                setDensity: setGrassDensity,
                threshold: grassThreshold,
                setThreshold: setGrassThreshold,
                windStrength: grassWindStrength,
                setWindStrength: setGrassWindStrength,
                windDirection: grassWindDirection,
                setWindDirection: setGrassWindDirection,
                seedOffset: grassSeedOffset,
                setSeedOffset: setGrassSeedOffset,
                useCrossQuad: grassUseCrossQuad,
                setUseCrossQuad: setGrassUseCrossQuad,
                enableShadows: grassEnableShadows,
                setEnableShadows: setGrassEnableShadows
              }}
              flowerSettings={{
                density: flowerDensity,
                setDensity: setFlowerDensity,
                threshold: flowerThreshold,
                setThreshold: setFlowerThreshold,
                windStrength: flowerWindStrength,
                setWindStrength: setFlowerWindStrength,
                windDirection: flowerWindDirection,
                setWindDirection: setFlowerWindDirection,
                petalCount: flowerPetalCount,
                setPetalCount: setFlowerPetalCount,
                seedOffset: flowerSeedOffset,
                setSeedOffset: setFlowerSeedOffset,
                enableShadows: flowerEnableShadows,
                setEnableShadows: setFlowerEnableShadows
              }}
              buildingSettings={{
                seed: buildingSeed,
                setSeed: setBuildingSeed
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
